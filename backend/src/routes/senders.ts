import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { createEtherealAccount } from '../lib/email-sender';
import { AppError } from '../middleware/error-handler';

const router = Router();

const createSenderSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
});

/**
 * POST /api/senders — Register a new sender.
 * If email/smtpUser/smtpPass are omitted, auto-generates an Ethereal test account.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createSenderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'Validation error', parsed.error.flatten());
    }

    const { name, email, smtpUser, smtpPass } = parsed.data;

    let senderData: {
      name: string;
      email: string;
      smtpUser: string;
      smtpPass: string;
      smtpHost: string;
      smtpPort: number;
    };

    if (email && smtpUser && smtpPass) {
      // Use provided credentials
      senderData = {
        name,
        email,
        smtpUser,
        smtpPass,
        smtpHost: 'smtp.ethereal.email',
        smtpPort: 587,
      };
    } else {
      // Auto-generate Ethereal account
      console.log('[Senders] Creating Ethereal test account...');
      const ethereal = await createEtherealAccount();
      senderData = {
        name,
        email: ethereal.email,
        smtpUser: ethereal.smtpUser,
        smtpPass: ethereal.smtpPass,
        smtpHost: ethereal.smtpHost,
        smtpPort: ethereal.smtpPort,
      };
      console.log(`[Senders] Created Ethereal account: ${ethereal.email}`);
    }

    const sender = await prisma.sender.create({
      data: senderData,
    });

    res.status(201).json({
      id: sender.id,
      name: sender.name,
      email: sender.email,
      createdAt: sender.createdAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/senders — List all registered senders.
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const senders = await prisma.sender.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    res.json(
      senders.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    next(error);
  }
});

export default router;
