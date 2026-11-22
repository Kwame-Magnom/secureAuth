import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const gmailUser = process.env.GMAIL_USER || '';
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD || '';

// Configure transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailUser,
    pass: gmailAppPassword,
  },
});

/**
 * Sends a 2FA verification code via Gmail SMTP.
 */
export async function sendOTPEmail(toEmail: string, otpCode: string, fullName: string): Promise<boolean> {
  if (!gmailUser || !gmailAppPassword) {
    console.warn(`⚠️ Gmail SMTP credentials not configured. Mocking 2FA email for ${toEmail}. OTP Code: ${otpCode}`);
    return true; // Return true in mock/dev mode so login flow can proceed even if SMTP isn't set yet
  }

  try {
    const mailOptions = {
      from: `"SecureAuth Security" <${gmailUser}>`,
      to: toEmail,
      subject: 'Your SecureAuth Two-Factor Authentication (2FA) Code',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #0f172a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">SecureAuth Security Verification</h2>
          <p>Hello <strong>${fullName}</strong>,</p>
          <p>A login request was initiated for your SecureAuth account. Please use the secure one-time verification code below to complete your sign-in:</p>
          <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; padding: 15px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1e3a8a; margin: 20px 0; border-radius: 6px;">
            ${otpCode}
          </div>
          <p style="color: #64748b; font-size: 14px;">This code will expire in <strong>5 minutes</strong> and can only be used once.</p>
          <p style="color: #64748b; font-size: 14px;">If you did not attempt to log in, please contact your system administrator immediately and secure your account.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">SecureAuth Access Control Management System &bull; Automated Security Dispatch</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Failed to send OTP email via Gmail SMTP:', error);
    return false;
  }
}
