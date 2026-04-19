require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');
const errorHandler = require('./utils/errorHandler');
const { startCleanupJob } = require('./utils/cleanup');

const app = express();
const PORT = process.env.PORT || 3001;

// =============================================================================
// Middleware
// =============================================================================

// CORS - allow frontend dev server
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  exposedHeaders: ['X-Original-Size', 'X-Compressed-Size', 'X-Reduction'],
}));

// JSON body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP request logging with Morgan piped to Winston
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// =============================================================================
// Ensure required directories exist
// =============================================================================
const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
const logsDir = path.join(__dirname, 'logs');
[uploadDir, logsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// =============================================================================
// API Routes
// =============================================================================
app.use('/api/merge', require('./routes/merge'));
app.use('/api/split', require('./routes/split'));
app.use('/api/compress', require('./routes/compress'));
app.use('/api/pdf-to-word', require('./routes/pdfToWord'));
app.use('/api/word-to-pdf', require('./routes/wordToPdf'));
app.use('/api/jpg-to-pdf', require('./routes/jpgToPdf'));
app.use('/api/pdf-to-jpg', require('./routes/pdfToJpg'));
app.use('/api/rotate', require('./routes/rotate'));
app.use('/api/watermark', require('./routes/watermark'));
app.use('/api/page-numbers', require('./routes/pageNumbers'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'PDF Tools API is running', timestamp: new Date().toISOString() });
});

// =============================================================================
// Error Handler (must be last)
// =============================================================================
app.use(errorHandler);

// =============================================================================
// Start Server & Cleanup Job
// =============================================================================
app.listen(PORT, () => {
  logger.info(`PDF Tools API server running on port ${PORT}`);
  console.log(`\n🚀 PDF Tools API server running at http://localhost:${PORT}\n`);
});

// Start temp file cleanup cron
startCleanupJob();
