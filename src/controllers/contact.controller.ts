import { Request, Response } from 'express';
import { identifyContact } from '../services/contact.service';
import { IdentifyRequest } from '../types/contact.types';

export const handleIdentify = async (req: Request, res: Response) => {
  const { email, phoneNumber } = req.body as IdentifyRequest;

  if (!email && !phoneNumber) {
    return res.status(400).json({
      error: 'Either email or phoneNumber must be provided.',
    });
  }

  try {
    const consolidatedContact = await identifyContact({ email, phoneNumber });
    return res.status(200).json({ contact: consolidatedContact });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};