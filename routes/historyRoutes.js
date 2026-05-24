import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getHistory,
  createHistory,
  deleteHistory,
  clearAllHistory,
} from "../controllers/historyController.js";

const router = express.Router();

router.get("/", protect, getHistory);
router.post("/", protect, createHistory);
router.delete("/", protect, clearAllHistory);
router.delete("/:id", protect, deleteHistory);

export default router;
