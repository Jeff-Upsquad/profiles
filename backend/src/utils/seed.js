require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const Type = require('../models/Type');
const slugify = require('slugify');

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create admin user
    const existingAdmin = await User.findOne({ email: 'admin@profiles.com' });
    if (!existingAdmin) {
      await User.create({
        email: 'admin@profiles.com',
        password: 'admin123456',
        username: 'admin',
        name: 'Admin',
        role: 'admin'
      });
      console.log('Admin user created (admin@profiles.com / admin123456)');
    } else {
      console.log('Admin user already exists');
    }

    // Seed categories
    const categories = ['Poster', 'Logo', 'Branding', 'Social Media Design', 'Motion Graphics', 'Video Edit', 'UI/UX Design', 'Illustration'];
    for (const name of categories) {
      const slug = slugify(name, { lower: true, strict: true });
      await Category.findOneAndUpdate({ slug }, { name, slug }, { upsert: true });
    }
    console.log('Categories seeded');

    // Seed types
    const types = ['Image', 'Video'];
    for (const name of types) {
      const slug = slugify(name, { lower: true, strict: true });
      await Type.findOneAndUpdate({ slug }, { name, slug }, { upsert: true });
    }
    console.log('Types seeded');

    console.log('Seed complete!');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
};

seedData();
