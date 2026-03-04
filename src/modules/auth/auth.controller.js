const { sendOtp, verifyOtp } = require('./auth.service');

const sendOtpHandler = async (req, res, next) => {
  try {
    const { identifier, type } = req.body;

    if (!identifier || !type) {
      return res.status(400).json({ message: 'identifier and type are required' });
    }
    if (!['phone', 'email'].includes(type)) {
      return res.status(400).json({ message: 'type must be phone or email' });
    }

    const result = await sendOtp(identifier, type);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const verifyOtpHandler = async (req, res, next) => {
  try {
    const { identifier, type, otp } = req.body;

    if (!identifier || !type || !otp) {
      return res.status(400).json({ message: 'identifier, type, and otp are required' });
    }
    if (!['phone', 'email'].includes(type)) {
      return res.status(400).json({ message: 'type must be phone or email' });
    }

    const result = await verifyOtp(identifier, type, otp);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = { sendOtpHandler, verifyOtpHandler };
