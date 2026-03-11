/**
 * AppConfig Seeder
 * Creates the default singleton AppConfig document in MongoDB.
 *
 * Usage:
 *   node src/seeders/seedAppConfig.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const AppConfig = require('../modules/appConfig/appConfig.model');

const run = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌  MONGO_URI is not set in your .env file.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✅  Connected to MongoDB');

  const existing = await AppConfig.findOne({ key: 'active' });
  if (existing) {
    console.log('ℹ️   AppConfig already exists (version %d)', existing.version);
    await mongoose.disconnect();
    process.exit(0);
  }

  const config = await AppConfig.create({ key: 'active' });

  console.log('');
  console.log('🎉  AppConfig created successfully!');
  console.log('─────────────────────────────────────');
  console.log('  Version     :', config.version);
  console.log('  Maintenance :', config.maintenance.enabled ? 'ON' : 'OFF');
  console.log('  Features    :', Object.keys(config.features.toObject()).length, 'flags');
  console.log('─────────────────────────────────────');
  console.log('');

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('❌  Seeder failed:', err.message);
  process.exit(1);
});
