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
  const conn = await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
  });
  console.log(`Abacus API — MongoDB: ${conn.connection.db.databaseName}`);
};

export default connectDB;
