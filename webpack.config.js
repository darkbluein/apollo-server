const nodeExternals = require('webpack-node-externals');
const path = require('path');
const { default: config } = require('./src/config');

require('dotenv').config();

module.exports = {
    entry: './src/index.ts',
    target: 'node',
    externals: [nodeExternals()],
    mode: config.app.environment,
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        alias: {
            functions: path.resolve(__dirname, './src/functions'),
            gqlresolvers: path.resolve(__dirname, './src/graphql/resolvers'),
            gqltypes: path.resolve(__dirname, './src/graphql/types'),
            models: path.resolve(__dirname, './src/models'),
            types: path.resolve(__dirname, './src/types'),
            utils: path.resolve(__dirname, './src/utils'),
            redis: path.resolve(__dirname, './src/redis'),
            brain: path.resolve(__dirname, './src/brain'),
            twilio: path.resolve(__dirname, './src/twilio'),
            db: path.resolve(__dirname, './src/db'),
            geohash: path.resolve(__dirname, './src/geohash'),
            pubsub: path.resolve(__dirname, './src/pubsub'),
        },
        modules: ['src'],
        extensions: ['.ts', '.js'],
    },
    output: {
        filename: 'app.js',
        path: path.resolve(__dirname, 'dist'),
    },
};
