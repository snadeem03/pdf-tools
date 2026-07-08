const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const logger = require('../utils/logger');
const { uploadDir } = require('../utils/upload');

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6})$/;
const MAX_WATERMARK_TEXT_LENGTH = 200;

/**
 * Add text watermark to PDF.
 * Body params: text, position (optional), x (optional), y (optional), pageIndex (optional)
 *              opacity (0-1), fontSize, color (hex), rotation (0-360)
 */
exports.addWatermark = async (req, res, next) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Please upload a PDF file' });
  }

  const {
    text = 'WATERMARK',
    position = 'center',
    opacity = '0.3',
    fontSize: fontSizeStr = '50',
    color = '#999999',
    rotation: rotationStr = '0',
    applyToAll: applyToAllStr = 'false',
    x: posX,
    y: posY,
    pageIndex,
  } = req.body;

  // --- Input validation -----------------------------------------------
  if (typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Watermark text cannot be empty' });
  }
  if (text.length > MAX_WATERMARK_TEXT_LENGTH) {
    return res.status(400).json({
      success: false,
      error: `Watermark text must be ${MAX_WATERMARK_TEXT_LENGTH} characters or fewer`,
    });
  }

  const colorMatch = HEX_COLOR_REGEX.exec(color);
  if (!colorMatch) {
    return res.status(400).json({
      success: false,
      error: `"${color}" is not a valid hex color. Expected format: #RRGGBB`,
    });
  }

  const opacityVal = parseFloat(opacity);
  if (!Number.isFinite(opacityVal) || opacityVal < 0 || opacityVal > 1) {
    return res.status(400).json({ success: false, error: 'Opacity must be a number between 0 and 1' });
  }

  const fontSize = parseInt(fontSizeStr, 10);
  if (!Number.isFinite(fontSize) || fontSize < 1 || fontSize > 500) {
    return res.status(400).json({ success: false, error: 'Font size must be between 1 and 500' });
  }

  const rotation = parseFloat(rotationStr);
  if (!Number.isFinite(rotation)) {
    return res.status(400).json({ success: false, error: 'Rotation must be a number' });
  }

  const applyToAll = String(applyToAllStr).toLowerCase() === 'true' || applyToAllStr === true;

  const r = parseInt(colorMatch[1].slice(0, 2), 16) / 255;
  const g = parseInt(colorMatch[1].slice(2, 4), 16) / 255;
  const b = parseInt(colorMatch[1].slice(4, 6), 16) / 255;

  try {
    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();

    // StandardFonts only support the WinAnsi character set. Text outside
    // that range (e.g. many non-Latin scripts, emoji) would otherwise throw
    // a fairly cryptic pdf-lib error deep inside drawText/widthOfTextAtSize.
    // Catch it here up front with a clear, actionable message.
    try {
      font.widthOfTextAtSize(text, fontSize);
    } catch (encodingErr) {
      return res.status(400).json({
        success: false,
        error:
          'Watermark text contains characters that are not supported by the available font ' +
          '(only standard Latin characters are supported). Please use plain Latin text.',
      });
    }

    if (posX !== undefined && posY !== undefined && pageIndex !== undefined) {
      // Specific interactive placement
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = font.heightAtSize(fontSize);

      // Calculate offset for center-point rotation
      // phi is the counter-clockwise rotation angle in radians
      const phi = (-rotation * Math.PI) / 180;
      const offsetX = (textWidth / 2) * Math.cos(phi) - (textHeight / 2) * Math.sin(phi);
      const offsetY = (textWidth / 2) * Math.sin(phi) + (textHeight / 2) * Math.cos(phi);

      const x = parseFloat(posX) - offsetX;
      const y = parseFloat(posY) - offsetY;

      if (applyToAll) {
        // Apply to all pages at these coordinates
        for (const page of pages) {
          page.drawText(text, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(r, g, b),
            opacity: opacityVal,
            rotate: degrees(-rotation),
          });
        }
        logger.info(`Added interactive batch watermark "${text}" on all ${pages.length} pages centered at (${posX}, ${posY})`);
      } else {
        // Apply to specific page only
        const pIdx = parseInt(pageIndex, 10);
        const targetPage = pages[pIdx] || pages[0];

        targetPage.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(r, g, b),
          opacity: opacityVal,
          rotate: degrees(-rotation),
        });
        logger.info(`Added interactive watermark "${text}" on page ${pIdx} centered at (${posX}, ${posY}) with rotation ${rotation}°`);
      }
    } else {
      // Legacy behavior: watermark all pages at fixed position
      for (const page of pages) {
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const textHeight = fontSize;

        let x, y;
        switch (position) {
          case 'top-left':
            x = 30;
            y = height - 30 - textHeight;
            break;
          case 'top-right':
            x = width - textWidth - 30;
            y = height - 30 - textHeight;
            break;
          case 'bottom-left':
            x = 30;
            y = 30;
            break;
          case 'bottom-right':
            x = width - textWidth - 30;
            y = 30;
            break;
          case 'center':
          default:
            x = (width - textWidth) / 2;
            y = (height - textHeight) / 2;
            break;
        }

        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(r, g, b),
          opacity: opacityVal,
          rotate: degrees(-rotation),
        });
      }
      logger.info(`Added batch watermark "${text}" at ${position} on ${pages.length} pages with rotation ${rotation}°`);
    }

    const watermarkedBytes = await pdfDoc.save();
    const outputPath = path.join(uploadDir, `watermarked-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, watermarkedBytes);

    res.download(outputPath, 'watermarked.pdf', (err) => {
      if (err) logger.error(`Watermark download error: ${err.message}`);
      fs.unlink(file.path, () => {});
      fs.unlink(outputPath, () => {});
    });
  } catch (err) {
    fs.unlink(file.path, () => {});
    next(err);
  }
};
