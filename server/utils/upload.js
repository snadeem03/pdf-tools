const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyUploadedFiles } = require('./verifyFileSignature');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Strip path separators and anything that isn't a safe filename character.
// `file.originalname` is fully attacker-controlled; without this, a name like
// "../../../evil.pdf" could be used to try to escape the upload directory.
function sanitizeOriginalName(originalName) {
  const base = path.basename(originalName || 'file');
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.slice(-150) || 'file'; // keep filenames reasonably short
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + sanitizeOriginalName(file.originalname));
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

// File filter for the "sign" endpoint, which uploads a PDF and a signature
// image together under different field names.
const signFilter = (req, file, cb) => {
  if (file.fieldname === 'pdf') {
    return pdfFilter(req, file, cb);
  }
  if (file.fieldname === 'signature') {
    return imageFilter(req, file, cb);
  }
  cb(new Error('Unexpected field'), false);
};

const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 52428800; // 50MB

// Upload middleware factories
const uploadPdf = multer({ storage, fileFilter: pdfFilter, limits: { fileSize: maxSize } });
const uploadPdfs = multer({ storage, fileFilter: pdfFilter, limits: { fileSize: maxSize } });
const uploadImages = multer({ storage, fileFilter: imageFilter, limits: { fileSize: maxSize } });
const uploadWord = multer({ storage, fileFilter: wordFilter, limits: { fileSize: maxSize } });
const uploadSign = multer({ storage, fileFilter: signFilter, limits: { fileSize: maxSize } });
const uploadAny = multer({ storage, limits: { fileSize: maxSize } });

// Content-sniffing verification middlewares, to run after the multer
// middleware above. The mimetype filters above only check the client-supplied
// Content-Type header, which is trivially spoofable (e.g. renaming a .exe to
// .pdf) - these confirm the actual file bytes match what's expected.
const verifySinglePdf = verifyUploadedFiles(
  (req) => (req.file ? [req.file] : []),
  () => 'pdf'
);
const verifyMultiplePdfs = verifyUploadedFiles(
  (req) => req.files || [],
  () => 'pdf'
);
const verifyImages = verifyUploadedFiles(
  (req) => req.files || (req.file ? [req.file] : []),
  () => 'image'
);
const verifyWord = verifyUploadedFiles(
  (req) => (req.file ? [req.file] : []),
  () => 'word'
);
const verifySignFields = verifyUploadedFiles(
  (req) => [
    ...((req.files && req.files.pdf) || []),
    ...((req.files && req.files.signature) || []),
  ],
  (file) => (file.fieldname === 'pdf' ? 'pdf' : 'image')
);

module.exports = {
  uploadPdf,
  uploadPdfs,
  uploadImages,
  uploadWord,
  uploadSign,
  uploadAny,
  uploadDir,
  verifySinglePdf,
  verifyMultiplePdfs,
  verifyImages,
  verifyWord,
  verifySignFields,
};
