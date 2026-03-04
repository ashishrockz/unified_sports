/**
 * fail(message, statusCode)
 *
 * Single utility used by every service and middleware to throw HTTP errors.
 * The global error handler in app.js reads err.status to set the response code.
 *
 * Usage:
 *   const { fail } = require('../../utils/AppError');
 *   fail('User not found', 404);
 */
const fail = (message, statusCode) => {
  const err = new Error(message);
  err.status = statusCode;
  throw err;
};

module.exports = { fail };
