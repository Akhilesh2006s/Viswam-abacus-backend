import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import connectDB from './config/database.js';
import { repairReleasedInactiveAbacusLogins } from './services/abacusUsername.js';
import abacusRoutes from './routes/abacus.js';
import authRoutes from './routes/auth.js';
import portalRoutes from './routes/portal.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5001;

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const healthPayload = () => ({
  ok: true,
  service: 'viswam-abacus-api',
  port: PORT,
});

app.get('/health', (_req, res) => {
  res.json(healthPayload());
});

app.get('/api/health', (_req, res) => {
  res.json(healthPayload());
});

app.use('/api/auth', authRoutes);
app.use('/api/abacus', abacusRoutes);
app.use('/api', portalRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, message: err.message || 'Server error' });
});

await connectDB();

try {
  const repaired = await repairReleasedInactiveAbacusLogins();
  if (repaired.teachers || repaired.students) {
    console.log(
      `Abacus login repair: released ${repaired.teachers} teacher(s), ${repaired.students} student(s)`,
    );
  }
} catch (repairErr) {
  console.warn('Abacus login repair skipped:', repairErr?.message || repairErr);
}

app.listen(PORT, () => {
  console.log(`Abacus API running on http://localhost:${PORT}`);
});
