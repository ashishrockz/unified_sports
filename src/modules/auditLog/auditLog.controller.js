const { getAuditLogs } = require('./auditLog.service');

const getAuditLogsHandler = async (req, res, next) => {
  try {
    const { action, actorId, targetModel, page, limit } = req.query;
    const result = await getAuditLogs({ action, actorId, targetModel, page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = { getAuditLogsHandler };
