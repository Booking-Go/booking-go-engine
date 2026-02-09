import { Router } from 'express';

import authRoutes from './auth.routes';
import businessRoutes from './business.routes';
import slotRoutes from './slot.routes';
import bookingRoutes from './booking.routes';
import userRoutes from './user.routes';

const v1Router = Router();

v1Router.use('/auth', authRoutes);
v1Router.use('/businesses', businessRoutes);
v1Router.use('/slots', slotRoutes);
v1Router.use('/bookings', bookingRoutes);
v1Router.use('/users', userRoutes);

export default v1Router;
