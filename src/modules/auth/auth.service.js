const jwt         = require('jsonwebtoken');
const Otp         = require('./otp.model');
const User        = require('../user/user.model');
const { sendOtpEmail } = require('../../config/mailer');
const { sendSms }      = require('../../config/sms');
const { fail }         = require('../../utils/AppError');

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

/**
 * Send OTP to a phone or email.
 * Admins/superadmins do NOT use OTP; they use /api/admin/login.
 */
const sendOtp = async (identifier, type) => {
  const otp       = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await Otp.deleteMany({ identifier, used: false });
  await Otp.create({ identifier, type, otp, expiresAt });

  if (type === 'phone') {
    try {
      const result = await sendSms(identifier, `Your CricCircle OTP is: ${otp}. Valid for 10 minutes.`);
      if (!result.success) {
        console.log(`[SMS OTP] Twilio disabled. Phone: ${identifier} | OTP: ${otp}`);
      }
    } catch (err) {
      console.error('[SMS OTP ERROR]', err.message);
      fail('Failed to send OTP via SMS. Please try again.', 500);
    }
  } else if (type === 'email') {
    try {
      await sendOtpEmail(identifier, otp);
    } catch (err) {
      console.error('[EMAIL OTP ERROR]', err.message);
      fail('Failed to send OTP email. Please try again.', 500);
    }
  }

  return { message: 'OTP sent successfully' };
};

/**
 * Verify OTP and issue JWT.
 * Creates user if not found.
 */
const verifyOtp = async (identifier, type, otp) => {
  const record = await Otp.findOne({
    identifier,
    type,
    used: false,
    expiresAt: { $gt: new Date() },
  });

  if (!record)           fail('OTP not found or expired', 400);
  if (record.otp !== otp) fail('Invalid OTP', 400);

  record.used = true;
  await record.save();

  // Find or create user
  const query = type === 'phone'
    ? { phone: identifier }
    : { email: identifier };

  let user = await User.findOne(query);
  if (!user) {
    user = await User.create({ ...query, role: 'user', status: 'active' });
  }

  const token = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return { token, user };
};

module.exports = { sendOtp, verifyOtp };
