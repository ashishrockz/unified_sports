const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },        // e.g. 'user.ban', 'admin.create', 'sportType.delete'
  target: { type: String },                         // e.g. 'User:664a1f3e...' or 'SportType:...'
  targetModel: { type: String },                    // 'User', 'Room', 'Match', 'SportType'
  targetId: { type: mongoose.Schema.Types.ObjectId },
  details: { type: mongoose.Schema.Types.Mixed },   // any extra info (old status, new status, etc.)
  ip: { type: String },
}, { timestamps: true });

auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ targetModel: 1, targetId: 1 });
auditLogSchema.index({ action: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
