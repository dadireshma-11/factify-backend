import mongoose from "mongoose";

const historySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    url: {
      type: String,
      required: true,
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

    trustedSources: {
      type: [String],
      default: [],
    },

    suspiciousSources: {
      type: [String],
      default: [],
    },

    claimsExtracted: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("History", historySchema);
