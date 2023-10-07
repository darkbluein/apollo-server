import bcrypt from 'bcryptjs';
import { ObjectId } from 'bson';
import { UserInputError, ValidationError, AuthenticationError, ForbiddenError } from 'apollo-server-express';
import { withFilter } from 'graphql-subscriptions';

import Store from '../../../models/Store';
import Order from '../../../models/Order';
import Product from '../../../models/Product';
import Inventory from '../../../models/Inventory';

import { checkAuthHeader } from '../../../utils/checkAuth';
import { encodeUpi } from '../../../utils/upi';
import { asyncForEach } from '../../../utils/generalUtil';
import Geohash from '../../../geohash';
import pubsub from '../../../pubsub';
import { generateToken } from '../../../utils/generalUtil';
import { IContactSchema, IProductSchema, IStoreUpdateSchema } from '../../../types';
import { uniqueId } from '../../../utils/uuid';

const STORE_UPDATE = 'STORE_UPDATE';
const INVENTORY_UPDATE = 'INVENTORY_UPDATE';

export default {
    Query: {
        async getStore(_: any, {}, req) {
            const { loggedUser, source } = checkAuthHeader(req);

            const store = await Store.findById(loggedUser.id);

            console.log(`Store ${loggedUser.id} requesting details.`);

            // process data
            const td = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

            const orders = await Order.find({
                'meta.storeId': store._id,
                'state.created.date': {
                    $gte: td,
                },
            });

            let total = 0;
            let count = 0;

            orders.forEach((obj: any) => {
                if (obj.state.order.accepted) {
                    count = count + 1;
                    total = total + parseFloat(obj.state.payment.grandAmount);
                }
            });

            const stat = {
                amount: total.toFixed(2).toString(),
                count,
                error: false,
                errorMessage: null,
            };

            if (store) {
                return { ...store._doc, id: store._id, stat };
            } else {
                throw new ValidationError('User not found');
            }
        },
        async getConfirmation(_: any, { storeId }: { storeId: string }, req) {
            const { loggedUser } = checkAuthHeader(req);

            console.log(`User ${loggedUser.id} requesting confirmation for order.`);

            const data = {
                name: '',
                status: {
                    closed: true,
                },
                account: {
                    exists: false,
                    amount: '0.00',
                    closed: false,
                    date: new Date().toISOString(),
                },
            };

            const store = await Store.findById(storeId);

            data.name = store._doc.name;
            data.status.closed = store._doc.meta.closed;

            const account = store._doc.accounts.find((account: any) => account.id === loggedUser.id);

            if (account) {
                data.account.exists = true;
                data.account.amount = account.pending.amount;
                data.account.closed = account.closed;
                data.account.date = account.lastUpdated;
            }

            return data;
        },
    },
    Mutation: {
        async addAccount(_, { contact }: { contact: IContactSchema; orderId?: string }, req) {
            const { source } = checkAuthHeader(req);

            if (source.startsWith('X-Locality-Store')) {
                const account = await Store.findOne({
                    'accounts.$.contact': contact,
                });

                if (account) {
                    console.log('Account exists.');
                } else {
                    console.log('Creating account.');
                }
            } else {
                throw new Error('User not authenticated to access this path');
            }
        },
        async editStore(_: any, { edit, storeInfo }: { edit: boolean; storeInfo: IStoreUpdateSchema }, req) {
            const { source } = checkAuthHeader(req, true);

            if (!source.startsWith('X-Locality-Store')) {
                throw new ForbiddenError('Cannot access this endpoint');
            }

            const data: IStoreUpdateSchema = { ...storeInfo };

            const geohash = Geohash.encode(
                Number(data.address.location.coordinates[0]),
                Number(data.address.location.coordinates[1]),
                9,
            );

            const licenseHash: string = await bcrypt.hash(data.licenseNumber, 12);

            delete data.licenseNumber;

            try {
                if (edit) {
                    const { loggedUser } = checkAuthHeader(req);

                    const store = await Store.findById(loggedUser.id).exec();

                    if (!store) {
                        throw new AuthenticationError('Cannot find store to update');
                    }

                    console.log(`Store ${store.id} changing details.`);

                    let enUpi: {
                        value: string;
                        display: string;
                    };

                    if (data.upi) {
                        enUpi = encodeUpi(data.upi);
                    }

                    const storeUpdate = await Store.findByIdAndUpdate(
                        { _id: loggedUser.id },
                        {
                            $set: {
                                name: data.name,
                                contact: data.contact,
                                upi: {
                                    value: enUpi ? enUpi.value : '',
                                    display: enUpi ? enUpi.display : 'Not Available',
                                    lastUpdated: new Date().toISOString(),
                                },
                                'meta.lastUpdated': new Date().toISOString(),
                                'meta.licenseHash': licenseHash.toString(),
                                'address.line': data.address.line1,
                                'address.location.hash': geohash,
                                'address.location.coordinates': data.address.location.coordinates,
                            },
                        },
                        {
                            returnDocument: 'after',
                        },
                    );

                    if (storeUpdate) {
                        pubsub.publish(STORE_UPDATE, {
                            storeUpdate: {
                                ...storeUpdate._doc,
                                id: storeUpdate.id,
                            },
                        });

                        return {
                            ...storeUpdate._doc,
                            id: storeUpdate.id,
                        };
                    }
                } else {
                    const storeExists = await Store.findOne({
                        'contact.number': data.contact.number,
                    }).exec();

                    if (storeExists) {
                        throw new UserInputError('Contact is taken', {
                            errors: {
                                contact: 'This contact is taken',
                            },
                        });
                    }

                    const enUpi = encodeUpi(data.upi);

                    const newStore = await new Store({
                        _id: uniqueId(),
                        ...data,
                        meta: {
                            lastUpdated: new Date().toISOString(),
                            licenseHash,
                        },
                        upi: {
                            ...enUpi,
                            lastUpdated: new Date().toISOString(),
                        },
                        address: {
                            line: data.address.line1,
                            location: {
                                hash: geohash,
                                coordinates: data.address.location.coordinates,
                            },
                        },
                    }).save();

                    const newInventory = new Inventory({
                        _id: uniqueId(),
                        meta: {
                            storeId: newStore.id,
                            lastUpdated: new Date().toISOString(),
                        },
                        products: [],
                    });

                    const resInv = await newInventory.save();

                    console.log(`Store ${newStore.id} registered. Inventory ${resInv.id} assigned.`);

                    const token = generateToken(newStore);

                    return {
                        ...newStore._doc,
                        id: newStore.id,
                        token,
                    };
                }
            } catch (err) {
                throw new UserInputError('Cannot perform operation');
            }
        },
        async addToInventory(_, { products }: { products: Array<IProductSchema> }, req) {
            const { loggedUser, source } = checkAuthHeader(req);

            if (source.startsWith('X-Locality-Store')) {
                const inventory = await Inventory.findOne({
                    'meta.storeId': loggedUser.id,
                });

                const inventoryProducts = [...inventory.products];

                await asyncForEach(products, async (product) => {
                    const inArray = inventoryProducts.findIndex((p) => p.id === product.id);

                    const p = await Product.findById(product.id);

                    if (inArray > -1) {
                        inventoryProducts.splice(inArray, 1);
                    }

                    if (product.barcode && p.barcode.trim().length !== 0) {
                        await Product.updateOne(
                            { _id: product.id },
                            {
                                $set: {
                                    barcode: product.barcode,
                                },
                            },
                        );
                    }

                    delete p._doc._id;
                    delete p._doc.ratings;
                    delete product.url;

                    inventoryProducts.push({
                        ...p._doc,
                        ...product,
                        lastUpdated: new Date().toISOString(),
                    });
                });

                const updated = await Inventory.updateOne(
                    {
                        'meta.storeId': loggedUser.id,
                    },
                    {
                        $set: {
                            'meta.lastUpdated': new Date().toISOString(),
                            products: inventoryProducts,
                        },
                    },
                );

                await Store.updateOne(
                    {
                        _id: loggedUser.id,
                    },
                    {
                        $set: {
                            'meta.lastUpdated': new Date().toISOString(),
                        },
                    },
                );

                pubsub.publish(INVENTORY_UPDATE, {
                    inventoryUpdate: {
                        ...inventory,
                        id: inventory._id,
                        meta: {
                            lastUpdated: new Date().toISOString(),
                        },
                        products: inventoryProducts,
                    },
                });

                return updated.modifiedCount ? true : false;
            }

            throw new AuthenticationError('User cannot access this route.');
        },
        async verifyStore(_, { storeId, verified }: { storeId: string; verified: boolean }, req) {
            const { loggedUser } = checkAuthHeader(req);
            console.log(`User ${loggedUser.id} requesting confirmation for order.`);

            /* checkforsuperuser 
        const user = await User.findById(loggedUser.id)
        if(user._doc.meta.isSuperuser){

        } else{
          throw new Error('User not permitted to access this route')
        }
      */

            const storeUpdate = await Store.updateOne(
                { _id: storeId },
                {
                    'meta.verified': verified,
                    'meta.lastUpdated': new Date().toISOString(),
                },
                {
                    returnDocument: 'after',
                },
            );

            if (storeUpdate.modifiedCount) {
                const res = await Store.findById(loggedUser.id);
                pubsub.publish(STORE_UPDATE, {
                    storeUpdate: {
                        ...res._doc,
                        id: res._id,
                    },
                });
                return true;
            }
            return false;
        },
    },
    Subscriptions: {
        storeUpdate: {
            subscribe: withFilter(
                () => pubsub.asyncIterator([STORE_UPDATE]),
                (payload: any, variables: any) => {
                    return payload.storeUpdate.id === variables.id;
                },
            ),
        },
        inventoryUpdate: {
            subscribe: withFilter(
                () => pubsub.asyncIterator([INVENTORY_UPDATE]),
                (payload: any, variables: any) => {
                    return payload.inventoryUpdate.id === variables.id;
                },
            ),
        },
    },
};
