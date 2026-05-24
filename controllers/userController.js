import bcrypt from "bcryptjs";
import User from "../models/UserModels.js";
import { sendEmail, isEmailConfigured } from "../utils/sendEmail.js";

const formatSettings = (settings = {}) => ({
  emailAlerts: settings.emailAlerts !== false,
  pushNotifications: Boolean(settings.pushNotifications),
  twoFactorAuth: Boolean(settings.twoFactorAuth),
  loginAlerts: settings.loginAlerts !== false,
  darkMode: settings.darkMode !== false,
});

export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        bio: user.bio || "",
        settings: formatSettings(user.settings),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUserSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("settings");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ settings: formatSettings(user.settings) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateUserSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const allowed = [
      "emailAlerts",
      "pushNotifications",
      "twoFactorAuth",
      "loginAlerts",
      "darkMode",
    ];

    if (!user.settings) {
      user.settings = {};
    }

    allowed.forEach((key) => {
      if (typeof req.body[key] === "boolean") {
        user.settings[key] = req.body[key];
      }
    });

    user.markModified("settings");
    await user.save();

    return res.json({
      message: "Settings updated successfully",
      settings: formatSettings(user.settings),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const sendTestEmail = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("email name settings");

    if (!user?.email) {
      return res.status(400).json({ message: "No email address found for user." });
    }

    if (!isEmailConfigured()) {
      return res.status(500).json({ message: "Email service is not configured on the server." });
    }

    await sendEmail({
      to: user.email,
      fromName: "FACTIFY Test",
      subject: "FACTIFY email delivery test",
      html: `
        <h2>FACTIFY Email Test</h2>
        <p>Hi ${user.name || "there"},</p>
        <p>This is a test email to verify that FACTIFY SMTP is working.</p>
        <p>If you received this, your email alerts are configured correctly.</p>
      `,
      text: `Hi ${user.name || "there"},\n\nThis is a test email to verify that FACTIFY SMTP is working.\n\nIf you received this, your email alerts are configured correctly.`,
    });

    return res.json({ message: "Test email sent successfully." });
  } catch (error) {
    console.error("Test email failed:", error);
    return res.status(500).json({
      message:
        error.message?.includes("Invalid login") ||
        error.message?.includes("BadCredentials")
          ? "Email server login failed. Use a Gmail App Password in EMAIL_PASS (not your normal Gmail password)."
          : error.message || "Failed to send test email.",
    });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const { name, email, bio } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ message: "Name cannot be empty" });
      }
      user.name = name.trim();
    }

    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        return res.status(400).json({ message: "Email cannot be empty" });
      }

      const existing = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: user._id },
      });

      if (existing) {
        return res.status(400).json({ message: "Email already in use" });
      }

      user.email = normalizedEmail;
    }

    if (bio !== undefined) {
      user.bio = bio.trim();
    }

    await user.save();

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        bio: user.bio || "",
        settings: formatSettings(user.settings),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "Please fill all password fields" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New passwords do not match" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await user.matchPassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
