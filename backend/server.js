import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'Own-on-Chain Backend API'
  });
});

// Import routes
import { router as countryRoutes } from './api/country.js';
import { router as verificationRoutes } from './verification/verification-routes.js';
import { router as productVerifyRoutes } from './api/verify.js';
import { router as confirmationsRoutes } from './api/confirmations.js';
import { router as qrSheetRoutes } from './api/qr-sheet.js';
import { router as ipfsRoutes } from './api/ipfs.js';
import { router as webhookRoutes } from './webhooks/webhook-routes.js';

// Register routes
app.use('/api/country', countryRoutes);
app.use('/api/verify', verificationRoutes);
app.use('/api/product', productVerifyRoutes);
app.use('/api/confirmations', confirmationsRoutes);
app.use('/api/qr-sheet', qrSheetRoutes);
app.use('/api/ipfs', ipfsRoutes);
app.use('/api/webhooks', webhookRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Own-on-Chain Backend Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health\n`);
});

export default app;

