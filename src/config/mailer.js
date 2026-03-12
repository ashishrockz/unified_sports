const nodemailer = require('nodemailer');
const { Resend } = require('resend');

// ── Email provider selection ──────────────────────────────
// Uses Resend (HTTPS API) when RESEND_API_KEY is set — works on Render/cloud.
// Falls back to SMTP (nodemailer) for local dev.
const resendKey = () => process.env.RESEND_API_KEY;
const emailFrom = () => process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@criccircle.com';
const appName = () => process.env.APP_NAME || 'CricCircle';

// ── SMTP fallback ─────────────────────────────────────────
let _smtpTransporter = null;
const getSmtpTransporter = () => {
  if (_smtpTransporter) return _smtpTransporter;
  _smtpTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: (process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return _smtpTransporter;
};

// ── Unified send function ─────────────────────────────────
const sendMail = async ({ to, subject, html, text }) => {
  if (resendKey()) {
    const resend = new Resend(resendKey());
    const { data, error } = await resend.emails.send({
      from: `${appName()} <${emailFrom()}>`,
      to,
      subject,
      html,
      text,
    });
    if (error) throw new Error(error.message);
    console.log('[MAILER] Sent via Resend to', to, '| id:', data?.id);
    return data;
  }

  // SMTP fallback (local dev)
  console.log('[MAILER] Sending via SMTP to', to);
  const info = await getSmtpTransporter().sendMail({
    from: `"${appName()}" <${emailFrom()}>`,
    to,
    subject,
    html,
    text,
  });
  console.log('[MAILER] Sent via SMTP to', to, '| messageId:', info.messageId);
  return info;
};

// ── OTP email ─────────────────────────────────────────────
const sendOtpEmail = async (to, otp) => {
  const name = appName();
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Login OTP</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 520px; margin: 40px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1a472a 0%, #2d6a4f 100%); padding: 28px 32px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 24px; letter-spacing: 1px; }
    .header p { color: #a8d5b5; margin: 6px 0 0; font-size: 13px; }
    .body { padding: 32px; }
    .body p { color: #444; font-size: 15px; line-height: 1.6; }
    .otp-box { background: #f0f7f2; border: 2px dashed #2d6a4f; border-radius: 8px; text-align: center; padding: 20px; margin: 24px 0; }
    .otp-code { font-size: 44px; font-weight: 900; letter-spacing: 12px; color: #1a472a; font-family: 'Courier New', monospace; }
    .otp-note { font-size: 12px; color: #888; margin-top: 8px; }
    .footer { background: #f9f9f9; border-top: 1px solid #eee; padding: 16px 32px; text-align: center; }
    .footer p { font-size: 12px; color: #aaa; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${name}</h1>
      <p>Login Request</p>
    </div>
    <div class="body">
      <p>Hi there,</p>
      <p>You requested a <strong>Login</strong> OTP. Use the code below to proceed:</p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <div class="otp-note">Valid for <strong>10 minutes</strong> &bull; Do not share this code</div>
      </div>
      <p>If you didn't request this, please ignore this email.</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${name}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `Your Login OTP is: ${otp}\n\nValid for 10 minutes. Do not share this code.`;

  await sendMail({
    to,
    subject: `[${name}] Your Login OTP: ${otp}`,
    html,
    text,
  });
};

// ── Admin emails ──────────────────────────────────────────
const sendPasswordResetEmail = async (to, token, name) => {
  const resetUrl = `${process.env.ADMIN_PORTAL_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
  await sendMail({
    to,
    subject: 'Password Reset — Unified Sports Admin',
    text: `Hi ${name || 'Admin'},\n\nYou requested a password reset. Click the link below to reset your password:\n\n${resetUrl}\n\nThis link is valid for 30 minutes.\n\nIf you didn't request this, please ignore this email.`,
    html: `<p>Hi ${name || 'Admin'},</p><p>You requested a password reset. Click the link below:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Valid for 30 minutes. Ignore if you didn't request this.</p>`,
  });
};

const sendWelcomeAdminEmail = async (to, name, tempPassword) => {
  const loginUrl = `${process.env.ADMIN_PORTAL_URL || 'http://localhost:5173'}/login`;
  await sendMail({
    to,
    subject: 'Welcome to Unified Sports Admin Portal',
    text: `Hi ${name},\n\nYour admin account has been created.\n\nLogin at: ${loginUrl}\nEmail: ${to}\nTemporary password: ${tempPassword}\n\nPlease change your password after first login.`,
    html: `<p>Hi ${name},</p><p>Your admin account has been created.</p><p>Login at: <a href="${loginUrl}">${loginUrl}</a></p><p>Email: ${to}<br/>Temporary password: <strong>${tempPassword}</strong></p><p>Please change your password after first login.</p>`,
  });
};

const sendStatusNotificationEmail = async (to, name, status) => {
  const statusMessages = {
    banned: 'Your account has been banned from Unified Sports.',
    active: 'Your account on Unified Sports has been reactivated.',
    inactive: 'Your account on Unified Sports has been deactivated.',
  };
  await sendMail({
    to,
    subject: `Account ${status} — Unified Sports`,
    text: `Hi ${name || 'User'},\n\n${statusMessages[status] || `Your account status has been changed to: ${status}`}\n\nIf you believe this is a mistake, please contact support.`,
    html: `<p>Hi ${name || 'User'},</p><p>${statusMessages[status] || `Your account status has been changed to: ${status}`}</p><p>If you believe this is a mistake, please contact support.</p>`,
  });
};

const testSmtpConnection = async (to) => {
  await sendMail({
    to,
    subject: 'CricCircle SMTP Test',
    text: 'This is a test email. Your email integration is working correctly!',
    html: '<p>This is a test email. Your <strong>email integration</strong> is working correctly!</p>',
  });
  return { success: true };
};

module.exports = { sendOtpEmail, sendPasswordResetEmail, sendWelcomeAdminEmail, sendStatusNotificationEmail, testSmtpConnection };
