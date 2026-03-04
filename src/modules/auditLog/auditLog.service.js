const AuditLog = require('./auditLog.model');

/**
 * Log an admin action.
 * Call this from controllers after successful operations.
 */
const logAction = async ({ actor, action, targetModel, targetId, details, ip }) => {
  try {
    await AuditLog.create({
      actor,
      action,
      target: targetModel && targetId ? `${targetModel}:${targetId}` : undefined,
      targetModel,
      targetId,
      details,
      ip,
    });
  } catch (err) {
    // Audit logging should never break the main flow
    console.error('Audit log failed:', err.message);
  }
};

/**
 * Get paginated audit logs with optional filters.
 */
const getAuditLogs = async ({ action, actorId, targetModel, page = 1, limit = 50 } = {}) => {
  const filter = {};
  if (action) filter.action = { $regex: action, $options: 'i' };
  if (actorId) filter.actor = actorId;
  if (targetModel) filter.targetModel = targetModel;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('actor', 'name email role')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit)),
    AuditLog.countDocuments(filter),
  ]);

  return {
    logs,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

module.exports = { logAction, getAuditLogs };
