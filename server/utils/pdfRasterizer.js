const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// Vendored locally (server/vendor/pdfjs, from the pdfjs-dist npm package) so
// this doesn't depend on cdnjs.cloudflare.com being reachable at request
// time. The scripts are injected as inline content into the Puppeteer page
// rather than loaded over the network.
const PDFJS_LIB_PATH = path.join(__dirname, '..', 'vendor', 'pdfjs', 'pdf.min.js');
const PDFJS_WORKER_PATH = path.join(__dirname, '..', 'vendor', 'pdfjs', 'pdf.worker.min.js');

const pdfjsLibSource = fs.readFileSync(PDFJS_LIB_PATH, 'utf-8');
const pdfjsWorkerSource = fs.readFileSync(PDFJS_WORKER_PATH, 'utf-8');

const RENDER_HTML = `
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
    async function renderPage(base64Data, pageNum, scale) {
      const pdfData = atob(base64Data);
      const array = new Uint8Array(pdfData.length);
      for (let i = 0; i < pdfData.length; i++) {
        array[i] = pdfData.charCodeAt(i);
      }

      const loadingTask = pdfjsLib.getDocument({data: array});
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(pageNum);

      const viewport = page.getViewport({ scale });
      const canvas = document.getElementById('pdf-canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport: viewport }).promise;

      document.body.classList.add('render-complete');
    }
  </script>
</body>
</html>
`;

/**
 * Rasterize every page of a PDF into JPEG buffers using a headless browser
 * and a locally vendored PDF.js (no external network dependency).
 *
 * @param {Buffer} pdfBytes
 * @param {{ scale?: number, quality?: number }} [options]
 * @returns {Promise<{ buffer: Buffer, width: number, height: number }[]>}
 */
async function rasterizePdfToJpegs(pdfBytes, options = {}) {
  const { scale = 2.0, quality = 90 } = options;
  const { PDFDocument } = require('pdf-lib');

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();
  const pdfBase64 = pdfBytes.toString('base64');

  let browser;
  const pages = [];
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(RENDER_HTML, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ content: pdfjsLibSource });
    await page.evaluate((workerSource) => {
      const blob = new Blob([workerSource], { type: 'application/javascript' });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
    }, pdfjsWorkerSource);

    for (let i = 1; i <= totalPages; i++) {
      await page.evaluate(() => document.body.classList.remove('render-complete'));
      await page.evaluate(
        (b64, pNum, s) => window.renderPage(b64, pNum, s),
        pdfBase64,
        i,
        scale
      );
      await page.waitForFunction('document.body.classList.contains("render-complete")', { timeout: 30000 });

      const canvasElement = await page.$('canvas');
      const boundingBox = await canvasElement.boundingBox();
      if (!boundingBox) {
        throw new Error(`Failed to capture rendered page ${i}: canvas has no bounding box`);
      }

      await page.setViewport({ width: Math.ceil(boundingBox.width), height: Math.ceil(boundingBox.height) });
      const buffer = await canvasElement.screenshot({ type: 'jpeg', quality });
      pages.push({ buffer, width: Math.ceil(boundingBox.width), height: Math.ceil(boundingBox.height) });
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return pages;
}

module.exports = { rasterizePdfToJpegs };
