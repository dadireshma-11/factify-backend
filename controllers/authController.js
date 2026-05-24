import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/UserModels.js";
import {
  sendLoginAlertEmail,
  sendOtpEmail,
  isEmailConfigured,
} from "../services/emailService.js";
import {
  getClientIp,
  getUserAgent,
  isNewLoginSession,
  updateLoginSession,
} from "../utils/requestMeta.js";
import { generateOtp, hashOtp, verifyOtp as compareOtp } from "../utils/otp.js";

const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured on the server");
  }

  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

const generateOtpSessionToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured on the server");
  }

  return jwt.sign({ id, purpose: "login-otp" }, process.env.JWT_SECRET, {
    expiresIn: "10m",
  });
};

const formatUserResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
});

const completeLogin = async (user, req, res) => {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  if (isNewLoginSession(user, ip, userAgent)) {
    try {
      await sendLoginAlertEmail(user, { ip, userAgent });
    } catch (emailError) {
      console.error("Login alert email failed:", emailError.message);
    }
  }

  await updateLoginSession(user, ip, userAgent);

  return res.status(200).json({
    user: formatUserResponse(user),
    token: generateToken(user._id.toString()),
    requiresOtp: false,
  });
};

export const register = async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name?.trim() || !email?.trim() || !password || !confirmPassword) {
      return res.status(400).json({
        message: "Please fill all fields",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const userExists = await User.findOne({ email: normalizedEmail });

    if (userExists) {
      return res.status(400).json({
        message: "User already exists with this email. Try logging in instead.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);
    await updateLoginSession(user, ip, userAgent);

    return res.status(201).json({
      user: formatUserResponse(user),
      token: generateToken(user._id.toString()),
      requiresOtp: false,
    });
  } catch (error) {
    console.error("Register error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        message: "User already exists with this email. Try logging in instead.",
      });
    }

    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)
        .map((item) => item.message)
        .join(", ");
      return res.status(400).json({ message });
    }

    if (error.message?.includes("JWT_SECRET")) {
      return res.status(500).json({
        message: "Server configuration error. Contact the administrator.",
      });
    }

    return res.status(500).json({
      message:
        process.env.NODE_ENV === "production"
          ? "Registration failed. Please try again later."
          : error.message || "Registration failed. Please try again later.",
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({
        message: "Please enter email and password",
      });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
      "+loginOtpHash +loginOtpExpire"
    );

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (user.settings?.twoFactorAuth) {
      const otp = generateOtp();
      user.loginOtpHash = await hashOtp(otp);
      user.loginOtpExpire = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      try {
        await sendOtpEmail(user, otp);
      } catch (emailError) {
        console.error("OTP email failed:", emailError.message);
        if (isEmailConfigured()) {
          return res.status(500).json({
            message: "Could not send verification email. Try again later.",
          });
        }
      }

      const payload = {
        requiresOtp: true,
        message: "Enter the 6-digit code sent to your email.",
        otpSessionToken: generateOtpSessionToken(user._id.toString()),
        user: formatUserResponse(user),
      };

      if (process.env.NODE_ENV !== "production" && !isEmailConfigured()) {
        payload.devOtp = otp;
      }

      return res.status(200).json(payload);
    }

    return completeLogin(user, req, res);
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: error.message?.includes("JWT_SECRET")
        ? "Server configuration error. Contact the administrator."
        : "Login failed. Please try again later.",
    });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const otp = String(req.body?.otp || "").trim();
    const { otpSessionToken } = req.body;

    if (!email || !otp || !otpSessionToken) {
      return res.status(400).json({
        message: "Email, OTP, and session token are required",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(otpSessionToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        message: "Verification session expired. Please log in again.",
      });
    }

    if (decoded.purpose !== "login-otp") {
      return res.status(401).json({ message: "Invalid verification session" });
    }

    const user = await User.findOne({ email }).select(
      "+loginOtpHash +loginOtpExpire"
    );

    if (!user || user._id.toString() !== decoded.id) {
      return res.status(401).json({ message: "Invalid verification request" });
    }

    if (!user.loginOtpHash || !user.loginOtpExpire) {
      return res.status(400).json({
        message: "No active verification code. Log in again.",
      });
    }

    if (user.loginOtpExpire.getTime() < Date.now()) {
      user.loginOtpHash = null;
      user.loginOtpExpire = null;
      await user.save();
      return res.status(400).json({
        message: "Verification code expired. Log in again.",
      });
    }

    const isValid = await compareOtp(otp, user.loginOtpHash);

    if (!isValid) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    user.loginOtpHash = null;
    user.loginOtpExpire = null;
    await user.save();

    return completeLogin(user, req, res);
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({
      message: "OTP verification failed. Please try again.",
    });
  }
};

const generateResetCode = () =>
  String(Math.floor(100000 + Math.random() * 900000));

export const forgotPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email }).select(
      "+resetPasswordToken +resetPasswordExpire"
    );

    const genericMessage =
      "If an account exists for this email, a reset code has been generated. Check your inbox or use the code shown below in development mode.";

    if (!user) {
      return res.status(200).json({ message: genericMessage });
    }

    const resetCode = generateResetCode();
    const salt = await bcrypt.genSalt(10);
    const hashedCode = await bcrypt.hash(resetCode, salt);

    user.resetPasswordToken = hashedCode;
    user.resetPasswordExpire = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const payload = { message: genericMessage };

    if (process.env.NODE_ENV !== "production") {
      payload.devResetCode = resetCode;
      payload.expiresInMinutes = 15;
    }

    return res.status(200).json(payload);
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      message: "Could not process password reset request",
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const resetCode = String(req.body?.resetCode || "").trim();
    const { newPassword, confirmPassword } = req.body;

    if (!email || !resetCode || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "Email, reset code, and new password are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const user = await User.findOne({ email }).select(
      "+resetPasswordToken +resetPasswordExpire +password"
    );

    if (!user || !user.resetPasswordToken || !user.resetPasswordExpire) {
      return res.status(400).json({
        message: "Invalid or expired reset code. Request a new code.",
      });
    }

    if (user.resetPasswordExpire.getTime() < Date.now()) {
      user.resetPasswordToken = null;
      user.resetPasswordExpire = null;
      await user.save();
      return res.status(400).json({
        message: "Reset code has expired. Request a new code.",
      });
    }

    const isValidCode = await bcrypt.compare(resetCode, user.resetPasswordToken);

    if (!isValidCode) {
      return res.status(400).json({ message: "Invalid reset code" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    await user.save();

    return res.status(200).json({
      message:
        "Password reset successful. You can log in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      message: "Could not reset password. Please try again.",
    });
  }
};
