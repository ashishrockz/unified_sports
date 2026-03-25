/**
 * Plan Seeder
 * Creates the default Free, Pro, and Max subscription plans.
 *
 * Usage:
 *   npm run seed:plans
 *   — or —
 *   node src/seeders/seedPlans.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Plan     = require('../modules/subscription/plan.model');

const plans = [
  {
    name: 'Free',
    slug: 'free',
    description: 'Basic plan with limited features',
    price: 0,
    currency: 'INR',
    interval: 'monthly',
    isDefault: true,
    isActive: true,
    sortOrder: 0,
    limits: { matchesPerDay: 1, matchesPerWeek: 4, matchHistoryCount: 3 },
    features: { adFree: false, commentary: false, analytics: false },
  },
  {
    name: 'Pro',
    slug: 'pro',
    description: 'Unlock more matches, ad-free experience, and commentary',
    price: 99,
    currency: 'INR',
    interval: 'monthly',
    isDefault: false,
    isActive: true,
    sortOrder: 1,
    limits: { matchesPerDay: 5, matchesPerWeek: 20, matchHistoryCount: 10 },
    features: { adFree: true, commentary: true, analytics: false },
  },
  {
    name: 'Max',
    slug: 'max',
    description: 'Unlimited matches, all premium features',
    price: 199,
    currency: 'INR',
    interval: 'monthly',
    isDefault: false,
    isActive: true,
    sortOrder: 2,
    limits: { matchesPerDay: -1, matchesPerWeek: -1, matchHistoryCount: 20 },
    features: { adFree: true, commentary: true, analytics: true },
  },
];

const run = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌  MONGO_URI is not set in your .env file.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✅  Connected to MongoDB');

  for (const plan of plans) {
    const existing = await Plan.findOne({ slug: plan.slug });
    if (existing) {
      console.log(`ℹ️   Plan "${plan.name}" already exists — skipping`);
      continue;
    }
    await Plan.create(plan);
    console.log(`🎉  Created plan: ${plan.name} (${plan.slug})`);
  }

  console.log('');
  console.log('─────────────────────────────────────────');
  console.log('  Plans seeded successfully!');
  console.log('  Free  → 1/day, 4/week, 3 history');
  console.log('  Pro   → 5/day, 20/week, 10 history');
  console.log('  Max   → unlimited, 20 history');
  console.log('─────────────────────────────────────────');

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('❌  Seeder failed:', err.message);
  process.exit(1);
});
