import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import expenseRoutes from './routes/expenses';
import profileRoutes from './routes/profile';
import pushRoutes from './routes/push';
import budgetRoutes from './routes/budgets';
import recurringRoutes from './routes/recurring';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      // Allow any Vercel preview/production deployment
      if (origin.match(/^https:\/\/expence.*\.vercel\.app$/)) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// JSON parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/recurring', recurringRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Maršrutas nerastas' });
});

app.listen(PORT, () => {
  console.log(`🚀 Serveris veikia: http://localhost:${PORT}`);
  console.log(`📊 Aplinka: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
