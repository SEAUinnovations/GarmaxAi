import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import {
  uploadGarment,
  analyzeGarmentUrl,
  getUserWardrobe,
  updateGarment,
  deleteGarment,
} from "../controllers/garmentController";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

export const garmentRouter = Router();

// All routes require authentication
garmentRouter.use(requireAuth);

// Garment routes
garmentRouter.post("/upload", upload.single("image"), uploadGarment);
garmentRouter.post("/analyze-url", analyzeGarmentUrl);
garmentRouter.get("/wardrobe", getUserWardrobe);
garmentRouter.patch("/:garmentId", updateGarment);
garmentRouter.delete("/:garmentId", deleteGarment);
