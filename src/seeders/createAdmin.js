/**
 * Admin Seeder
 * Creates the default admin user in MongoDB.
 *
 * Usage:
 *   node src/seeders/createAdmin.js
 *
 * Override defaults via environment variables:
 *   ADMIN_NAME     (default: "Super Admin")
 *   ADMIN_EMAIL    (default: "admin@unifiedsports.com")
 *   ADMIN_PASSWORD (default: "Admin@123")
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../modules/user/user.model');

const run = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌  MONGO_URI is not set in your .env file.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✅  Connected to MongoDB');

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@unifiedsports.com').toLowerCase();
  const adminName  = process.env.ADMIN_NAME     || 'Super Admin';
  const adminPass  = process.env.ADMIN_PASSWORD  || 'Admin@123';

  // Check if an admin already exists
  const existing = await User.findOne({ role: 'admin' });
  if (existing) {
    console.log('ℹ️   Admin already exists:');
    console.log('    Email :', existing.email);
    console.log('    Name  :', existing.name);
    await mongoose.disconnect();
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(adminPass, 12);

  const admin = await User.create({
    name:     adminName,
    email:    adminEmail,
    password: hashedPassword,
    role:     'admin',
  });

  console.log('');
  console.log('🎉  Admin user created successfully!');
  console.log('─────────────────────────────────────');
  console.log('  Name     :', admin.name);
  console.log('  Email    :', admin.email);
  console.log('  Password :', adminPass);
  console.log('  Role     :', admin.role);
  console.log('─────────────────────────────────────');
  console.log('  POST /api/admin/login  to get your JWT token');
  console.log('');

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('❌  Seeder failed:', err.message);
  process.exit(1);
});
