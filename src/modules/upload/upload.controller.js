const cloudinary = require('../../config/cloudinary');
const { fail } = require('../../utils/AppError');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png'];
const ALLOWED_VIDEO_TYPES = ['video/mp4'];
const ALL_ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;   // 5 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;   // 50 MB

/**
 * POST /api/upload/ad-media
 * Uploads an image (JPEG/PNG) or video (MP4) to Cloudinary for ad placements.
 * Returns the secure URL and resource details.
 */
const uploadAdMedia = async (req, res, next) => {
  try {
    if (!req.file) {
      throw fail('No file provided', 400);
    }

    const { mimetype, size, buffer } = req.file;

    if (!ALL_ALLOWED_TYPES.includes(mimetype)) {
      throw fail('Only JPEG, PNG images and MP4 videos are allowed', 400);
    }

    const isVideo = ALLOWED_VIDEO_TYPES.includes(mimetype);

    if (isVideo && size > MAX_VIDEO_SIZE) {
      throw fail('Video file size must be under 50 MB', 400);
    }
    if (!isVideo && size > MAX_IMAGE_SIZE) {
      throw fail('Image file size must be under 5 MB', 400);
    }

    const resourceType = isVideo ? 'video' : 'image';

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'circket/ads',
          resource_type: resourceType,
          allowed_formats: isVideo ? ['mp4'] : ['jpg', 'jpeg', 'png'],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      stream.end(buffer);
    });

    res.json({
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { uploadAdMedia };
