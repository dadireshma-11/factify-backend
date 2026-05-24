import dotenv from "dotenv";
import {
  sendEmail,
  isEmailConfigured,
  getEmailCredentials,
  verifyEmailConnection,
} from "../utils/sendEmail.js";

dotenv.config();

const printGmailHelp = () => {
  console.log(`
Gmail SMTP setup (required for FACTIFY email):

1. Open https://myaccount.google.com/security
2. Turn ON "2-Step Verification" for your Google account
3. Open https://myaccount.google.com/apppasswords
   (If missing, finish 2-Step Verification first)
4. Create App password → choose "Mail" → device "Other (FACTIFY)"
5. Copy the 16-character password (example: abcd efgh ijkl mnop)
6. In server/.env set:
   EMAIL_USER=your.full@gmail.com
   EMAIL_PASS=abcdefghijklmnop
   (no quotes, no spaces in the password)

7. Restart the server and run: npm run test:email

Your normal Gmail password will NOT work for SMTP.
`);
};

const run = async () => {
  if (!isEmailConfigured()) {
    console.error("Missing EMAIL_USER or EMAIL_PASS in server/.env");
    printGmailHelp();
    process.exit(1);
  }

  const { user, pass } = getEmailCredentials();

  console.log("Checking configuration...");
  console.log("  EMAIL_USER:", user);
  console.log("  EMAIL_PASS length:", pass.length, "characters");

  if (pass.length !== 16) {
    console.warn(
      "  Warning: Gmail App Passwords are usually exactly 16 characters.",
    );
    console.warn(
      "  If you used your normal Gmail password, create an App Password instead.",
    );
  }

  try {
    console.log("\nVerifying SMTP connection...");
    await verifyEmailConnection();
    console.log("  SMTP login OK");

    await sendEmail({
      to: user,
      fromName: "FACTIFY Contact",
      subject: "[FACTIFY] Contact email test",
      html: "<p>If you received this, Gmail SMTP is working for FACTIFY.</p>",
    });

    console.log("\nTest email sent successfully to", user);
  } catch (error) {
    console.error("\nTest email failed:", error.message);

    if (
      error.message?.includes("Invalid login") ||
      error.message?.includes("BadCredentials")
    ) {
      printGmailHelp();
    }

    process.exit(1);
  }
};

run();
