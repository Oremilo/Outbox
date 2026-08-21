import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { scheduleCampaign } from '../lib/scheduler';
import { AppError } from '../middleware/error-handler';

const router = Router();

const scheduleSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  recipients: z
    .array(z.string().email('Invalid email address'))
    .min(1, 'At least one recipient is required'),
  startTime: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    'startTime must be a valid ISO 8601 date string'
  ),
  delayMs: z.number().int().min(0).default(0),
  hourlyLimit: z.number().int().min(1).optional(),
  senderId: z.string().uuid('senderId must be a valid UUID'),
});

/**
 * POST /api/schedule — Create a campaign and schedule all emails.
 *
 * Accepts: subject, body, recipients[], startTime (ISO), delayMs, hourlyLimit, senderId
 * Returns: campaignId and email count
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = scheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'Validation error', parsed.error.flatten());
    }

    const { subject, body, recipients, startTime, delayMs, hourlyLimit, senderId } = parsed.data;

    const result = await scheduleCampaign({
      subject,
      body,
      recipients,
      startTime: new Date(startTime),
      delayMs,
      hourlyLimit,
      senderId,
      createdBy: (req as any).userEmail ?? undefined,
    });

    res.status(201).json({
      message: 'Campaign scheduled successfully',
      campaignId: result.campaignId,
      emailCount: result.emailCount,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
