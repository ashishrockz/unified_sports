const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    // The user who receives this notification
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // The user who triggered the action (optional — system notifications have no actor)
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    type: {
      type: String,
      enum: [
        // Match events
        'match_completed',
        'added_to_match',

        // Friend events
        'friend_request_received',
        'friend_request_accepted',
        'friend_request_rejected',
      ],
      required: true,
    },

    // Human-readable message
    title: { type: String, required: true },
    body: { type: String, required: true },

    // Optional reference to related resources
    data: {
      matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', default: null },
      roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
      friendshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Friend', default: null },
    },

    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Fast query: unread notifications for a user, newest first
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
