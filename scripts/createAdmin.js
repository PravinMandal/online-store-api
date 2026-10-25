require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/user');

async function main() {
  const [name, email, password] = process.argv.slice(2);

  if (!name || !email || !password) {
    console.log('Usage: npm run create:admin -- "Admin Name" admin@example.com secret123');
    process.exit(1);
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    console.log('Please provide a valid email address');
    process.exit(1);
  }

  if (password.length < 6) {
    console.log('Password must be at least 6 characters');
    process.exit(1);
  }

  await connectDB();

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });

  if (existing) {
    await User.updateOne({ _id: existing._id }, { $set: { role: 'admin' } });
    console.log(`${normalizedEmail} is now an admin`);
  } else {
    await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'admin',
    });
    console.log(`Admin created: ${normalizedEmail}`);
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(`Could not create admin: ${error.message}`);
  await mongoose.disconnect();
  process.exit(1);
});
