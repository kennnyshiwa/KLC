import express from 'express';
import { prisma } from '../index.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Get user's total play time (requires auth)
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { totalPlayTime: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ totalPlayTime: user.totalPlayTime });
  } catch (error) {
    console.error('Error getting play time:', error);
    res.status(500).json({ error: 'Failed to get play time' });
  }
});

// Sync play time (add elapsed seconds to total)
router.post('/sync', requireAuth, async (req, res) => {
  try {
    const { seconds } = req.body;

    // Validate seconds - must be a positive integer, max 3600 (1 hour) per sync
    if (typeof seconds !== 'number' || seconds < 0 || seconds > 3600) {
      return res.status(400).json({ error: 'Invalid seconds value (must be 0-3600)' });
    }

    const roundedSeconds = Math.floor(seconds);

    if (roundedSeconds === 0) {
      // Nothing to sync
      const user = await prisma.user.findUnique({
        where: { id: req.session.userId },
        select: { totalPlayTime: true }
      });
      return res.json({ totalPlayTime: user?.totalPlayTime || 0 });
    }

    const user = await prisma.user.update({
      where: { id: req.session.userId },
      data: {
        totalPlayTime: {
          increment: roundedSeconds
        }
      },
      select: { totalPlayTime: true }
    });

    res.json({ totalPlayTime: user.totalPlayTime });
  } catch (error) {
    console.error('Error syncing play time:', error);
    res.status(500).json({ error: 'Failed to sync play time' });
  }
});

export default router;
