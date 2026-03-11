const mongoose = require('mongoose');

const portfolioItemSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, default: 'Untitled' },
  description: { type: String, default: '' },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  type: { type: mongoose.Schema.Types.ObjectId, ref: 'Type', default: null },
  fileUrl: { type: String, required: true },
  fileType: { type: String, enum: ['image', 'video'], required: true },
  originalFilename: { type: String, default: '' },
  fileSize: { type: Number, default: 0 },
  thumbnailUrl: { type: String, default: '' },
  order: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' }
}, { timestamps: true });

module.exports = mongoose.model('PortfolioItem', portfolioItemSchema);
