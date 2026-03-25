const mongoose = require('mongoose');

// ─── Plan ───────────────────────────────────────────────────────────────────
// Defines a subscription tier (Free / Pro / Max / custom).
// SuperAdmin creates plans; Admin can edit them.

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true,
  },
  interval: {
    type: String,
    enum: ['monthly', 'yearly', 'lifetime'],
    default: 'monthly',
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  sortOrder: {
    type: Number,
    default: 0,
  },

  // ── Usage limits ────────────────────────────────────────────
  limits: {
    matchesPerDay:     { type: Number, default: 1 },   // -1 = unlimited
    matchesPerWeek:    { type: Number, default: 4 },    // -1 = unlimited
    matchHistoryCount: { type: Number, default: 3 },    // max visible past matches
  },

  // ── Feature flags ───────────────────────────────────────────
  features: {
    adFree:     { type: Boolean, default: false },
    commentary: { type: Boolean, default: false },
    analytics:  { type: Boolean, default: false },
  },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('Plan', planSchema);
