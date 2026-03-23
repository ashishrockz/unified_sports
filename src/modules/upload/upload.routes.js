const router = require('express').Router();
const multer = require('multer');
const { protect } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/admin.middleware');
const { uploadAdMedia } = require('./upload.controller');

// Use memory storage so we can stream the buffer to Cloudinary
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max (video)
});

// POST /api/upload/ad-media — upload image (JPEG/PNG) or video (MP4) for ads
router.post(
  '/ad-media',
  protect,
  requirePermission('settings.update'),
  memoryUpload.single('media'),
  uploadAdMedia,
);

module.exports = router;
