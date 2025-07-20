import { Router } from 'express';
import { handleIdentify } from '../controllers/contact.controller';

const router = Router();

router.post('/identify', handleIdentify);

export default router;