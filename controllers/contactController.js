import { sendEmail, isEmailConfigured } from "../utils/sendEmail.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const submitContact = async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const subject = String(req.body?.subject || "").trim();
    const message = String(req.body?.message || "").trim();

    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: name, email, subject, message",
      });
    }

    if (name.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Name must be at least 2 characters",
      });
    }

    if (!emailPattern.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    if (subject.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Subject must be at least 3 characters",
      });
    }

    if (message.length < 10) {
      return res.status(400).json({
        success: false,
        message: "Message must be at least 10 characters",
      });
    }

    if (!isEmailConfigured()) {
      return res.status(500).json({
        success: false,
        message: "Contact email is not configured on the server",
      });
    }

    const inbox = process.env.EMAIL_USER || process.env.SMTP_EMAIL;

    await sendEmail({
      to: inbox,
      replyTo: email,
      fromName: "FACTIFY Contact",
      subject: `[FACTIFY Contact] ${subject}`,
      html: `
        <h2>New contact form submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap;">${message}</p>
        <hr />
        <p style="color:#64748b;font-size:12px;">Sent from FACTIFY contact form</p>
      `,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`,
    });

    return res.status(200).json({
      success: true,
      message: "Message sent successfully! We will get back to you soon.",
    });
  } catch (error) {
    console.error("Contact form error:", error);

    const isAuthError =
      error.message?.includes("Invalid login") ||
      error.message?.includes("BadCredentials");

    return res.status(500).json({
      success: false,
      message: isAuthError
        ? "Email server login failed. Use a Gmail App Password in EMAIL_PASS (not your normal Gmail password)."
        : process.env.NODE_ENV === "production"
          ? "Failed to send message. Please try again later."
          : error.message || "Failed to send message",
    });
  }
};
