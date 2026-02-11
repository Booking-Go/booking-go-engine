import { Router } from 'express';

import authRoutes from './auth.routes';
import businessRoutes from './business.routes';
import slotRoutes from './slot.routes';
import bookingRoutes from './booking.routes';
import userRoutes from './user.routes';
import messageRoutes from './message.routes';

const v1Router = Router();

// Sample route to verify API is reachable
v1Router.get('/ping', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'booking-go-engine v1 is running',
    timestamp: new Date().toISOString(),
  });
});
v1Router.use('/auth', authRoutes);
v1Router.use('/businesses', businessRoutes);
v1Router.use('/slots', slotRoutes);
v1Router.use('/bookings', bookingRoutes);
v1Router.use('/users', userRoutes);
v1Router.use('/messages', messageRoutes);

export default v1Router;
