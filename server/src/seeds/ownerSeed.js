require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Create initial owner account
 * Run this script once to create the first owner
 */
const createOwner = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if owner already exists
    const existingOwner = await User.findOne({ role: 'owner' });

    if (existingOwner) {
      console.log('⚠️  Owner account already exists!');
      console.log(`Email: ${existingOwner.email}`);
      console.log(`Username: ${existingOwner.username}`);
      process.exit(0);
    }

    // Create owner account
    const owner = await User.create({
      username: 'admin',
      email: 'admin@mobiledist.com',
      password: 'Admin@123',
      firstName: 'System',
      lastName: 'Administrator',
      phone: '0771234567',
      role: 'owner',
      isActive: true,
      isEmailVerified: true,
    });

    console.log('\n🎉 Owner account created successfully!\n');
    console.log('='.repeat(50));
    console.log('📧 Email:', owner.email);
    console.log('👤 Username:', owner.username);
    console.log('🔑 Password: Admin@123');
    console.log('👑 Role:', owner.role);
    console.log('='.repeat(50));
    console.log('\n⚠️  IMPORTANT: Change the password after first login!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating owner:', error.message);
    process.exit(1);
  }
};

createOwner();