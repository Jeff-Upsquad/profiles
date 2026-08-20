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
import leadRouter from './routes/lead.routes.js';
import interviewRouter from './routes/interview.routes.js';
import talentAccessRouter from './routes/talent-access.routes.js';
import staffAuthRouter from './routes/staff-auth.routes.js';
import subscriptionRouter from './routes/subscription.routes.js';
import webhookRouter from './routes/webhooks.routes.js';
import integrationsRouter from './routes/integrations.routes.js';
import pushRouter from './routes/push.routes.js';
import jobsTalentRouter from './routes/jobs-talent.routes.js';
import jobsBusinessRouter from './routes/jobs-business.routes.js';
import * as pushController from './controllers/push.controller.js';
import * as appVersionController from './controllers/app-version.controller.js';
import { startCallbackSweeper } from './services/squadhub-callback.service.js';
import { startJobsOutboxSweeper } from './services/jobs-outbox.service.js';
import { startCardEventsOutboxSweeper } from './services/card-events-outbox.service.js';
import { startInterviewSweeper } from './services/jobs-sweepers.service.js';
import { startCardPaymentsSweeper } from './services/card-payments.service.js';
import * as cardPaymentsController from './controllers/card-payments.controller.js';

const app = express();

// Trust the proxy (nginx/Caddy) so X-Forwarded-For works for rate-limit.
app.set('trust proxy', 1);

// Lightweight request logger — fires before any other middleware so we
// see every request the backend receives, even when downstream throws.
app.use((req, _res, next) => {
  console.log(`[req] ${req.method} ${req.url} from ${req.ip} ua=${req.get('user-agent')?.slice(0, 60)}`);
  next();
});

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
// Razorpay verifies with an HMAC over the EXACT bytes it sent, so this one
// route needs the raw body — mounted ahead of the global JSON parser, which
// would otherwise consume the stream and leave only a re-serialized object.
app.post(
  '/api/webhooks/razorpay',
  express.raw({ type: '*/*', limit: '1mb' }),
  cardPaymentsController.razorpayWebhook,
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
// Jobs module — mounted before the parent routers so /jobs requests don't
// pass through their middleware chains first.
app.use('/api/talent/jobs', jobsTalentRouter);
app.use('/api/business/jobs', jobsBusinessRouter);
app.use('/api/talent', talentRouter);
app.use('/api/public', publicRouter);
app.use('/api/business', businessRouter);
app.use('/api/leads', leadRouter);
app.use('/api/interview', interviewRouter);
app.use('/api/talent-access', talentAccessRouter);
app.use('/api/staff-auth', staffAuthRouter);
app.use('/api/talent/subscriptions', subscriptionRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/talent/push', pushRouter);
app.get('/api/app-config', pushController.appConfig);

// In-app updater manifests for the sideloaded mobile apps. Public (no auth),
// polled on launch; mirror the SquadHub partner app's GET /partner-app/version.
app.get('/api/talent-app/version', appVersionController.talentApp);
app.get('/api/admin-lite/version', appVersionController.adminLite);

// ---------------------------------------------------------------------------
// Global error handler (must be registered after all routes)
// ---------------------------------------------------------------------------
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Serve frontend static files in production
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.resolve(process.cwd(), '../frontend/dist');
  const adminDist = path.resolve(process.cwd(), '../admin/dist');

  // Serve admin panel at /admin
  app.use('/admin', express.static(adminDist));
  app.get('/admin/{*path}', (_req, res) => {
    res.sendFile(path.join(adminDist, 'index.html'));
  });

  // Serve main frontend (must come after admin routes)
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
  startCallbackSweeper();
  startJobsOutboxSweeper();
  startCardEventsOutboxSweeper();
  startInterviewSweeper();
  startCardPaymentsSweeper();
});

export default app;
