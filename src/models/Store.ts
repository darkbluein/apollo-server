import { Schema, Document, model } from 'mongoose';
import { IStoreSchema } from '../types';
import { uniqueId } from '../utils/uuid';

export interface IStore extends IStoreSchema, Document {}

export const pointSchema = new Schema(
    {
        hash: {
            type: String,
            required: true,
        },
        coordinates: {
            type: [String],
            required: true,
        },
    },
    { _id: false },
);

export const contactSchema = new Schema(
    {
        ISD: {
            type: String,
            min: 1,
            max: 4,
        },
        number: {
            type: String,
            required: true,
            min: 10,
            max: 12,
        },
    },
    { _id: false },
);

const accountOrderSchema = new Schema(
    {
        orderId: {
            type: String,
        },
        paid: {
            type: Boolean,
        },
        date: {
            type: String,
        },
        amount: {
            type: String,
        },
    },
    {
        _id: false,
    },
);

const accountPendingSchema = new Schema(
    {
        status: {
            type: Boolean,
            default: true,
        },
        amount: {
            type: String,
        },
    },
    { _id: false },
);

const accountSchema = new Schema(
    {
        id: {
            type: String,
            required: true,
        },
        name: {
            type: String,
        },
        lastUpdated: {
            type: String,
        },
        closed: {
            type: Boolean,
        },
        orders: {
            type: [accountOrderSchema],
        },
        pending: {
            type: accountPendingSchema,
        },
    },
    {
        _id: false,
    },
);

const storeSchema = new Schema(
    {
        _id: {
            type: String,
        },
        name: {
            type: String,
        },
        contact: {
            type: contactSchema,
            required: true,
        },
        meta: {
            verified: {
                type: Boolean,
                default: false,
            },
            closed: {
                type: Boolean,
                default: false,
            },
            lastUpdated: {
                type: String,
            },
        },
        upi: {
            value: {
                type: String,
            },
            display: {
                type: String,
            },
            lastUpdated: {
                type: String,
            },
        },
        address: {
            line: {
                type: String,
            },
            location: {
                type: pointSchema,
                required: true,
            },
        },
        accounts: {
            type: [accountSchema],
        },
    },
    {
        id: true,
        timestamps: true,
    },
);

export default model<IStore>('Store', storeSchema);
