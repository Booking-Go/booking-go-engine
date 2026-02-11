import mongoose from 'mongoose';
import chalk from 'chalk';

/** Connects to MongoDB using the `MONGODB_URI` environment variable. */
export const connectMongoDB = async (): Promise<void> => {
  try {
    const uri = process.env.MONGODB_URI!;
    
    await mongoose.connect(uri);
    
    console.log(chalk.green('[MongoDB] Connected successfully'));
    
    mongoose.connection.on('error', (err: unknown) => {
      console.error(chalk.red('[MongoDB] Connection error:'), err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log(chalk.yellow('[MongoDB] Disconnected'));
    });
  } catch (err: unknown) {
    console.error(chalk.red('[MongoDB] Connection error:'), err);
    throw err;
  }
};

/** Gracefully closes the MongoDB connection. */
export const closeMongoDB = async (): Promise<void> => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
};
