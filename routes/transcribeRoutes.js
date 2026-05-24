import express from "express";
import multer from "multer";
import { transcribeAudio } from "../controllers/transcribeController.js";

const router = express.Router();
const upload = multer(); // memory storage

router.post("/", upload.single("file"), transcribeAudio);

export default router;
