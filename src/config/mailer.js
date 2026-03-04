const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || process.env.GMAIL_USER,
    pass: process.env.SMTP_PASS || process.env.GMAIL_PASS,
  },
});

const sendOtpEmail = async (to, otp) => {
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.GMAIL_USER,
    to,
    subject: 'Your Unified Sports OTP',
    text:    `Your OTP is: ${otp}\n\nThis OTP is valid for 10 minutes. Do not share it with anyone.`,
    html:    `<p>Your OTP is: <strong>${otp}</strong></p><p>Valid for 10 minutes. Do not share it.</p>`,
  });
};

const sendPasswordResetEmail = async (to, token, name) => {
  const resetUrl = `${process.env.ADMIN_PORTAL_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: 'Password Reset — Unified Sports Admin',
    text: `Hi ${name || 'Admin'},\n\nYou requested a password reset. Click the link below to reset your password:\n\n${resetUrl}\n\nThis link is valid for 30 minutes.\n\nIf you didn't request this, please ignore this email.`,
    html: `<p>Hi ${name || 'Admin'},</p><p>You requested a password reset. Click the link below:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Valid for 30 minutes. Ignore if you didn't request this.</p>`,
  });
};

const sendWelcomeAdminEmail = async (to, name, tempPassword) => {
  const loginUrl = `${process.env.ADMIN_PORTAL_URL || 'http://localhost:5173'}/login`;
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
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
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: `Account ${status} — Unified Sports`,
    text: `Hi ${name || 'User'},\n\n${statusMessages[status] || `Your account status has been changed to: ${status}`}\n\nIf you believe this is a mistake, please contact support.`,
    html: `<p>Hi ${name || 'User'},</p><p>${statusMessages[status] || `Your account status has been changed to: ${status}`}</p><p>If you believe this is a mistake, please contact support.</p>`,
  });
};

module.exports = { sendOtpEmail, sendPasswordResetEmail, sendWelcomeAdminEmail, sendStatusNotificationEmail };
