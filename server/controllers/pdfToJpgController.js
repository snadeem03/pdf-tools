const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const archiver = require('archiver');
const { PDFDocument } = require('pdf-lib');
const logger = require('../utils/logger');
const { uploadDir } = require('../utils/upload');

// Vendored locally (server/vendor/pdfjs, from the pdfjs-dist npm package) so
// this feature doesn't depend on cdnjs.cloudflare.com being reachable at
// request time. The scripts are injected as inline content into the
// Puppeteer page rather than loaded over the network.
const PDFJS_LIB_PATH = path.join(__dirname, '..', 'vendor', 'pdfjs', 'pdf.min.js');
const PDFJS_WORKER_PATH = path.join(__dirname, '..', 'vendor', 'pdfjs', 'pdf.worker.min.js');

const pdfjsLibSource = fs.readFileSync(PDFJS_LIB_PATH, 'utf-8');
const pdfjsWorkerSource = fs.readFileSync(PDFJS_WORKER_PATH, 'utf-8');

/**
 * Convert PDF to JPG using Puppeteer and a locally vendored PDF.js.
 */
exports.pdfToJpg = async (req, res, next) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Please upload a PDF file' });
  }

  let browser;
  try {
    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const totalPages = pdfDoc.getPageCount();

    const zipPath = path.join(uploadDir, `pdf-to-jpg-${Date.now()}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Read the PDF as base64 to inject into the HTML directly
    const pdfBase64 = pdfBytes.toString('base64');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { margin: 0; padding: 0; background: white; display: flex; justify-content: center; align-items: center; }
          canvas { display: block; }
        </style>
      </head>
      <body>
        <canvas id="pdf-canvas"></canvas>
        <script>
          async function renderPage(base64Data, pageNum) {
            const pdfData = atob(base64Data);
            const array = new Uint8Array(pdfData.length);
            for (let i = 0; i < pdfData.length; i++) {
              array[i] = pdfData.charCodeAt(i);
            }

            const loadingTask = pdfjsLib.getDocument({data: array});
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(pageNum);

            const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better HD resolution
            const canvas = document.getElementById('pdf-canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            // Notify Puppeteer that rendering is finished
            document.body.classList.add('render-complete');
          }
        </script>
      </body>
      </html>
    `;

    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    // No network access needed: pdf.js and its worker are injected as inline
    // script content read from disk, instead of `<script src="https://...">`.
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ content: pdfjsLibSource });
    await page.evaluate((workerSource) => {
      const blob = new Blob([workerSource], { type: 'application/javascript' });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
    }, pdfjsWorkerSource);

    for (let i = 1; i <= totalPages; i++) {
      // Clear flag
      await page.evaluate(() => document.body.classList.remove('render-complete'));

      // Render page
      await page.evaluate((b64, pNum) => {
        window.renderPage(b64, pNum);
      }, pdfBase64, i);

      // Wait for rendering
      await page.waitForFunction('document.body.classList.contains("render-complete")', { timeout: 30000 });

      // Capture the canvas element
      const canvasElement = await page.$('canvas');
      const boundingBox = await canvasElement.boundingBox();
      if (!boundingBox) {
        throw new Error(`Failed to capture rendered page ${i}: canvas has no bounding box`);
      }

      // Adjust viewport to ensure the whole image is captured
      await page.setViewport({ width: Math.ceil(boundingBox.width), height: Math.ceil(boundingBox.height) });

      const screenshot = await canvasElement.screenshot({ type: 'jpeg', quality: 90 });
      archive.append(screenshot, { name: `page-${i}.jpg` });
    }

    // Throwing inside an event-listener callback is NOT caught by the
    // surrounding try/catch (different call stack), so it used to crash the
    // process with an unhandled exception on any archive/stream error.
    let responded = false;
    const handleArchiveError = (err) => {
      logger.error(`Archive error during pdf-to-jpg: ${err.message}`);
      fs.unlink(file.path, () => {});
      fs.unlink(zipPath, () => {});
      if (!responded && !res.headersSent) {
        responded = true;
        res.status(500).json({ success: false, error: 'Failed to build the ZIP archive' });
      }
    };

    output.on('close', () => {
      if (responded) return;
      responded = true;
      res.download(zipPath, 'pdf-images.zip', (err) => {
        if (err) logger.error(`pdf-to-jpg download error: ${err.message}`);
        fs.unlink(file.path, () => {});
        fs.unlink(zipPath, () => {});
      });
    });

    output.on('error', handleArchiveError);
    archive.on('error', handleArchiveError);
    archive.pipe(output);

    logger.info(`Converted ${totalPages} PDF pages to JPG using Puppeteer`);
    await archive.finalize();

  } catch (err) {
    fs.unlink(file.path, () => {});
    logger.error('Puppeteer Rasterize Error: ' + err.message);
    next(err);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
