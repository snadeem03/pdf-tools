const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

// File filter for PDFs
const pdfFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

// File filter for images
const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// File filter for Word docs
const wordFilter = (req, file, cb) => {
  const allowed = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only Word documents are allowed'), false);
  }
};

const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 52428800; // 50MB

// Upload middleware factories
const uploadPdf = multer({ storage, fileFilter: pdfFilter, limits: { fileSize: maxSize } });
const uploadPdfs = multer({ storage, fileFilter: pdfFilter, limits: { fileSize: maxSize } });
const uploadImages = multer({ storage, fileFilter: imageFilter, limits: { fileSize: maxSize } });
const uploadWord = multer({ storage, fileFilter: wordFilter, limits: { fileSize: maxSize } });
const uploadAny = multer({ storage, limits: { fileSize: maxSize } });

module.exports = { uploadPdf, uploadPdfs, uploadImages, uploadWord, uploadAny, uploadDir };
