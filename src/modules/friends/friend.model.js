const mongoose = require('mongoose');

/**
 * Friendship document — tracks the full lifecycle of a connection between two users.
 *
 * Status machine:
 *   (none) ──send──► pending ──accept──► accepted ──unfriend──► (deleted)
 *                        │                  │
 *                     reject              block
 *                        ▼                  ▼
 *                    rejected            blocked ──unblock──► (deleted)
 *
 * Additional rules:
 *  - A rejected sender may re-request; the document is reused (status → pending).
 *  - Either party can block regardless of current status.
 *  - Only the blocker can unblock (document deleted on unblock).
 *  - The unique index on [requester, recipient] prevents duplicate documents;
 *    bidirectional checks are done in the service layer.
 */
const friendSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'blocked'],
      default: 'pending',
    },
    // Populated only when status === 'blocked'; tracks who initiated the block.
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Prevents duplicate documents for the same ordered pair
friendSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// Fast lookup: find all connections involving a user
friendSchema.index({ recipient: 1, status: 1 });
friendSchema.index({ requester: 1, status: 1 });

module.exports = mongoose.model('Friend', friendSchema);
