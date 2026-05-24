import bcrypt from "bcryptjs";

export const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

export const hashOtp = async (otp) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(otp, salt);
};

export const verifyOtp = async (otp, hash) => bcrypt.compare(otp, hash);
