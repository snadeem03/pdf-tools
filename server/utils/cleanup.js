const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Cleanup uploaded files older than 30 minutes.
 * Runs every 10 minutes.
 */
function startCleanupJob() {
  const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
  const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

  cron.schedule('*/10 * * * *', () => {
    logger.info('Running temp file cleanup...');
    if (!fs.existsSync(uploadDir)) return;

    const now = Date.now();
    const files = fs.readdirSync(uploadDir);
    let cleaned = 0;

    files.forEach((file) => {
      const filePath = path.join(uploadDir, file);
      try {
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > MAX_AGE_MS) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      } catch (err) {
        logger.error(`Cleanup error for ${file}: ${err.message}`);
      }
    });

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} temp files`);
    }
  });

  logger.info('Temp file cleanup job scheduled (every 10 minutes)');
}

module.exports = { startCleanupJob };
