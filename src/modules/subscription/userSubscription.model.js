const mongoose = require('mongoose');

// ─── Subscription History Entry ─────────────────────────────────────────────
const historyEntrySchema = new mongoose.Schema({
  planId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
  action:    { type: String, enum: ['subscribed', 'upgraded', 'downgraded', 'renewed', 'expired', 'match_pack'] },
  orderId:   { type: String, default: null },
  paymentId: { type: String, default: null },
  amount:    { type: Number, default: 0 },
  matchPackId: { type: mongoose.Schema.Types.ObjectId, ref: 'MatchPack', default: null },
  matchCount:  { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

// ─── User Subscription ─────────────────────────────────────────────────────
// One document per user — tracks their current plan + extra match credits.

const userSubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active',
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
    default: null, // null = no expiry (free plan)
  },
  razorpayOrderId:   { type: String, default: null },
  razorpayPaymentId: { type: String, default: null },

  // Extra matches purchased via match packs
  extraMatches: {
    type: Number,
    default: 0,
    min: 0,
  },

  history: [historyEntrySchema],
}, { timestamps: true });

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);
