import mongoose from "mongoose";

const bookmarkSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    url: {
      type: String,
      default: "",
    },
    title: {
      type: String,
      default: "",
    },
    content: {
      type: String,
      default: "",
    },
    inputType: {
      type: String,
      enum: ["url", "text"],
      default: "text",
    },
    result: {
      type: String,
      enum: ["Real", "Fake", "Uncertain"],
      required: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    sourceLinks: {
      type: [String],
      default: [],
    },
    claimsExtracted: {
      type: Number,
      default: 0,
    },
    historyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "History",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Bookmark", bookmarkSchema);
