import mongoose from 'mongoose';
import chalk from 'chalk';

export const connectMongoDB = async (): Promise<void> => {
  try {
    const uri = process.env.MONGODB_URI!;
    
    await mongoose.connect(uri);
    
    console.log(chalk.green('[MongoDB] Connected successfully'));
    
    mongoose.connection.on('error', (error) => {
      console.error(chalk.red('[MongoDB] Connection error:'), error);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log(chalk.yellow('[MongoDB] Disconnected'));
    });
  } catch (error) {
    console.error(chalk.red('[MongoDB] Connection error:'), error);
    throw error;
  }
};

export const closeMongoDB = async (): Promise<void> => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
};
