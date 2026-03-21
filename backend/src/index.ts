import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';
import authRouter from './routes/auth.routes.js';
import adminRouter from './routes/admin.routes.js';
import uploadRouter from './routes/upload.routes.js';
import talentRouter from './routes/talent.routes.js';
import publicRouter from './routes/public.routes.js';
import businessRouter from './routes/business.routes.js';

const app = express();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https:", "http:"],
      upgradeInsecureRequests: null,
    },
  } : false,
}));
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Route placeholders (will be mounted in later phases)
// ---------------------------------------------------------------------------
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/talent', talentRouter);
app.use('/api/public', publicRouter);
app.use('/api/business', businessRouter);

// ---------------------------------------------------------------------------
// Global error handler (must be registered after all routes)
// ---------------------------------------------------------------------------
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Serve frontend static files in production
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.resolve(process.cwd(), '../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(env.PORT, () => {
  console.log(`[SquadHire] Server running on port ${env.PORT}`);
});

export default app;
