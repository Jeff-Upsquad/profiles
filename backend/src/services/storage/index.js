const LocalStorageProvider = require('./LocalStorageProvider');

let storageProvider;

function getStorageProvider() {
  if (storageProvider) return storageProvider;

  const provider = process.env.STORAGE_PROVIDER || 'local';

  switch (provider) {
    case 'local':
      storageProvider = new LocalStorageProvider();
      break;
    // Future: add cases for 'cloudinary', 's3', etc.
    // case 'cloudinary':
    //   storageProvider = new CloudinaryProvider();
    //   break;
    // case 's3':
    //   storageProvider = new S3Provider();
    //   break;
    default:
      storageProvider = new LocalStorageProvider();
  }

  return storageProvider;
}

module.exports = getStorageProvider;
