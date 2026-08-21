import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

/**
 * GET /api/emails/scheduled — Paginated list of scheduled (non-sent) emails.
 * Query params: page (default 1), pageSize (default 20), status (filter)
 */
router.get('/scheduled', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const statusFilter = req.query.status as string | undefined;

    const scheduledStatuses = ['PENDING', 'SCHEDULED', 'SENDING'];
    const where: any = {
      status: statusFilter
        ? { equals: statusFilter.toUpperCase() }
        : { in: scheduledStatuses },
    };

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where,
        orderBy: { scheduledTime: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          sender: { select: { name: true, email: true } },
        },
      }),
      prisma.email.count({ where }),
    ]);

    res.json({
      data: emails.map((e) => ({
        id: e.id,
        campaignId: e.campaignId,
        senderId: e.senderId,
        recipientEmail: e.recipientEmail,
        subject: e.subject,
        body: e.body,
        status: e.status,
        scheduledTime: e.scheduledTime.toISOString(),
        sentTime: e.sentTime?.toISOString() ?? null,
        attemptCount: e.attemptCount,
        errorMessage: e.errorMessage,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
        senderEmail: e.sender.email,
        senderName: e.sender.name,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/emails/sent — Paginated list of sent/failed emails.
 * Query params: page (default 1), pageSize (default 20), status (filter)
 */
router.get('/sent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const statusFilter = req.query.status as string | undefined;

    const sentStatuses = ['SENT', 'FAILED'];
    const where: any = {
      status: statusFilter
        ? { equals: statusFilter.toUpperCase() }
        : { in: sentStatuses },
    };

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where,
        orderBy: { sentTime: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          sender: { select: { name: true, email: true } },
        },
      }),
      prisma.email.count({ where }),
    ]);

    res.json({
      data: emails.map((e) => ({
        id: e.id,
        campaignId: e.campaignId,
        senderId: e.senderId,
        recipientEmail: e.recipientEmail,
        subject: e.subject,
        body: e.body,
        status: e.status,
        scheduledTime: e.scheduledTime.toISOString(),
        sentTime: e.sentTime?.toISOString() ?? null,
        attemptCount: e.attemptCount,
        errorMessage: e.errorMessage,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
        senderEmail: e.sender.email,
        senderName: e.sender.name,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
