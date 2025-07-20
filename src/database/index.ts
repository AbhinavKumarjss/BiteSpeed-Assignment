import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const getDbClient = (): Client => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set.");
  }
  
  return new Client({
    connectionString: process.env.DATABASE_URL,
  });
};