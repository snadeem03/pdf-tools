const History = require('../models/History');
const fs = require('fs');

/**
 * Handles the final download response and logs to History if the user is authenticated.
 */
exports.sendDownloadResponse = async (req, res, filePath, downloadName, toolName) => {
  try {
    if (req.user) {
      const stats = fs.statSync(filePath);
      await History.create({
        userId: req.user.id,
        toolName,
        fileName: downloadName,
        fileSize: stats.size,
        status: 'success'
      });
    }
  } catch (err) {
    console.error('Error logging history:', err);
  }

  res.download(filePath, downloadName);
};
