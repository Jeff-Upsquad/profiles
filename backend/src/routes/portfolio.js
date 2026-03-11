const express = require('express');
const router = express.Router();
const portfolioController = require('../controllers/portfolioController');
const { auth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.post('/upload', auth, upload.array('files', 50), portfolioController.bulkUpload);
router.get('/my', auth, portfolioController.getMyItems);
router.put('/:id', auth, portfolioController.updateItem);
router.delete('/:id', auth, portfolioController.deleteItem);
router.get('/user/:username', portfolioController.getPublicPortfolio);

module.exports = router;
