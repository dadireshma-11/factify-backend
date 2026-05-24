import Bookmark from "../models/Bookmark.js";

const formatBookmark = (bookmark) => {
  const doc = bookmark.toObject ? bookmark.toObject() : bookmark;

  return {
    _id: doc._id,
    id: String(doc._id).slice(-6).toUpperCase(),
    userId: doc.userId,
    url: doc.url,
    title: doc.title,
    content: doc.content,
    inputType: doc.inputType,
    result: doc.result,
    confidence: doc.confidence,
    sourceLinks: doc.sourceLinks,
    claimsExtracted: doc.claimsExtracted,
    historyId: doc.historyId,
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
};

export const getBookmarks = async (req, res) => {
  try {
    const bookmarks = await Bookmark.find({ userId: req.user._id }).sort({
      updatedAt: -1,
    });
    res.json(bookmarks.map(formatBookmark));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const createBookmark = async (req, res) => {
  try {
    const {
      url,
      title,
      content,
      inputType,
      result,
      confidence,
      sourceLinks,
      claimsExtracted,
      historyId,
    } = req.body;

    if (!result || confidence === undefined) {
      return res.status(400).json({
        message: "result and confidence are required",
      });
    }

    const normalizedResult =
      result.charAt(0).toUpperCase() + result.slice(1).toLowerCase();
    const allowedResults = ["Real", "Fake", "Uncertain"];

    if (!allowedResults.includes(normalizedResult)) {
      return res.status(400).json({ message: "Invalid result value" });
    }

    const searchQuery = {
      userId: req.user._id,
      $or: [
        { historyId },
        { url: url || "", content: content || "" },
      ],
    };

    const existing = await Bookmark.findOne(searchQuery);

    if (existing) {
      return res.status(200).json(formatBookmark(existing));
    }

    const newBookmark = await Bookmark.create({
      userId: req.user._id,
      url: url || "",
      title: title || "",
      content: content || "",
      inputType: inputType || "text",
      result: normalizedResult,
      confidence: Number(confidence),
      sourceLinks: Array.isArray(sourceLinks) ? sourceLinks : [],
      claimsExtracted: Number(claimsExtracted) || 0,
      historyId,
    });

    res.status(201).json(formatBookmark(newBookmark));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteBookmark = async (req, res) => {
  try {
    const bookmark = await Bookmark.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!bookmark) {
      return res.status(404).json({ message: "Bookmark not found" });
    }

    await Bookmark.deleteOne({ _id: req.params.id });
    res.json({ message: "Bookmark deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
