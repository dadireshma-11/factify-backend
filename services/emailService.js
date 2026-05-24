import { sendEmail, isEmailConfigured } from "../utils/sendEmail.js";

export { isEmailConfigured };

export const sendHighRiskAlertEmail = async (user, payload) => {
  if (!user?.settings?.emailAlerts || !user?.email) return { sent: false };

  const { resultLabel, riskLevel, confidence, preview } = payload;

  try {
    return await sendEmail({
      to: user.email,
      subject: `FACTIFY Alert: ${resultLabel} content detected (${riskLevel} risk)`,
      fromName: "FACTIFY Alerts",
      html: `
        <h2>High-risk content detected</h2>
        <p>Hi ${user.name || "there"},</p>
        <p>Your recent FACTIFY analysis flagged potentially misleading content.</p>
        <ul>
          <li><strong>Verdict:</strong> ${resultLabel}</li>
          <li><strong>Risk level:</strong> ${riskLevel}</li>
          <li><strong>Confidence:</strong> ${confidence}%</li>
        </ul>
        <p><strong>Preview:</strong> ${preview}</p>
        <p>Review the full report in your FACTIFY dashboard.</p>
      `,
    });
  } catch (error) {
    console.error("[FACTIFY] High-risk email failed:", error.message);
    return { sent: false };
  }
};

export const sendLoginAlertEmail = async (user, { ip, userAgent }) => {
  if (!user?.settings?.loginAlerts || !user?.email) return { sent: false };

  try {
    return await sendEmail({
      to: user.email,
      subject: "New login detected on your FACTIFY account",
      fromName: "FACTIFY Security",
      html: `
        <h2>New login detected</h2>
        <p>Hi ${user.name || "there"},</p>
        <p>A new login was detected on your FACTIFY account.</p>
        <ul>
          <li><strong>IP address:</strong> ${ip || "Unknown"}</li>
          <li><strong>Device / browser:</strong> ${userAgent || "Unknown"}</li>
          <li><strong>Time:</strong> ${new Date().toUTCString()}</li>
        </ul>
        <p>If this wasn't you, change your password immediately.</p>
      `,
    });
  } catch (error) {
    console.error("[FACTIFY] Login alert email failed:", error.message);
    return { sent: false };
  }
};

export const sendOtpEmail = async (user, otp) => {
  if (!user?.email) return { sent: false };

  try {
    return await sendEmail({
      to: user.email,
      subject: "Your FACTIFY login verification code",
      fromName: "FACTIFY Security",
      html: `
        <h2>Login verification</h2>
        <p>Hi ${user.name || "there"},</p>
        <p>Your one-time verification code is:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${otp}</p>
        <p>This code expires in 10 minutes. Do not share it with anyone.</p>
      `,
    });
  } catch (error) {
    console.error("[FACTIFY] OTP email failed:", error.message);
    throw error;
  }
};
