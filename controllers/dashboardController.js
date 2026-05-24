import History from "../models/History.js";

export const getDashboardStats = async (req, res) => {
  try {
    const history = await History.find({ userId: req.user._id });

    const total = history.length;
    const fake = history.filter((entry) => entry.result === "Fake").length;
    const real = history.filter((entry) => entry.result === "Real").length;

    res.json({
      total,
      fake,
      real,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
