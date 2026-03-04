const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log('');
    console.log('  ✅  Database Connected');
    console.log(`  📦  Host : ${conn.connection.host}`);
    console.log(`  🗄️   Name : ${conn.connection.name}`);
    console.log('');
  } catch (err) {
    console.error('  ❌  MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
