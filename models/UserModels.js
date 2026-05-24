import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const settingsSchema = new mongoose.Schema(
  {
    emailAlerts: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: false },
    twoFactorAuth: { type: Boolean, default: false },
    loginAlerts: { type: Boolean, default: true },
    darkMode: { type: Boolean, default: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },
    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    settings: {
      type: settingsSchema,
      default: () => ({}),
    },
    resetPasswordToken: {
      type: String,
      default: null,
      select: false,
    },
    resetPasswordExpire: {
      type: Date,
      default: null,
      select: false,
    },
    loginOtpHash: {
      type: String,
      default: null,
      select: false,
    },
    loginOtpExpire: {
      type: Date,
      default: null,
      select: false,
    },
    lastLoginIp: {
      type: String,
      default: null,
    },
    lastLoginUserAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
