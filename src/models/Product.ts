import { Schema, model } from 'mongoose';
import { IProductSchema } from '../types';

export interface IProduct extends IProductSchema {}

const productSchema = new Schema(
    {
        _id: {
            type: String,
        },
        brand: {
            type: String,
        },
        name: {
            type: String,
            required: true,
        },
        url: {
            type: String,
        },
        fetchUri: {
            type: String,
        },
        quantity: {
            count: {
                type: String,
                required: true,
            },
            type: {
                type: String,
                required: true,
            },
        },
        barcode: {
            type: String,
        },
        price: {
            mrp: {
                type: String,
                required: true,
            },
            discount: {
                type: String,
            },
        },
        ratings: {
            type: [Number],
        },
    },
    {
        id: true,
        timestamps: true,
    },
);

export default model<IProduct>('Product', productSchema);
