/**
 * Super Admin Seeder
 * Creates the one and only superadmin account.
 * Run this ONCE before using the platform.
 *
 * Usage:
 *   npm run seed:superadmin
 *   — or —
 *   node src/seeders/createSuperAdmin.js
 *
 * Override defaults via environment variables:
 *   SUPERADMIN_NAME     (default: "Super Admin")
 *   SUPERADMIN_EMAIL    (default: "superadmin@unifiedsports.com")
 *   SUPERADMIN_PASSWORD (default: "SuperAdmin@123")
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('../modules/user/user.model');

const run = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌  MONGO_URI is not set in your .env file.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✅  Connected to MongoDB');

  const email    = (process.env.SUPERADMIN_EMAIL    || 'superadmin@unifiedsports.com').toLowerCase();
  const name     =  process.env.SUPERADMIN_NAME     || 'Super Admin';
  const password =  process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123';

  // Ensure only one superadmin exists
  const existing = await User.findOne({ role: 'superadmin' });
  if (existing) {
    console.log('ℹ️   Super admin already exists:');
    console.log('    Email :', existing.email);
    console.log('    Name  :', existing.name);
    await mongoose.disconnect();
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const superAdmin = await User.create({
    name,
    email,
    password: hashedPassword,
    role:     'superadmin',
    status:   'active',
  });

  console.log('');
  console.log('🎉  Super admin created successfully!');
  console.log('─────────────────────────────────────────');
  console.log('  Name     :', superAdmin.name);
  console.log('  Email    :', superAdmin.email);
  console.log('  Password :', password);
  console.log('  Role     :', superAdmin.role);
  console.log('─────────────────────────────────────────');
  console.log('  Login → POST /api/admin/login');
  console.log('  Docs  → GET  /api/docs');
  console.log('');

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('❌  Seeder failed:', err.message);
  process.exit(1);
});
