const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Type = require('../models/Type');

router.get('/categories', async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

router.get('/types', async (req, res, next) => {
  try {
    const types = await Type.find().sort({ name: 1 });
    res.json({ types });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
