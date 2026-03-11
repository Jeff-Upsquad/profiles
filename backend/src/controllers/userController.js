const User = require('../models/User');
const PortfolioItem = require('../models/PortfolioItem');
const getStorageProvider = require('../services/storage');

exports.updateProfile = async (req, res, next) => {
  try {
    const allowedFields = ['name', 'bio', 'skills', 'location', 'socialLinks'];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true, runValidators: true
    }).select('-password');

    res.json({ user: user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
};

exports.updateProfilePicture = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const storage = getStorageProvider();

    // Delete old profile picture if exists
    if (req.user.profilePicture) {
      const oldFilename = req.user.profilePicture.split('/').pop();
      await storage.delete(oldFilename);
    }

    const fileUrl = storage.getUrl(req.file.filename);
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profilePicture: fileUrl },
      { new: true }
    ).select('-password');

    res.json({ user: user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
};

exports.getPublicProfile = async (req, res, next) => {
  try {
    const user = await User.findOne({
      username: req.params.username,
      status: 'active'
    }).select('-password -email');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const portfolioItems = await PortfolioItem.find({
      user: user._id,
      status: 'published'
    })
      .populate('category', 'name slug')
      .populate('type', 'name slug')
      .sort({ order: 1, createdAt: -1 });

    res.json({ user: user.toPublicJSON(), portfolioItems });
  } catch (err) {
    next(err);
  }
};
