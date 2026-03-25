const mongoose = require('mongoose');

// ─── Match Pack ─────────────────────────────────────────────────────────────
// One-time purchase packs that give extra matches beyond the plan limit.
// e.g. "1 Match for Rs 9", "5 Matches for Rs 39"

const matchPackSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  matchCount: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
    min: 1,
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('MatchPack', matchPackSchema);
