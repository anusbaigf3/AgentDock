const mongoose = require('mongoose');
const { createLogger } = require('../utils/logger');

const logger = createLogger('database');

const connectDB = async () => {
  try {

    const {
      MONGODB_ROOT_USERNAME,
      MONGODB_ROOT_PASSWORD,
      MONGODB_HOST = 'localhost',
      MONGODB_PORT = '27017',
      MONGODB_AGENT_DOCK_DATABASE = 'test',
    } = process.env;

    const mongoDbUri = `mongodb://${MONGODB_ROOT_USERNAME}:${encodeURIComponent(MONGODB_ROOT_PASSWORD)}@${MONGODB_HOST}:${MONGODB_PORT}/${MONGODB_AGENT_DOCK_DATABASE}?authSource=admin`;
    const dbConnection = await mongoose.connect(mongoDbUri);

    logger.info(`MongoDB Connected: ${dbConnection.connection.host}`);
  } catch (error) {
    logger.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
