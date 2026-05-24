export const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "Unknown";
};

export const getUserAgent = (req) =>
  String(req.headers["user-agent"] || "Unknown device");

export const isNewLoginSession = (user, ip, userAgent) => {
  if (!user?.lastLoginIp && !user?.lastLoginUserAgent) {
    return false;
  }

  return user.lastLoginIp !== ip || user.lastLoginUserAgent !== userAgent;
};

export const updateLoginSession = async (user, ip, userAgent) => {
  user.lastLoginIp = ip;
  user.lastLoginUserAgent = userAgent;
  await user.save();
};
