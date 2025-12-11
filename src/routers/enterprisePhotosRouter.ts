import { Router } from 'express';
import multer from 'multer';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import { rateLimiter, customRateLimiter } from '../middleware/rateLimiter';
import { scopeValidator } from '../middleware/scopeValidator';
import { usageLogger } from '../middleware/usageLogger';
import {
  uploadEnterprisePhoto,
  listCustomerPhotos,
  getEnterprisePhoto
} from '../controllers/enterprisePhotoController';

const router = Router();

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// All photo routes require API key authentication
router.use(apiKeyAuth);
router.use(usageLogger);

/**
 * @route POST /api/v1/photos
 * @desc Upload customer photo for virtual try-on
 * @scope photos:upload
 * @access API Key with photos:upload scope
 */
router.post(
  '/',
  customRateLimiter(10), // 10 uploads per minute
  scopeValidator(['photos:upload']),
  upload.single('photo'),
  uploadEnterprisePhoto
);

/**
 * @route GET /api/v1/photos/:photoId
 * @desc Get photo details
 * @scope photos:read
 * @access API Key with photos:read scope
 */
router.get(
  '/:photoId',
  rateLimiter,
  scopeValidator(['photos:read']),
  getEnterprisePhoto
);

/**
 * @route GET /api/v1/customers/:externalCustomerId/photos
 * @desc List photos for a customer
 * @scope photos:read
 * @access API Key with photos:read scope
 */
router.get(
  '/customers/:externalCustomerId/photos',
  rateLimiter,
  scopeValidator(['photos:read']),
  listCustomerPhotos
);

export default router;
