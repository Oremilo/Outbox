import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/error-handler';

const router = Router();

/**
 * GET /api/campaigns — List all campaigns with progress stats.
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Fetch status counts for each campaign
    const campaignsWithStats = await Promise.all(
      campaigns.map(async (campaign) => {
        const statusCounts = await prisma.email.groupBy({
          by: ['status'],
          where: { campaignId: campaign.id },
          _count: { _all: true },
        });

        const counts: Record<string, number> = {};
        for (const s of statusCounts) {
          counts[s.status] = s._count._all;
        }

        return {
          id: campaign.id,
          subject: campaign.subject,
          body: campaign.body,
          createdBy: campaign.createdBy,
          startTime: campaign.startTime.toISOString(),
          delayMs: campaign.delayMs,
          hourlyLimit: campaign.hourlyLimit,
          totalRecipients: campaign.totalRecipients,
          status: campaign.status,
          createdAt: campaign.createdAt.toISOString(),
          updatedAt: campaign.updatedAt.toISOString(),
          sentCount: counts['SENT'] ?? 0,
          failedCount: counts['FAILED'] ?? 0,
          pendingCount:
            (counts['PENDING'] ?? 0) +
            (counts['SCHEDULED'] ?? 0) +
            (counts['SENDING'] ?? 0),
        };
      })
    );

    res.json(campaignsWithStats);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/campaigns/:id — Campaign detail with email breakdown.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        emails: {
          orderBy: { scheduledTime: 'asc' },
          include: {
            sender: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!campaign) {
      throw new AppError(404, 'Campaign not found');
    }

    const statusCounts = await prisma.email.groupBy({
      by: ['status'],
      where: { campaignId: id },
      _count: { _all: true },
    });

    const counts: Record<string, number> = {};
    for (const s of statusCounts) {
      counts[s.status] = s._count._all;
    }

    res.json({
      id: campaign.id,
      subject: campaign.subject,
      body: campaign.body,
      createdBy: campaign.createdBy,
      startTime: campaign.startTime.toISOString(),
      delayMs: campaign.delayMs,
      hourlyLimit: campaign.hourlyLimit,
      totalRecipients: campaign.totalRecipients,
      status: campaign.status,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      sentCount: counts['SENT'] ?? 0,
      failedCount: counts['FAILED'] ?? 0,
      pendingCount:
        (counts['PENDING'] ?? 0) +
        (counts['SCHEDULED'] ?? 0) +
        (counts['SENDING'] ?? 0),
      emails: campaign.emails.map((e: any) => ({
        id: e.id,
        recipientEmail: e.recipientEmail,
        subject: e.subject,
        status: e.status,
        scheduledTime: e.scheduledTime.toISOString(),
        sentTime: e.sentTime?.toISOString() ?? null,
        attemptCount: e.attemptCount,
        errorMessage: e.errorMessage,
        senderEmail: e.sender.email,
        senderName: e.sender.name,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
