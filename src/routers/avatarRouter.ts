import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getUserAvatars,
  createAvatar,
  deleteAvatar,
} from "../controllers/avatarController";

export const avatarRouter = Router();

// All routes require authentication
avatarRouter.use(requireAuth);

// Avatar routes
avatarRouter.get("/", getUserAvatars);
avatarRouter.post("/create", createAvatar);
avatarRouter.delete("/:avatarId", deleteAvatar);
