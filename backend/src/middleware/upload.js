const multer = require('multer');
const path = require('path');

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpg', 'image/jpeg'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime'];
const ALL_ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024; // 100MB default

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  if (ALL_ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PNG, JPG, JPEG, MP4, and MOV are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 50
  }
});

const profilePictureUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Profile picture must be PNG, JPG, or JPEG.'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for profile pictures
    files: 1
  }
});

module.exports = { upload, profilePictureUpload, ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES };
