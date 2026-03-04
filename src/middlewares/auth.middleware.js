const jwt = require('jsonwebtoken');
const User = require('../modules/user/user.model');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized — no token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select('-__v -password');
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized — user not found' });
    }

    // Block deactivated or banned accounts on every request
    if (user.status === 'banned') {
      return res.status(403).json({
        message: 'Your account has been banned. Please contact support.',
      });
    }
    if (user.status === 'inactive') {
      return res.status(403).json({
        message: 'Your account has been deactivated. Please contact support.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized — invalid token' });
  }
};

module.exports = { protect };
