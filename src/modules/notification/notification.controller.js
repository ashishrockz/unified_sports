const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} = require('./notification.service');

/**
 * GET /api/notifications
 */
const getNotificationsHandler = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await getNotifications(req.user._id, { page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/notifications/unread-count
 */
const getUnreadCountHandler = async (req, res, next) => {
  try {
    const count = await getUnreadCount(req.user._id);
    res.json({ unreadCount: count });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/notifications/:id/read
 */
const markAsReadHandler = async (req, res, next) => {
  try {
    const notification = await markAsRead(req.user._id, req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found or already read' });
    }
    res.json(notification);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/notifications/read-all
 */
const markAllAsReadHandler = async (req, res, next) => {
  try {
    const result = await markAllAsRead(req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNotificationsHandler,
  getUnreadCountHandler,
  markAsReadHandler,
  markAllAsReadHandler,
};
