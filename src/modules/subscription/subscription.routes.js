const router = require('express').Router();
const { protect } = require('../../middlewares/auth.middleware');
const {
  getPlansHandler,
  getMatchPacksHandler,
  getMySubscriptionHandler,
  createOrderHandler,
  verifyPaymentHandler,
  getMyOrdersHandler,
} = require('./subscription.controller');

// All subscription routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/subscriptions/plans:
 *   get:
 *     summary: List active subscription plans
 *     description: Returns all active plans sorted by display order.
 *     tags: [Subscription]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of plans
 */
router.get('/plans', getPlansHandler);

/**
 * @swagger
 * /api/subscriptions/match-packs:
 *   get:
 *     summary: List active match packs
 *     description: Returns one-time purchasable match packs.
 *     tags: [Subscription]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of match packs
 */
router.get('/match-packs', getMatchPacksHandler);

/**
 * @swagger
 * /api/subscriptions/me:
 *   get:
 *     summary: Get my subscription
 *     description: Returns current plan, subscription status, usage stats (matches today/week), and extra match balance.
 *     tags: [Subscription]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription details + usage
 */
router.get('/me', getMySubscriptionHandler);

/**
 * @swagger
 * /api/subscriptions/create-order:
 *   post:
 *     summary: Create a Razorpay order
 *     description: >
 *       Creates a Razorpay order for either a subscription upgrade or a match pack purchase.
 *       Returns the Razorpay order ID to open the checkout on the client.
 *     tags: [Subscription]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [subscription, match_pack]
 *               planId:
 *                 type: string
 *                 description: Required when type is subscription
 *               matchPackId:
 *                 type: string
 *                 description: Required when type is match_pack
 *     responses:
 *       200:
 *         description: Razorpay order created
 */
router.post('/create-order', createOrderHandler);

/**
 * @swagger
 * /api/subscriptions/verify-payment:
 *   post:
 *     summary: Verify Razorpay payment
 *     description: >
 *       Verifies the Razorpay payment signature and activates the subscription
 *       or credits extra matches from a match pack.
 *     tags: [Subscription]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razorpayOrderId, razorpayPaymentId, razorpaySignature]
 *             properties:
 *               razorpayOrderId:
 *                 type: string
 *               razorpayPaymentId:
 *                 type: string
 *               razorpaySignature:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment verified and subscription/pack activated
 *       400:
 *         description: Invalid signature
 */
router.post('/verify-payment', verifyPaymentHandler);

/**
 * @swagger
 * /api/subscriptions/orders:
 *   get:
 *     summary: My order history
 *     description: Returns paginated list of my past orders.
 *     tags: [Subscription]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated orders
 */
router.get('/orders', getMyOrdersHandler);

module.exports = router;
