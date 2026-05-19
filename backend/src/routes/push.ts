import { Router, Request, Response } from 'express';
import webpush from 'web-push';
import { randomUUID } from 'crypto';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

const router = Router();

// POST /api/push/subscribe — save browser push subscription (authenticated)
router.post('/subscribe', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: 'Invalid subscription object' });
    return;
  }
  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh: keys.p256dh, auth: keys.auth },
      create: { userId: req.userId!, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('push/subscribe error:', e);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

// POST /api/push/shortcut-token — generate/get long-lived token for iOS Shortcut (authenticated)
router.post('/shortcut-token', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: { pushToken: randomUUID() },
      select: { pushToken: true },
    });
    res.json({ token: user.pushToken });
  } catch (e) {
    console.error('push/shortcut-token error:', e);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

// POST /api/push/trigger — called by iOS Shortcut, sends push to user
// Uses X-Push-Token header (no JWT needed)
router.post('/trigger', async (req: Request, res: Response): Promise<void> => {
  const token = (req.headers['x-push-token'] as string | undefined) || (req.query.token as string | undefined);
  if (!token) {
    res.status(401).json({ error: 'Missing X-Push-Token header' });
    return;
  }
  try {
    const user = await prisma.user.findUnique({
      where: { pushToken: token },
      include: { pushSubscriptions: true },
    });
    if (!user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    if (user.pushSubscriptions.length === 0) {
      res.status(404).json({ error: 'No push subscriptions found' });
      return;
    }

    const payload = JSON.stringify({
      title: '💳 Ar susimokėjai?',
      body: 'Paspusk kad pridėtum išlaidą',
    });

    const results = await Promise.allSettled(
      user.pushSubscriptions.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        ).catch(async (err) => {
          if (err.statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } });
          }
          throw err;
        }),
      ),
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    res.json({ ok: true, sent });
  } catch (e) {
    console.error('push/trigger error:', e);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

// POST /api/push/test — send test push to current user (authenticated)
router.post('/test', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const subs = await prisma.pushSubscription.findMany({ where: { userId: req.userId! } });
    if (subs.length === 0) {
      res.status(404).json({ error: 'Nėra išsaugotų subscriptions. Aktyvuok notifikacijas Profile puslapyje.' });
      return;
    }
    const payload = JSON.stringify({ title: '✅ Testas veikia!', body: 'Push notifikacijos sukonfigūruotos teisingai.' });
    await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
      )
    );
    res.json({ ok: true, sent: subs.length });
  } catch (e) {
    console.error('push/test error:', e);
    res.status(500).json({ error: String(e) });
  }
});

export default router;
