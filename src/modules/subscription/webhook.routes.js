const router = require('express').Router();
const { webhookHandler } = require('./subscription.controller');

/**
 * @swagger
 * /api/webhooks/razorpay:
 *   post:
 *     summary: Razorpay webhook endpoint
 *     description: >
 *       Receives payment events from Razorpay (payment.captured, payment.failed).
 *       Verifies the webhook signature using RAZORPAY_WEBHOOK_SECRET.
 *       **No auth required** — secured via HMAC signature instead.
 *     tags: [Webhook]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed
 *       400:
 *         description: Invalid signature
 */
router.post('/razorpay', webhookHandler);

module.exports = router;
