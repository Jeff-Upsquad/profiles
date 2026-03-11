const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { auth } = require('../middleware/auth');
const { profilePictureUpload } = require('../middleware/upload');

router.put('/profile', auth, userController.updateProfile);
router.put('/profile-picture', auth, profilePictureUpload.single('profilePicture'), userController.updateProfilePicture);
router.get('/:username', userController.getPublicProfile);

module.exports = router;
