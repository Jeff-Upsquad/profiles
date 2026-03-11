const fs = require('fs');
const path = require('path');

class LocalStorageProvider {
  constructor() {
    this.uploadDir = path.join(__dirname, '../../../uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  getUrl(filename) {
    return `/uploads/${filename}`;
  }

  async delete(filename) {
    const filePath = path.join(this.uploadDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

module.exports = LocalStorageProvider;
