const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { adminAuth } = require('../middleware/auth');

// All admin routes require admin authentication
router.use(adminAuth);

// Dashboard
router.get('/stats', adminController.getStats);

// User management
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUser);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.put('/users/:id/status', adminController.updateUserStatus);

// Portfolio management
router.get('/portfolios', adminController.getAllPortfolios);
router.put('/portfolios/:id', adminController.updatePortfolio);
router.delete('/portfolios/:id', adminController.deletePortfolio);

// Category management
router.get('/categories', adminController.getCategories);
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// Type management
router.get('/types', adminController.getTypes);
router.post('/types', adminController.createType);
router.put('/types/:id', adminController.updateType);
router.delete('/types/:id', adminController.deleteType);

module.exports = router;
