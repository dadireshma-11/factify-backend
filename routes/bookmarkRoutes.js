import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getBookmarks,
  createBookmark,
  deleteBookmark,
} from "../controllers/bookmarkController.js";

const router = express.Router();

router.get("/", protect, getBookmarks);
router.post("/", protect, createBookmark);
router.delete("/:id", protect, deleteBookmark);

export default router;
