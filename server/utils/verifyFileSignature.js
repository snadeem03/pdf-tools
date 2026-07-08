const fs = require('fs');

// Minimal magic-byte signatures. This isn't exhaustive, but it's enough to
// reject the common "rename a .exe to .pdf" style spoofing that a
// client-supplied Content-Type/mimetype can't catch.
const SIGNATURES = {
  pdf: [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  jpg: [{ bytes: [0xff, 0xd8, 0xff] }],
  png: [{ bytes: [0x89, 0x50, 0x4e, 0x47] }],
  gif: [{ bytes: [0x47, 0x49, 0x46, 0x38] }],
  webp: [{ bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, secondary: { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] } }],
  // .docx / modern .doc-as-zip and legacy OLE .doc share these two signatures
  zip: [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  ole: [{ bytes: [0xd0, 0xcf, 0x11, 0xe0] }],
};

function readHeader(filePath, length = 16) {
  const buffer = Buffer.alloc(length);
  const fd = fs.openSync(filePath, 'r');
  try {
    const bytesRead = fs.readSync(fd, buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

function matchesSignature(header, sig) {
  for (let i = 0; i < sig.bytes.length; i++) {
    if (header[i] !== sig.bytes[i]) return false;
  }
  if (sig.secondary) {
    for (let i = 0; i < sig.secondary.bytes.length; i++) {
      if (header[sig.secondary.offset + i] !== sig.secondary.bytes[i]) return false;
    }
  }
  return true;
}

/**
 * category: 'pdf' | 'image' | 'word'
 */
function verifyFileSignature(filePath, category) {
  const header = readHeader(filePath);

  if (category === 'pdf') {
    return SIGNATURES.pdf.some((sig) => matchesSignature(header, sig));
  }
  if (category === 'image') {
    return ['jpg', 'png', 'gif', 'webp'].some((key) =>
      SIGNATURES[key].some((sig) => matchesSignature(header, sig))
    );
  }
  if (category === 'word') {
    return ['zip', 'ole'].some((key) =>
      SIGNATURES[key].some((sig) => matchesSignature(header, sig))
    );
  }
  return true; // unknown category: don't block
}

/**
 * Express middleware factory. `getFiles(req)` should return an array of
 * multer file objects to check; `categoryFor(file)` maps a file to the
 * expected category ('pdf' | 'image' | 'word').
 */
function verifyUploadedFiles(getFiles, categoryFor) {
  return (req, res, next) => {
    const files = getFiles(req) || [];
    for (const file of files) {
      const category = categoryFor(file);
      if (!category) continue;
      let ok = false;
      try {
        ok = verifyFileSignature(file.path, category);
      } catch (err) {
        ok = false;
      }
      if (!ok) {
        // Clean up everything that was uploaded in this request.
        for (const f of files) {
          fs.unlink(f.path, () => {});
        }
        return res.status(400).json({
          success: false,
          error: `"${file.originalname}" does not look like a valid ${category.toUpperCase()} file.`,
        });
      }
    }
    next();
  };
}

module.exports = { verifyFileSignature, verifyUploadedFiles };
