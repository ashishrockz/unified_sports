const svc = require('./subscription.service');

// ── User-facing handlers ────────────────────────────────────────────────────

const getPlansHandler = async (req, res, next) => {
  try {
    const plans = await svc.getActivePlans();
    res.json({ plans });
  } catch (err) { next(err); }
};

const getMatchPacksHandler = async (req, res, next) => {
  try {
    const matchPacks = await svc.getActiveMatchPacks();
    res.json({ matchPacks });
  } catch (err) { next(err); }
};

const getMySubscriptionHandler = async (req, res, next) => {
  try {
    const subscription = await svc.getUserSubscription(req.user._id);
    const usage = await svc.getUsageStats(req.user._id);
    res.json({ subscription, usage });
  } catch (err) { next(err); }
};

const createOrderHandler = async (req, res, next) => {
  try {
    const { type, planId, matchPackId } = req.body;
    const result = await svc.createOrder(req.user._id, { type, planId, matchPackId });
    res.json(result);
  } catch (err) { next(err); }
};

const verifyPaymentHandler = async (req, res, next) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const result = await svc.verifyPayment(req.user._id, { razorpayOrderId, razorpayPaymentId, razorpaySignature });
    res.json(result);
  } catch (err) { next(err); }
};

const getMyOrdersHandler = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await svc.getUserOrders(req.user._id, { page, limit });
    res.json(result);
  } catch (err) { next(err); }
};

// ── Admin handlers ──────────────────────────────────────────────────────────

const adminGetAllPlansHandler = async (req, res, next) => {
  try {
    const plans = await svc.getAllPlans();
    res.json({ plans });
  } catch (err) { next(err); }
};

const adminUpdatePlanHandler = async (req, res, next) => {
  try {
    const plan = await svc.updatePlan(req.params.id, req.body, req.user._id);
    res.json({ message: 'Plan updated', plan });
  } catch (err) { next(err); }
};

const adminGetAllMatchPacksHandler = async (req, res, next) => {
  try {
    const matchPacks = await svc.getAllMatchPacks();
    res.json({ matchPacks });
  } catch (err) { next(err); }
};

const adminUpdateMatchPackHandler = async (req, res, next) => {
  try {
    const matchPack = await svc.updateMatchPack(req.params.id, req.body, req.user._id);
    res.json({ message: 'Match pack updated', matchPack });
  } catch (err) { next(err); }
};

const adminGetSubscriptionsHandler = async (req, res, next) => {
  try {
    const { status, planId, search, page, limit } = req.query;
    const result = await svc.getAllSubscriptions({ status, planId, search, page, limit });
    res.json(result);
  } catch (err) { next(err); }
};

const adminGetOrdersHandler = async (req, res, next) => {
  try {
    const { status, type, page, limit } = req.query;
    const result = await svc.getAllOrders({ status, type, page, limit });
    res.json(result);
  } catch (err) { next(err); }
};

const adminGetRevenueStatsHandler = async (req, res, next) => {
  try {
    const stats = await svc.getRevenueStats();
    res.json(stats);
  } catch (err) { next(err); }
};

// ── Super Admin handlers ────────────────────────────────────────────────────

const superadminCreatePlanHandler = async (req, res, next) => {
  try {
    const plan = await svc.createPlan(req.body, req.user._id);
    res.status(201).json({ message: 'Plan created', plan });
  } catch (err) { next(err); }
};

const superadminDeletePlanHandler = async (req, res, next) => {
  try {
    const plan = await svc.deletePlan(req.params.id);
    res.json({ message: 'Plan deactivated', plan });
  } catch (err) { next(err); }
};

const superadminCreateMatchPackHandler = async (req, res, next) => {
  try {
    const matchPack = await svc.createMatchPack(req.body, req.user._id);
    res.status(201).json({ message: 'Match pack created', matchPack });
  } catch (err) { next(err); }
};

const superadminDeleteMatchPackHandler = async (req, res, next) => {
  try {
    const matchPack = await svc.deleteMatchPack(req.params.id);
    res.json({ message: 'Match pack deactivated', matchPack });
  } catch (err) { next(err); }
};

// ── Webhook ─────────────────────────────────────────────────────────────────

const webhookHandler = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const result = await svc.handleWebhook(req.body, signature);
    res.json(result);
  } catch (err) { next(err); }
};

module.exports = {
  // User
  getPlansHandler,
  getMatchPacksHandler,
  getMySubscriptionHandler,
  createOrderHandler,
  verifyPaymentHandler,
  getMyOrdersHandler,
  // Admin
  adminGetAllPlansHandler,
  adminUpdatePlanHandler,
  adminGetAllMatchPacksHandler,
  adminUpdateMatchPackHandler,
  adminGetSubscriptionsHandler,
  adminGetOrdersHandler,
  adminGetRevenueStatsHandler,
  // SuperAdmin
  superadminCreatePlanHandler,
  superadminDeletePlanHandler,
  superadminCreateMatchPackHandler,
  superadminDeleteMatchPackHandler,
  // Webhook
  webhookHandler,
};
