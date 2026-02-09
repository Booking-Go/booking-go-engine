import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import chalk from 'chalk';

import { connectPostgres, connectMongoDB, connectRedis } from './config';
import { errorHandler, rateLimiter } from './middleware';
import router from './routes';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(rateLimiter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes (versioned)
app.use(router);

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize databases and start server
const startServer = async () => {
  try {
    // Connect to databases
    await connectPostgres();
    await connectMongoDB();
    await connectRedis();

    app.listen(PORT, () => {
      console.log(chalk.green.bold(`\n[Server] Running on port ${PORT}`));
      console.log(chalk.cyan(`[Server] Environment: ${process.env.NODE_ENV}`));
      console.log(chalk.cyan(`[Server] API Base URL: http://localhost:${PORT}/api/v1\n`));
    });
  } catch (error) {
    console.error(chalk.red.bold('[Server] Failed to start:'), error);
    process.exit(1);
  }
};

startServer();

export default app;
