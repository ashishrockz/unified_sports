/**
 * Seed All Staff Roles
 * Creates one account per role for testing/development.
 *
 * Usage:
 *   npm run seed:roles
 *   — or —
 *   node src/seeders/seedAllRoles.js
 *
 * All accounts use the same password: Test@12345
 * Login endpoint: POST /api/admin/login
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('../modules/user/user.model');

const PASSWORD = 'Test@12345';

const ACCOUNTS = [
  {
    name: 'Super Admin',
    email: 'superadmin@unifiedsports.com',
    role: 'super_admin',
  },
  {
    name: 'Admin User',
    email: 'admin@unifiedsports.com',
    role: 'admin',
  },
  {
    name: 'Manager User',
    email: 'manager@unifiedsports.com',
    role: 'manager',
  },
  {
    name: 'Editor User',
    email: 'editor@unifiedsports.com',
    role: 'editor',
  },
  {
    name: 'Viewer User',
    email: 'viewer@unifiedsports.com',
    role: 'viewer',
  },
];

const run = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is not set in your .env file.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB\n');

  const hashedPassword = await bcrypt.hash(PASSWORD, 12);

  console.log('====================================================');
  console.log('  STAFF ACCOUNT CREDENTIALS');
  console.log('  Login: POST /api/admin/login');
  console.log('  Password for ALL accounts: ' + PASSWORD);
  console.log('====================================================\n');

  for (const account of ACCOUNTS) {
    const existing = await User.findOne({ email: account.email });

    if (existing) {
      // Update role if it changed (e.g. migrating from old 'superadmin' to 'super_admin')
      if (existing.role !== account.role) {
        existing.role = account.role;
        existing.password = hashedPassword;
        await existing.save();
        console.log(`  [UPDATED] ${account.role.padEnd(13)} | ${account.email} | (role & password updated)`);
      } else {
        console.log(`  [EXISTS]  ${account.role.padEnd(13)} | ${account.email}`);
      }
      continue;
    }

    await User.create({
      name:     account.name,
      email:    account.email,
      password: hashedPassword,
      role:     account.role,
      status:   'active',
    });

    console.log(`  [CREATED] ${account.role.padEnd(13)} | ${account.email}`);
  }

  console.log('\n====================================================');
  console.log('  ROLE ACCESS SUMMARY');
  console.log('====================================================');
  console.log('  super_admin  | Full access to everything');
  console.log('  admin        | Users, Content, Matches, Rooms, Settings, Logs');
  console.log('  manager      | Content (CRU), Reports, Matches/Rooms (read)');
  console.log('  editor       | Content (CRU), Matches/Rooms (read)');
  console.log('  viewer       | Read-only: Content, Reports, Matches, Rooms');
  console.log('====================================================\n');

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('Seeder failed:', err.message);
  process.exit(1);
});
