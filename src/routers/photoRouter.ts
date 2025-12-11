import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import multer from "multer";
import {
  uploadPhoto,
  getUserPhotos,
  getPhoto,
  deletePhoto,
} from "../controllers/photoController";

export const photoRouter = Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'));
      return;
    }
    cb(null, true);
  },
});

// All routes require authentication
photoRouter.use(requireAuth);

/**
 * @swagger
 * /tryon/photos/upload:
 *   post:
 *     tags: [Photos]
 *     summary: Upload a photo for virtual try-on
 *     description: Uploads a user photo and triggers SMPL processing
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [photo]
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: The photo file (JPG, PNG, WebP)
 *               photoType:
 *                 type: string
 *                 enum: [front, side, full-body]
 *                 default: front
 *                 description: The type/angle of the photo
 *     responses:
 *       201:
 *         description: Photo uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "550e8400-e29b-41d4-a716-446655440000"
 *                 url:
 *                   type: string
 *                   example: "https://bucket.s3.amazonaws.com/user-photos/..."
 *                 thumbnailUrl:
 *                   type: string
 *                 type:
 *                   type: string
 *                 uploadedAt:
 *                   type: string
 *                   format: date-time
 *                 processed:
 *                   type: boolean
 *       400:
 *         description: No file provided or invalid file type
 *       401:
 *         description: Not authenticated
 */
photoRouter.post("/upload", upload.single('photo'), uploadPhoto);

/**
 * @swagger
 * /tryon/photos:
 *   get:
 *     tags: [Photos]
 *     summary: Get user's uploaded photos
 *     description: Retrieves all photos uploaded by the authenticated user
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of user photos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 photos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       url:
 *                         type: string
 *                       thumbnailUrl:
 *                         type: string
 *                       type:
 *                         type: string
 *                       uploadedAt:
 *                         type: string
 *                       processed:
 *                         type: boolean
 *       401:
 *         description: Not authenticated
 */
photoRouter.get("/", getUserPhotos);

/**
 * @swagger
 * /tryon/photos/{photoId}:
 *   get:
 *     tags: [Photos]
 *     summary: Get specific photo details
 *     description: Retrieves details of a specific photo including SMPL data if processed
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: photoId
 *         required: true
 *         schema:
 *           type: string
 *         description: The photo ID
 *     responses:
 *       200:
 *         description: Photo details
 *       404:
 *         description: Photo not found
 *       401:
 *         description: Not authenticated
 */
photoRouter.get("/:photoId", getPhoto);

/**
 * @swagger
 * /tryon/photos/{photoId}:
 *   delete:
 *     tags: [Photos]
 *     summary: Delete a photo
 *     description: Deletes a photo from S3 and database
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: photoId
 *         required: true
 *         schema:
 *           type: string
 *         description: The photo ID
 *     responses:
 *       200:
 *         description: Photo deleted successfully
 *       404:
 *         description: Photo not found
 *       401:
 *         description: Not authenticated
 */
photoRouter.delete("/:photoId", deletePhoto);
