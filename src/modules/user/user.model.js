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
  avatarChangedAt: {
    type: Date,
    default: null,
  },
  role: {
    type: String,
    enum: ['user', 'super_admin', 'admin', 'manager', 'editor', 'viewer'],
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

  // ── Location (GeoJSON Point) ────────────────────────────────
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],   // [longitude, latitude]
      default: [0, 0],
    },
    city:        { type: String, default: '' },
    state:       { type: String, default: '' },
    country:     { type: String, default: '' },
    countryCode: { type: String, default: '' }, // ISO 3166-1 alpha-2 e.g. 'IN', 'US'
  },
}, { timestamps: true });

// Geospatial index for $near queries (local leaderboards)
userSchema.index({ 'location': '2dsphere' });

// Fast country-scoped lookups
userSchema.index({ 'location.countryCode': 1 });

module.exports = mongoose.model('User', userSchema);
