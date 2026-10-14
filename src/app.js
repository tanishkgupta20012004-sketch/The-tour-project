import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { checkDbConnection } from './config/db.js';
import authRoutes from './modules/auth/auth.routes.js';
import operatorRoutes from './modules/operators/operator.routes.js';
import tripRoutes from './modules/trips/trip.routes.js';
import departureRoutes from './modules/departures/departure.routes.js';
import bookingRoutes from './modules/bookings/booking.routes.js';
import paymentRoutes from './modules/payments/payment.routes.js';
import reviewRoutes from './modules/reviews/review.routes.js';
import compatibilityRoutes from './modules/compatibility/compatibility.routes.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { ApiResponse } from './utils/ApiResponse.js';

const app = express();

// Security & parsing middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/api/v1/health', async (_req, res) => {
  const dbHealthy = await checkDbConnection().catch(() => false);
  res.status(dbHealthy ? 200 : 503).json(
    new ApiResponse(dbHealthy ? 200 : 503, 'Tour Marketplace Backend Status', {
      service: 'tour-marketplace-backend',
      phase: 'Phase 6 Complete - Discovery, Departure-Confidence & Compatibility Platform',
      database: dbHealthy ? 'CONNECTED' : 'DISCONNECTED',
      database_name: process.env.DB_NAME || 'tour_marketplace_db',
      timestamp: new Date().toISOString()
    })
  );
});

// Phase 1 to Phase 6 API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/operators', operatorRoutes);
app.use('/api/v1/trips', tripRoutes);
app.use('/api/v1/departures', departureRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/compatibility', compatibilityRoutes);

// 404 & Central Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
