const PortfolioItem = require('../models/PortfolioItem');
const getStorageProvider = require('../services/storage');
const { ALLOWED_IMAGE_TYPES } = require('../middleware/upload');

exports.bulkUpload = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const storage = getStorageProvider();
    const items = [];

    for (const file of req.files) {
      const fileType = ALLOWED_IMAGE_TYPES.includes(file.mimetype) ? 'image' : 'video';
      const item = await PortfolioItem.create({
        user: req.user._id,
        fileUrl: storage.getUrl(file.filename),
        fileType,
        originalFilename: file.originalname,
        fileSize: file.size,
        status: 'draft'
      });
      items.push(item);
    }

    res.status(201).json({ items });
  } catch (err) {
    next(err);
  }
};

exports.getMyItems = async (req, res, next) => {
  try {
    const items = await PortfolioItem.find({ user: req.user._id })
      .populate('category', 'name slug')
      .populate('type', 'name slug')
      .sort({ createdAt: -1 });

    res.json({ items });
  } catch (err) {
    next(err);
  }
};

exports.updateItem = async (req, res, next) => {
  try {
    const item = await PortfolioItem.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!item) {
      return res.status(404).json({ message: 'Portfolio item not found' });
    }

    const allowedFields = ['title', 'description', 'category', 'type', 'order', 'status'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        item[field] = req.body[field];
      }
    }

    await item.save();
    await item.populate('category', 'name slug');
    await item.populate('type', 'name slug');

    res.json({ item });
  } catch (err) {
    next(err);
  }
};

exports.deleteItem = async (req, res, next) => {
  try {
    const item = await PortfolioItem.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!item) {
      return res.status(404).json({ message: 'Portfolio item not found' });
    }

    // Delete file from storage
    const storage = getStorageProvider();
    const filename = item.fileUrl.split('/').pop();
    await storage.delete(filename);

    await item.deleteOne();
    res.json({ message: 'Portfolio item deleted' });
  } catch (err) {
    next(err);
  }
};

exports.getPublicPortfolio = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const user = await User.findOne({ username: req.params.username, status: 'active' });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const items = await PortfolioItem.find({ user: user._id, status: 'published' })
      .populate('category', 'name slug')
      .populate('type', 'name slug')
      .sort({ order: 1, createdAt: -1 });

    res.json({ items });
  } catch (err) {
    next(err);
  }
};
