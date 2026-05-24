import express from "express";
import multer from "multer";
import { protect } from "../middleware/authMiddleware.js";
import { predict } from "../controllers/predictController.js";

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/",
  upload.fields([
    { name: "files", maxCount: 10 },
    { name: "images", maxCount: 10 },
    { name: "voice", maxCount: 10 },
  ]),
  protect,
  predict
);

export default router;