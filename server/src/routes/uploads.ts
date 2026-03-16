import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { generatePresignedUrl, uploadGroupAvatar } from '../services/upload.service.js';

const router: Router = Router();

// ==================== GENERATE Presigned URL ====================
router.post('/presigned', requireAuth, uploadLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileName, fileType, folder } = req.body;

    if (!fileName || !fileType || !folder) {
      return res.status(400).json({ error: 'Missing required fields: fileName, fileType, or folder' });
    }

    const result = await generatePresignedUrl({
      fileName,
      fileType,
      folder,
      fileSize: req.body.fileSize ? parseInt(req.body.fileSize, 10) : 0,
      urlTtl: req.body.urlTtl ? parseInt(req.body.urlTtl, 10) : 300,
      fileRetention: req.body.fileRetention ? parseInt(req.body.fileRetention, 10) : 0,
      userId: req.user!.id
    });

    res.json(result);
  } catch (error) {
    console.error('[PRESIGNED-URL-ERROR] Failed to generate URL');
    next(error);
  }
});

// ==================== UPLOAD Group Avatar ====================
router.post(
  '/groups/:id/avatar',
  uploadLimiter,
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileUrl } = req.body;
      const groupId = req.params.id;

      if (!req.user) throw new Error('Unauthorized');
      if (!fileUrl) throw new Error('Missing fileUrl.');

      const result = await uploadGroupAvatar({
        groupId: groupId as string,
        userId: req.user.id,
        fileUrl
      });

      res.json(result);
    } catch (e) {
      next(e);
    }
  });

export default router;
