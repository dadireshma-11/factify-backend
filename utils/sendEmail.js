import nodemailer from "nodemailer";

let transporter = null;

const cleanEnv = (value = "") =>
  String(value)
    .trim()
    .replace(/^["']|["']$/g, "");

export const getEmailCredentials = () => {
  const user = cleanEnv(process.env.EMAIL_USER || process.env.SMTP_EMAIL);
  // Gmail app passwords are 16 chars; Google often shows them with spaces
  const pass = cleanEnv(
    process.env.EMAIL_PASS || process.env.SMTP_APP_PASSWORD
  ).replace(/\s/g, "");

  return { user, pass };
};

export const isEmailConfigured = () => {
  const { user, pass } = getEmailCredentials();
  return Boolean(user && pass);
};

const createTransporter = () => {
  const { user, pass } = getEmailCredentials();

  if (!user || !pass) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure,
    auth: {
      user,
      pass,
    },
    family: 4,
    tls: {
      rejectUnauthorized: false,
    },
  });
};

const getTransporter = () => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

export const verifyEmailConnection = async () => {
  const mailer = createTransporter();
  if (!mailer) {
    throw new Error("EMAIL_USER and EMAIL_PASS are missing in .env");
  }
  await mailer.verify();
  return true;
};

/**
 * Send email via Gmail SMTP.
 * @param {{ to: string, subject: string, html: string, text?: string, replyTo?: string, fromName?: string }} options
 */
export const sendEmail = async ({
  to,
  subject,
  html,
  text,
  replyTo,
  fromName = "FACTIFY",
}) => {
  const mailer = getTransporter();

  if (!mailer) {
    throw new Error(
      "Email is not configured. Set EMAIL_USER and EMAIL_PASS in server .env"
    );
  }

  const { user } = getEmailCredentials();

  await mailer.sendMail({
    from: `"${fromName}" <${user}>`,
    to,
    replyTo: replyTo || undefined,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, " "),
  });

  return { sent: true };
};
