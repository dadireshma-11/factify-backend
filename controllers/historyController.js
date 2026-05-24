import History from "../models/History.js";

function formatHistoryRecord(record) {
  const doc = record.toObject ? record.toObject() : record;

  return {
    _id: doc._id,
    id: String(doc._id).slice(-6).toUpperCase(),
    userId: doc.userId,
    url: doc.url,
    content: doc.content,
    inputType: doc.inputType,
    result: doc.result,
    confidence: doc.confidence,
    trustedSources: doc.trustedSources,
    suspiciousSources: doc.suspiciousSources,
    claimsExtracted: doc.claimsExtracted,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    date: doc.createdAt
      ? new Date(doc.createdAt).toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "",
  };
}

export const getHistory = async (req, res) => {
  try {
    const history = await History.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });

    res.json(history.map(formatHistoryRecord));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const createHistory = async (req, res) => {
  try {
    const { url, result, confidence, content, inputType } = req.body;

    if (!url || !result || confidence === undefined) {
      return res.status(400).json({
        message: "url, result, and confidence are required",
      });
    }

    const normalizedResult =
      result.charAt(0).toUpperCase() + result.slice(1).toLowerCase();
    const allowedResults = ["Real", "Fake", "Uncertain"];

    if (!allowedResults.includes(normalizedResult)) {
      return res.status(400).json({ message: "Invalid result value" });
    }

    const newHistory = await History.create({
      userId: req.user._id,
      url,
      content: content || "",
      inputType: inputType || "text",
      result: normalizedResult,
      confidence: Number(confidence),
    });

    res.status(201).json(formatHistoryRecord(newHistory));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteHistory = async (req, res) => {
  try {
    const history = await History.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!history) {
      return res.status(404).json({ message: "History not found" });
    }

    await History.deleteOne({ _id: req.params.id });

    res.json({ message: "History deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const clearAllHistory = async (req, res) => {
  try {
    await History.deleteMany({ userId: req.user._id });

    res.json({ message: "All history cleared" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
