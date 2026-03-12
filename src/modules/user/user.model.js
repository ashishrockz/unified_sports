const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
  },
  username: {
    type: String,
    unique: true,
    sparse: true,            // allows multiple null values
    trim: true,
    lowercase: true,
    minlength: [3,  'Username must be at least 3 characters'],
    maxlength: [25, 'Username cannot exceed 25 characters'],
    match: [
      /^[a-z0-9_]+$/,
      'Username can only contain lowercase letters, numbers, and underscores',
    ],
  },
  phone: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
  },
  avatar: {
    type: String,
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'superadmin'],
    default: 'user',
  },
  // active   — normal account access
  // inactive — deactivated by admin/superadmin; login blocked
  // banned   — banned by admin/superadmin; login blocked with distinct message
  status: {
    type: String,
    enum: ['active', 'inactive', 'banned'],
    default: 'active',
  },
  password: {
    type: String,
    select: false,
  },
  termsAcceptedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
