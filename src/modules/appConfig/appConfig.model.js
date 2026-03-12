const mongoose = require('mongoose');

const appConfigSchema = new mongoose.Schema(
  {
    // Singleton key — only one document with key 'active' exists
    key: { type: String, default: 'active', unique: true, immutable: true },

    // Integer version, incremented on every save
    version: { type: Number, default: 1 },

    // ── Maintenance Mode ──────────────────────────────────────
    maintenance: {
      enabled: { type: Boolean, default: false },
      title: { type: String, default: 'Under Maintenance' },
      message: {
        type: String,
        default:
          'We are performing scheduled maintenance. Please try again later.',
      },
      allowedRoles: [
        { type: String, enum: ['admin', 'superadmin'] },
      ],
      estimatedEndTime: { type: Date, default: null },
    },

    // ── Feature Flags ─────────────────────────────────────────
    features: {
      leaderboard: { type: Boolean, default: true },
      friends: { type: Boolean, default: true },
      rooms: { type: Boolean, default: true },
      highlights: { type: Boolean, default: true },
      matchSharing: { type: Boolean, default: true },
      userSearch: { type: Boolean, default: true },
    },

    // ── App Settings ──────────────────────────────────────────
    settings: {
      paginationLimit: { type: Number, default: 20 },
      roomListLimit: { type: Number, default: 5 },
      leaderboardLimit: { type: Number, default: 50 },
      commentaryLimit: { type: Number, default: 50 },
      maxOvers: { type: Number, default: 20 },
      minOvers: { type: Number, default: 1 },
      otpLength: { type: Number, default: 6 },
      otpResendSeconds: { type: Number, default: 60 },
      apiTimeoutMs: { type: Number, default: 60000 },
      socketReconnectAttempts: { type: Number, default: 5 },
      socketReconnectDelayMs: { type: Number, default: 1000 },
    },

    // ── Content / Messages ────────────────────────────────────
    content: {
      termsUrl: { type: String, default: '' },
      privacyUrl: { type: String, default: '' },
      supportEmail: { type: String, default: '' },
      announcement: {
        enabled: { type: Boolean, default: false },
        title: { type: String, default: '' },
        message: { type: String, default: '' },
        type: {
          type: String,
          enum: ['info', 'warning', 'critical'],
          default: 'info',
        },
      },
      forceUpdate: {
        enabled: { type: Boolean, default: false },
        minVersion: { type: String, default: '1.0.0' },
        updateUrl: { type: String, default: '' },
        message: {
          type: String,
          default:
            'A new version is available. Please update to continue.',
        },
      },
    },

    // ── Branding / Theme Overrides ────────────────────────────
    branding: {
      appName: { type: String, default: 'CricCircle' },
      tagline: { type: String, default: '' },
      primaryColor: { type: String, default: '' },
      accentColor: { type: String, default: '' },
      logoUrl: { type: String, default: '' },
    },

    // ── Advertisements / Sponsors ─────────────────────────────
    advertisements: {
      enabled: { type: Boolean, default: false },
      placements: {
        splash: {
          enabled: { type: Boolean, default: false },
          mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
          mediaUrl: { type: String, default: '' },
          linkUrl: { type: String, default: '' },
          sponsorName: { type: String, default: '' },
        },
        homeBanner: {
          enabled: { type: Boolean, default: false },
          mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
          mediaUrl: { type: String, default: '' },
          linkUrl: { type: String, default: '' },
          sponsorName: { type: String, default: '' },
        },
        tossScreen: {
          enabled: { type: Boolean, default: false },
          logoUrl: { type: String, default: '' },
          sponsorName: { type: String, default: '' },
          tagline: { type: String, default: '' },
        },
      },
    },

    // ── Integrations (Twilio SMS + SMTP) ──────────────────────
    integrations: {
      twilio: {
        enabled: { type: Boolean, default: false },
        accountSid: { type: String, default: '' },
        authToken: { type: String, default: '' },
        phoneNumber: { type: String, default: '' },
      },
      smtp: {
        enabled: { type: Boolean, default: false },
        host: { type: String, default: '' },
        port: { type: Number, default: 587 },
        secure: { type: Boolean, default: false },
        user: { type: String, default: '' },
        pass: { type: String, default: '' },
        fromEmail: { type: String, default: '' },
      },
    },

    // ── Metadata ──────────────────────────────────────────────
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

// Auto-increment version on every modification
appConfigSchema.pre('save', function (next) {
  if (this.isModified() && !this.isNew) {
    this.version += 1;
  }
  next();
});

module.exports = mongoose.model('AppConfig', appConfigSchema);
