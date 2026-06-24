import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { configureMongoDns } from './mongo-dns.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('MONGO_URI is required in abacus-backend/.env');
  process.exit(1);
}

const connectDB = async () => {
  configureMongoDns();
  const dbName = decodeURIComponent(MONGO_URI.split('/').pop()?.split('?')[0] || '') || 'unknown';
  try {
    const conn = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
    });
    console.log(`Abacus API — MongoDB: ${conn.connection.db.databaseName}`);
  } catch (err) {
    console.error('❌ Abacus MongoDB connection error:', err?.message || err);
    console.error(`   Database in MONGO_URI: ${dbName}`);
    console.error('   Cluster: viswam.q39fuu.mongodb.net (port 27017)');
    console.error('   Cause: ETIMEDOUT = your PC cannot reach Atlas (IP not whitelisted or firewall blocks port 27017)');
    console.error('   Fix: MongoDB Atlas → Network Access → Add IP Address');
    try {
      const ipRes = await fetch('https://api.ipify.org', { signal: AbortSignal.timeout(8000) });
      const ip = String(await ipRes.text()).trim();
      if (ip) console.error(`   Whitelist this IP: ${ip}`);
    } catch {
      console.error('   Whitelist your current IP (or 0.0.0.0/0 for local dev only)');
    }
    process.exit(1);
  }
};

export default connectDB;
