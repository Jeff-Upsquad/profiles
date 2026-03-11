const User = require('../models/User');
const PortfolioItem = require('../models/PortfolioItem');
const Category = require('../models/Category');
const Type = require('../models/Type');
const slugify = require('slugify');
const getStorageProvider = require('../services/storage');

// ===== User Management =====

exports.getUsers = async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const allowedFields = ['name', 'bio', 'skills', 'location', 'status', 'role'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true, runValidators: true
    }).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Delete all portfolio items and their files
    const storage = getStorageProvider();
    const items = await PortfolioItem.find({ user: user._id });
    for (const item of items) {
      const filename = item.fileUrl.split('/').pop();
      await storage.delete(filename);
    }
    await PortfolioItem.deleteMany({ user: user._id });

    // Delete profile picture
    if (user.profilePicture) {
      const filename = user.profilePicture.split('/').pop();
      await storage.delete(filename);
    }

    await user.deleteOne();
    res.json({ message: 'User and all associated data deleted' });
  } catch (err) {
    next(err);
  }
};

exports.updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

// ===== Portfolio Management =====

exports.getAllPortfolios = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = {};

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const items = await PortfolioItem.find(query)
      .populate('user', 'name username email')
      .populate('category', 'name')
      .populate('type', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PortfolioItem.countDocuments(query);

    res.json({
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.updatePortfolio = async (req, res, next) => {
  try {
    const allowedFields = ['title', 'description', 'category', 'type', 'status'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const item = await PortfolioItem.findByIdAndUpdate(req.params.id, updates, {
      new: true, runValidators: true
    }).populate('user', 'name username').populate('category', 'name').populate('type', 'name');

    if (!item) return res.status(404).json({ message: 'Portfolio item not found' });
    res.json({ item });
  } catch (err) {
    next(err);
  }
};

exports.deletePortfolio = async (req, res, next) => {
  try {
    const item = await PortfolioItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Portfolio item not found' });

    const storage = getStorageProvider();
    const filename = item.fileUrl.split('/').pop();
    await storage.delete(filename);

    await item.deleteOne();
    res.json({ message: 'Portfolio item deleted' });
  } catch (err) {
    next(err);
  }
};

// ===== Category Management =====

exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json({ categories });
  } catch (err) {
    next(err);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    const slug = slugify(name, { lower: true, strict: true });
    const category = await Category.create({ name, slug });
    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    const slug = slugify(name, { lower: true, strict: true });
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { name, slug },
      { new: true, runValidators: true }
    );

    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json({ category });
  } catch (err) {
    next(err);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
};

// ===== Type Management =====

exports.getTypes = async (req, res, next) => {
  try {
    const types = await Type.find().sort({ name: 1 });
    res.json({ types });
  } catch (err) {
    next(err);
  }
};

exports.createType = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    const slug = slugify(name, { lower: true, strict: true });
    const type = await Type.create({ name, slug });
    res.status(201).json({ type });
  } catch (err) {
    next(err);
  }
};

exports.updateType = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    const slug = slugify(name, { lower: true, strict: true });
    const type = await Type.findByIdAndUpdate(
      req.params.id,
      { name, slug },
      { new: true, runValidators: true }
    );

    if (!type) return res.status(404).json({ message: 'Type not found' });
    res.json({ type });
  } catch (err) {
    next(err);
  }
};

exports.deleteType = async (req, res, next) => {
  try {
    const type = await Type.findByIdAndDelete(req.params.id);
    if (!type) return res.status(404).json({ message: 'Type not found' });
    res.json({ message: 'Type deleted' });
  } catch (err) {
    next(err);
  }
};

// ===== Dashboard Stats =====

exports.getStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const suspendedUsers = await User.countDocuments({ status: 'suspended' });
    const totalPortfolioItems = await PortfolioItem.countDocuments();
    const totalCategories = await Category.countDocuments();
    const totalTypes = await Type.countDocuments();

    res.json({
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalPortfolioItems,
      totalCategories,
      totalTypes
    });
  } catch (err) {
    next(err);
  }
};
