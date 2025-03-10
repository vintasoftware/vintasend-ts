import Winston from 'winston';

export const loggerOptions = {
    format: Winston.format.combine(
        Winston.format.timestamp(),
        Winston.format.json()
    ),
    transports: [
        new Winston.transports.Console(),
    ],
};

export const logger = Winston.createLogger(loggerOptions);