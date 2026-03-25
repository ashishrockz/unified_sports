const crypto = require('crypto');
const getRazorpay      = require('../../config/razorpay');
const Plan             = require('./plan.model');
const MatchPack        = require('./matchPack.model');
const UserSubscription = require('./userSubscription.model');
const Order            = require('./order.model');
const Room             = require('../room/room.model');
const { fail }         = require('../../utils/AppError');

// ── Helpers ─────────────────────────────────────────────────────────────────

const startOfDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfWeek = () => {
  const d = new Date();
  const day = d.getDay(); // 0 = Sun
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};

// ── Plans CRUD ──────────────────────────────────────────────────────────────

const getActivePlans = async () => {
  return Plan.find({ isActive: true }).sort({ sortOrder: 1 });
};

const getAllPlans = async () => {
  return Plan.find().sort({ sortOrder: 1 });
};

const getPlanById = async (planId) => {
  const plan = await Plan.findById(planId);
  if (!plan) fail('Plan not found', 404);
  return plan;
};

const createPlan = async (data, createdBy) => {
  // Ensure only one default plan
  if (data.isDefault) {
    await Plan.updateMany({ isDefault: true }, { isDefault: false });
  }
  return Plan.create({ ...data, createdBy });
};

const updatePlan = async (planId, data, updatedBy) => {
  if (data.isDefault) {
    await Plan.updateMany({ isDefault: true, _id: { $ne: planId } }, { isDefault: false });
  }
  const plan = await Plan.findByIdAndUpdate(planId, { ...data, updatedBy }, { new: true });
  if (!plan) fail('Plan not found', 404);
  return plan;
};

const deletePlan = async (planId) => {
  const plan = await Plan.findById(planId);
  if (!plan) fail('Plan not found', 404);
  if (plan.isDefault) fail('Cannot delete the default plan', 400);

  // Soft-delete: deactivate instead of removing
  plan.isActive = false;
  await plan.save();
  return plan;
};

// ── Match Packs CRUD ────────────────────────────────────────────────────────

const getActiveMatchPacks = async () => {
  return MatchPack.find({ isActive: true }).sort({ sortOrder: 1 });
};

const getAllMatchPacks = async () => {
  return MatchPack.find().sort({ sortOrder: 1 });
};

const createMatchPack = async (data, createdBy) => {
  return MatchPack.create({ ...data, createdBy });
};

const updateMatchPack = async (packId, data, updatedBy) => {
  const pack = await MatchPack.findByIdAndUpdate(packId, { ...data, updatedBy }, { new: true });
  if (!pack) fail('Match pack not found', 404);
  return pack;
};

const deleteMatchPack = async (packId) => {
  const pack = await MatchPack.findById(packId);
  if (!pack) fail('Match pack not found', 404);
  pack.isActive = false;
  await pack.save();
  return pack;
};

// ── User Subscription ───────────────────────────────────────────────────────

const getOrCreateSubscription = async (userId) => {
  let sub = await UserSubscription.findOne({ userId }).populate('planId');
  if (sub) return sub;

  // Auto-assign default (free) plan
  const freePlan = await Plan.findOne({ isDefault: true, isActive: true });
  if (!freePlan) fail('No default plan configured — contact support', 500);

  sub = await UserSubscription.create({
    userId,
    planId: freePlan._id,
    status: 'active',
    startDate: new Date(),
    endDate: null,
    history: [{ planId: freePlan._id, action: 'subscribed', amount: 0 }],
  });

  return UserSubscription.findById(sub._id).populate('planId');
};

const getUserSubscription = async (userId) => {
  const sub = await getOrCreateSubscription(userId);

  // Check expiry
  if (sub.endDate && sub.endDate < new Date() && sub.status === 'active') {
    sub.status = 'expired';
    sub.history.push({ planId: sub.planId._id || sub.planId, action: 'expired', amount: 0 });

    // Downgrade to free plan
    const freePlan = await Plan.findOne({ isDefault: true, isActive: true });
    if (freePlan) {
      sub.planId = freePlan._id;
      sub.endDate = null;
      sub.history.push({ planId: freePlan._id, action: 'downgraded', amount: 0 });
    }
    await sub.save();
    return UserSubscription.findById(sub._id).populate('planId');
  }

  return sub;
};

// ── Match Limit Check ───────────────────────────────────────────────────────

const checkMatchLimit = async (userId) => {
  const sub = await getUserSubscription(userId);
  const plan = sub.planId;

  const { matchesPerDay, matchesPerWeek } = plan.limits;

  // -1 means unlimited
  if (matchesPerDay === -1 && matchesPerWeek === -1) {
    return { allowed: true, usingExtraMatch: false, currentPlan: plan.slug, usage: {} };
  }

  // Count rooms created by user today and this week (room creation = match creation intent)
  const todayCount = await Room.countDocuments({
    creator: userId,
    createdAt: { $gte: startOfDay() },
  });

  const weekCount = await Room.countDocuments({
    creator: userId,
    createdAt: { $gte: startOfWeek() },
  });

  const dailyExceeded  = matchesPerDay  !== -1 && todayCount >= matchesPerDay;
  const weeklyExceeded = matchesPerWeek !== -1 && weekCount  >= matchesPerWeek;

  if (dailyExceeded || weeklyExceeded) {
    // Check extra matches
    if (sub.extraMatches > 0) {
      return {
        allowed: true,
        usingExtraMatch: true,
        currentPlan: plan.slug,
        usage: { today: todayCount, week: weekCount, extraMatches: sub.extraMatches },
      };
    }

    const reason = dailyExceeded
      ? `Daily limit reached (${matchesPerDay} match${matchesPerDay > 1 ? 'es' : ''}/day)`
      : `Weekly limit reached (${matchesPerWeek} matches/week)`;

    return {
      allowed: false,
      message: reason,
      currentPlan: plan.slug,
      usage: { today: todayCount, week: weekCount, extraMatches: 0 },
    };
  }

  return {
    allowed: true,
    usingExtraMatch: false,
    currentPlan: plan.slug,
    usage: { today: todayCount, week: weekCount, extraMatches: sub.extraMatches },
  };
};

const consumeExtraMatch = async (userId) => {
  const result = await UserSubscription.findOneAndUpdate(
    { userId, extraMatches: { $gt: 0 } },
    { $inc: { extraMatches: -1 } },
    { new: true },
  );
  if (!result) fail('No extra matches available', 400);
  return result;
};

// ── Usage stats (for the mobile "me" endpoint) ─────────────────────────────

const getUsageStats = async (userId) => {
  const todayCount = await Room.countDocuments({
    creator: userId,
    createdAt: { $gte: startOfDay() },
  });
  const weekCount = await Room.countDocuments({
    creator: userId,
    createdAt: { $gte: startOfWeek() },
  });
  return { today: todayCount, week: weekCount };
};

// ── Razorpay Orders ─────────────────────────────────────────────────────────

const createOrder = async (userId, { type, planId, matchPackId }) => {
  let amount, currency, refPlanId = null, refPackId = null;

  if (type === 'subscription') {
    if (!planId) fail('planId is required for subscription', 400);
    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) fail('Plan not found or inactive', 404);
    if (plan.price <= 0) fail('Cannot purchase a free plan', 400);
    amount   = plan.price;
    currency = plan.currency;
    refPlanId = plan._id;
  } else if (type === 'match_pack') {
    if (!matchPackId) fail('matchPackId is required for match pack', 400);
    const pack = await MatchPack.findById(matchPackId);
    if (!pack || !pack.isActive) fail('Match pack not found or inactive', 404);
    amount   = pack.price;
    currency = pack.currency;
    refPackId = pack._id;
  } else {
    fail('Invalid order type', 400);
  }

  // Create Razorpay order (amount in paise)
  // Create Razorpay order (amount in paise)
  let rzpOrder;
  try {
    rzpOrder = await getRazorpay().orders.create({
      amount:   Math.round(amount * 100),
      currency,
      receipt:  `rcpt_${Date.now()}`,
      notes:    { userId: userId.toString(), type },
    });
  } catch (rzpErr) {
    console.error('[RAZORPAY] Order creation failed:', rzpErr?.error || rzpErr?.message || rzpErr);
    fail('Payment service error: ' + (rzpErr?.error?.description || rzpErr?.message || 'Unknown error'), 502);
  }

  const order = await Order.create({
    userId,
    type,
    planId: refPlanId,
    matchPackId: refPackId,
    amount,
    currency,
    razorpayOrderId: rzpOrder.id,
    status: 'created',
  });

  return {
    orderId: order._id,
    razorpayOrderId: rzpOrder.id,
    amount: rzpOrder.amount,
    currency: rzpOrder.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
  };
};

// ── Payment Verification ────────────────────────────────────────────────────

const verifyPayment = async (userId, { razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
  // 1. Verify signature
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expectedSig !== razorpaySignature) {
    fail('Payment verification failed — invalid signature', 400);
  }

  // 2. Find and update order
  const order = await Order.findOne({ razorpayOrderId, userId });
  if (!order) fail('Order not found', 404);
  if (order.status === 'paid') fail('Order already processed', 409);

  order.razorpayPaymentId = razorpayPaymentId;
  order.razorpaySignature = razorpaySignature;
  order.status = 'paid';
  await order.save();

  // 3. Fulfil the purchase
  if (order.type === 'subscription') {
    await activateSubscription(userId, order.planId, razorpayOrderId, razorpayPaymentId, order.amount);
  } else if (order.type === 'match_pack') {
    await creditMatchPack(userId, order.matchPackId, razorpayOrderId, razorpayPaymentId, order.amount);
  }

  return { message: 'Payment verified and activated', order };
};

// ── Internal: activate subscription ─────────────────────────────────────────

const activateSubscription = async (userId, planId, orderId, paymentId, amount) => {
  const plan = await Plan.findById(planId);
  if (!plan) fail('Plan not found', 404);

  const sub = await getOrCreateSubscription(userId);

  const oldPlanId = sub.planId._id || sub.planId;
  const action = plan.price > (sub.planId.price || 0) ? 'upgraded' : 'downgraded';

  // Calculate end date based on interval
  const now = new Date();
  let endDate;
  if (plan.interval === 'monthly') {
    endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);
  } else if (plan.interval === 'yearly') {
    endDate = new Date(now);
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate = null; // lifetime
  }

  sub.planId = planId;
  sub.status = 'active';
  sub.startDate = now;
  sub.endDate = endDate;
  sub.razorpayOrderId = orderId;
  sub.razorpayPaymentId = paymentId;
  sub.history.push({ planId, action, orderId, paymentId, amount });

  await sub.save();
  return sub;
};

// ── Internal: credit match pack ─────────────────────────────────────────────

const creditMatchPack = async (userId, matchPackId, orderId, paymentId, amount) => {
  const pack = await MatchPack.findById(matchPackId);
  if (!pack) fail('Match pack not found', 404);

  const sub = await getOrCreateSubscription(userId);
  sub.extraMatches += pack.matchCount;
  sub.history.push({
    planId: sub.planId._id || sub.planId,
    action: 'match_pack',
    orderId,
    paymentId,
    amount,
    matchPackId,
    matchCount: pack.matchCount,
  });
  await sub.save();
  return sub;
};

// ── Order history ───────────────────────────────────────────────────────────

const getUserOrders = async (userId, { page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    Order.find({ userId })
      .populate('planId', 'name slug price')
      .populate('matchPackId', 'name matchCount price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments({ userId }),
  ]);
  return { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

// ── Admin: list all subscriptions ───────────────────────────────────────────

const getAllSubscriptions = async ({ status, planId, search, page = 1, limit = 20 } = {}) => {
  const filter = {};
  if (status) filter.status = status;
  if (planId) filter.planId = planId;

  const skip = (page - 1) * limit;
  const [subs, total] = await Promise.all([
    UserSubscription.find(filter)
      .populate('userId', 'name username avatar phone email')
      .populate('planId', 'name slug price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    UserSubscription.countDocuments(filter),
  ]);
  return { subscriptions: subs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

// ── Admin: list all orders ──────────────────────────────────────────────────

const getAllOrders = async ({ status, type, page = 1, limit = 20 } = {}) => {
  const filter = {};
  if (status) filter.status = status;
  if (type) filter.type = type;

  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('userId', 'name username avatar')
      .populate('planId', 'name slug price')
      .populate('matchPackId', 'name matchCount price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);
  return { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

// ── Admin: revenue stats ────────────────────────────────────────────────────

const getRevenueStats = async () => {
  const [totalRevenue] = await Order.aggregate([
    { $match: { status: 'paid' } },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  const monthlyRevenue = await Order.aggregate([
    { $match: { status: 'paid' } },
    {
      $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    { $limit: 12 },
  ]);

  const planBreakdown = await UserSubscription.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: '$planId', count: { $sum: 1 } } },
    {
      $lookup: {
        from: 'plans',
        localField: '_id',
        foreignField: '_id',
        as: 'plan',
      },
    },
    { $unwind: '$plan' },
    { $project: { planName: '$plan.name', planSlug: '$plan.slug', count: 1 } },
  ]);

  return {
    totalRevenue: totalRevenue ? totalRevenue.total : 0,
    totalOrders:  totalRevenue ? totalRevenue.count : 0,
    monthlyRevenue,
    activePlanBreakdown: planBreakdown,
  };
};

// ── Webhook handler ─────────────────────────────────────────────────────────

const handleWebhook = async (body, signature) => {
  // Verify webhook signature
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(JSON.stringify(body))
    .digest('hex');

  if (expectedSig !== signature) {
    fail('Invalid webhook signature', 400);
  }

  const event = body.event;
  const payment = body.payload && body.payload.payment && body.payload.payment.entity;

  if (!payment) return { message: 'No payment entity in payload' };

  const order = await Order.findOne({ razorpayOrderId: payment.order_id });
  if (!order) return { message: 'Order not found — ignoring' };

  if (event === 'payment.captured' && order.status !== 'paid') {
    order.razorpayPaymentId = payment.id;
    order.status = 'paid';
    await order.save();

    if (order.type === 'subscription') {
      await activateSubscription(order.userId, order.planId, order.razorpayOrderId, payment.id, order.amount);
    } else if (order.type === 'match_pack') {
      await creditMatchPack(order.userId, order.matchPackId, order.razorpayOrderId, payment.id, order.amount);
    }
  } else if (event === 'payment.failed') {
    order.status = 'failed';
    await order.save();
  }

  return { message: 'Webhook processed' };
};

module.exports = {
  // Plans
  getActivePlans,
  getAllPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  // Match packs
  getActiveMatchPacks,
  getAllMatchPacks,
  createMatchPack,
  updateMatchPack,
  deleteMatchPack,
  // User subscription
  getOrCreateSubscription,
  getUserSubscription,
  checkMatchLimit,
  consumeExtraMatch,
  getUsageStats,
  // Orders
  createOrder,
  verifyPayment,
  getUserOrders,
  // Admin
  getAllSubscriptions,
  getAllOrders,
  getRevenueStats,
  // Webhook
  handleWebhook,
};
