require('dotenv').config();

const keys = {
    app: {
        port: process.env.PORT,
        testPort: process.env.TEST_PORT,
        environment: process.env.NODE_ENV,
        secret: process.env.TOKEN_SECRET,
        refreshSecret: process.env.REFRESH_TOKEN_SECRET,
    },
    db: {
        connection_string: process.env.MONGODB_CONNECTION_STRING,
    },
    redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
    },
    twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        messagingId: process.env.TWILIO_MESSAGING_SID,
        number: process.env.TWILIO_NUMBER,
    },
    google: {
        test: {
            user: {
                number: process.env.GOOGLE_PLAY_USER_TEST_NUMBER,
                code: process.env.GOOGLE_PLAY_USER_TEST_CODE,
            },
            store: {
                number: process.env.GOOGLE_PLAY_STORE_TEST_NUMBER,
                code: process.env.GOOGLE_PLAY_STORE_TEST_CODE,
            },
        },
    },
};

export default keys;
