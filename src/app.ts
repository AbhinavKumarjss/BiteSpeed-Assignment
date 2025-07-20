import express from 'express';
import dotenv from 'dotenv';
import contactRoutes from './routes/contact.routes';

dotenv.config();

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Bitespeed Identity Reconciliation Service is running!');
});

app.use(contactRoutes);

export default app;