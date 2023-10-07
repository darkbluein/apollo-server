import { IDeliverySchema } from '../types';

function cleanupAddresses(addresses: any[]) {
    const data = [];
    addresses.forEach((address) => {
        data.push({
            ...address,
            id: address._id,
        });
    });
    return data;
}

export { cleanupAddresses };
