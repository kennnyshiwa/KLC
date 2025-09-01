import express from 'express';
import { prisma } from '../index.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Get total count of layouts (no auth required)
router.get('/count', async (req, res) => {
  try {
    const count = await prisma.layout.count();
    res.json({ count });
  } catch (error) {
    console.error('Error getting layout count:', error);
    res.status(500).json({ error: 'Failed to get layout count' });
  }
});

// Get all public layouts (no auth required)
router.get('/public', async (req, res) => {
  console.log('Public layouts endpoint hit');
  console.log('Query params:', req.query);
  
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Simplified where clause without case-insensitive mode
    const where = {
      isPublic: true
    };
    
    // Add search conditions if search query exists
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } }
      ];
    }
    
    console.log('Where clause:', JSON.stringify(where, null, 2));
    
    const [layouts, total] = await Promise.all([
      prisma.layout.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: parseInt(limit),
        include: {
          owner: {
            select: {
              username: true,
              discriminator: true
            }
          }
        }
      }),
      prisma.layout.count({ where })
    ]);
    
    console.log(`Found ${layouts.length} layouts out of ${total} total`);
    
    res.json({
      layouts,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching public layouts:', error);
    res.status(500).json({ error: 'Failed to fetch public layouts' });
  }
});

// Get a specific public layout (no auth required)
router.get('/public/:id', async (req, res) => {
  try {
    const layout = await prisma.layout.findUnique({
      where: { 
        id: req.params.id,
        isPublic: true 
      },
      include: {
        owner: {
          select: {
            username: true,
            discriminator: true
          }
        }
      }
    });
    
    if (!layout) {
      return res.status(404).json({ error: 'Layout not found or not public' });
    }
    
    res.json(layout);
  } catch (error) {
    console.error('Error fetching public layout:', error);
    res.status(500).json({ error: 'Failed to fetch layout' });
  }
});

// Get all layouts for the authenticated user
router.get('/', requireAuth, async (req, res) => {
  try {
    const layouts = await prisma.layout.findMany({
      where: { ownerId: req.session.userId },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(layouts);
  } catch (error) {
    console.error('Error fetching layouts:', error);
    res.status(500).json({ error: 'Failed to fetch layouts' });
  }
});

// Get a specific layout
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const layout = await prisma.layout.findUnique({
      where: {
        id: req.params.id,
        ownerId: req.session.userId
      }
    });
    
    if (!layout) {
      return res.status(404).json({ error: 'Layout not found' });
    }
    
    res.json(layout);
  } catch (error) {
    console.error('Error fetching layout:', error);
    res.status(500).json({ error: 'Failed to fetch layout' });
  }
});

// Create a new layout
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description, data, isPublic, tags } = req.body;
    
    if (!name || !data) {
      return res.status(400).json({ error: 'Name and data are required' });
    }
    
    const layout = await prisma.layout.create({
      data: {
        ownerId: req.session.userId,
        name,
        description: description || '',
        data,
        isPublic: isPublic || false,
        tags: tags || []
      }
    });
    
    res.status(201).json(layout);
  } catch (error) {
    console.error('Error creating layout:', error);
    res.status(500).json({ error: 'Failed to create layout' });
  }
});

// Update a layout
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { name, description, data, isPublic, tags } = req.body;
    
    // First check if the layout belongs to the user
    const existingLayout = await prisma.layout.findUnique({
      where: {
        id: req.params.id,
        ownerId: req.session.userId
      }
    });
    
    if (!existingLayout) {
      return res.status(404).json({ error: 'Layout not found' });
    }
    
    const layout = await prisma.layout.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        data,
        isPublic,
        tags
      }
    });
    
    res.json(layout);
  } catch (error) {
    console.error('Error updating layout:', error);
    res.status(500).json({ error: 'Failed to update layout' });
  }
});

// Delete a layout
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    // First check if the layout belongs to the user
    const layout = await prisma.layout.findUnique({
      where: {
        id: req.params.id,
        ownerId: req.session.userId
      }
    });
    
    if (!layout) {
      return res.status(404).json({ error: 'Layout not found' });
    }
    
    await prisma.layout.delete({
      where: { id: req.params.id }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting layout:', error);
    res.status(500).json({ error: 'Failed to delete layout' });
  }
});

export default router;