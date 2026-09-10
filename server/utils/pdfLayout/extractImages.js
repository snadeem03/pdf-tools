/**
 * Extract embedded images from PDF pages using pdf-lib + pdfjs-dist.
 *
 * Returns structured image objects with position and geometry for DOCX reconstruction.
 * Uses pdf-lib for image data extraction (avoids commonObjs hang).
 * Uses pdfjs-dist operator list for image position/transform extraction.
 */

const { PDFDocument, PDFName } = require('pdf-lib');
const zlib = require('zlib');

let pdfjsLib = null;

async function getPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLib;
}

/**
 * Extract all embedded images from a PDF.
 *
 * @param {Buffer|Uint8Array} pdfBytes
 * @param {object} [options]
 * @param {boolean} [options.debug=false]
 * @returns {Promise<{ images: object[], pageInfo: object[] }>}
 */
async function extractImages(pdfBytes, options = {}) {
  const { debug = false } = options;

  // Extract image positions from pdfjs-dist operator list
  const positions = await extractImagePositions(pdfBytes, debug);

  // Extract image data from pdf-lib XObject resources
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const context = pdfDoc.context;
  const pages = pdfDoc.getPages();

  const images = [];
  const pageInfo = [];

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    const pageNode = page.node;
    const pageIndex = pageIdx;

    let pageImages = 0;
    const pagePositions = positions.filter(p => p.pageIndex === pageIndex);

    try {
      const resources = pageNode.Resources();
      if (!resources) {
        pageInfo.push({ pageIndex, imageCount: 0, images: [] });
        continue;
      }

      const resourcesDict = context.lookup(resources);
      if (!resourcesDict || !resourcesDict.entries) {
        pageInfo.push({ pageIndex, imageCount: 0, images: [] });
        continue;
      }

      const xobjectsRef = resourcesDict.get(PDFName.of('XObject'));
      if (!xobjectsRef) {
        pageInfo.push({ pageIndex, imageCount: 0, images: [] });
        continue;
      }

      const xobjectsDict = context.lookup(xobjectsRef);
      if (!xobjectsDict || !xobjectsDict.entries) {
        pageInfo.push({ pageIndex, imageCount: 0, images: [] });
        continue;
      }

    // Match positions to images by page and order of appearance
    const pagePositions = positions.filter(p => p.pageIndex === pageIndex);
    let posIdx = 0;

    for (const [key, ref] of xobjectsDict.entries()) {
      try {
        const xobj = context.lookup(ref);
        if (!xobj) continue;

        // PDFRawStream objects have a .dict property for metadata
        const dict = xobj.dict || xobj;
        const subtype = dict.get ? dict.get(PDFName.of('Subtype')) : null;
        if (!subtype) continue;
        const subtypeStr = subtype.value ? subtype.value() : String(subtype);

        // Only process image XObjects (not Form XObjects)
        if (subtypeStr !== '/Image' && subtypeStr !== 'Image') continue;

        const imgObj = extractImageXObject(xobj, dict, key.value(), context);
        if (imgObj) {
          imgObj.pageIndex = pageIndex;
          imgObj.name = key.value().replace(/^\//, '');

          // Match position from pdfjs-dist by order of appearance on this page
          if (posIdx < pagePositions.length) {
            const pos = pagePositions[posIdx];
            imgObj.x = pos.x;
            imgObj.y = pos.y;           // pdfjs coords (top-left origin)
            imgObj.drawWidth = pos.drawWidth;
            imgObj.drawHeight = pos.drawHeight;
            imgObj.pdfX = pos.pdfX;     // PDF coords (bottom-left origin)
            imgObj.pdfY = pos.pdfY;
            posIdx++;
          } else {
            // Fallback: place at top of page
            const pageData = pages[pageIndex];
            imgObj.x = 0;
            imgObj.y = 0;
            imgObj.drawWidth = imgObj.width;
            imgObj.drawHeight = imgObj.height;
            imgObj.pdfX = 0;
            imgObj.pdfY = pageData.height;
          }

            images.push(imgObj);
            pageImages++;
          }
        } catch (e) {
          if (debug) {
            console.warn(`[extractImages] Error processing XObject ${key.value()}: ${e.message}`);
          }
        }
      }
    } catch (e) {
      if (debug) {
        console.warn(`[extractImages] Error on page ${pageIndex}: ${e.message}`);
      }
    }

    pageInfo.push({ pageIndex, imageCount: pageImages, images: images.filter(i => i.pageIndex === pageIndex) });

    if (debug) {
      console.log(`[extractImages] Page ${pageIndex}: ${pageImages} image(s)`);
    }
  }

  if (debug) {
    console.log(`[extractImages] Total: ${images.length} image(s) across ${pages.length} pages`);
  }

  return { images, pageInfo };
}

/**
 * Extract image positions from pdfjs-dist operator list.
 * Tracks the Current Transformation Matrix (CTM) to get image draw positions.
 *
 * @returns {Promise<object[]>} array of { imageName, pageIndex, x, y, drawWidth, drawHeight, pdfX, pdfY }
 */
async function extractImagePositions(pdfBytes, debug = false) {
  const lib = await getPdfJs();
  const OPS = lib.OPS;

  const data = new Uint8Array(pdfBytes);
  const loadingTask = lib.getDocument({ data });
  const pdf = await loadingTask.promise;
  const positions = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;
    const opList = await page.getOperatorList();

    // Track CTM stack (save/restore pattern)
    const ctmStack = [];
    let ctm = [1, 0, 0, 1, 0, 0];

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];

      if (fn === OPS.save) {
        ctmStack.push([...ctm]);
      } else if (fn === OPS.restore) {
        ctm = ctmStack.pop() || [1, 0, 0, 1, 0, 0];
      } else if (fn === OPS.transform) {
        // Matrix multiply: new_ctm = args * ctm
        const [a, b, c, d, e, f] = args;
        const [a2, b2, c2, d2, e2, f2] = ctm;
        ctm = [
          a * a2 + b * c2,
          a * b2 + b * d2,
          c * a2 + d * c2,
          c * b2 + d * d2,
          e * a2 + f * c2 + e2,
          e * b2 + f * d2 + f2,
        ];
      } else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
        const imageName = args[0];

        // CTM gives us: [scaleX, skewX, skewY, scaleY, translateX, translateY]
        // For typical images: [drawWidth, 0, 0, drawHeight, pdfX, pdfY]
        const scaleX = Math.abs(ctm[0]);
        const scaleY = Math.abs(ctm[3]);
        const pdfX = ctm[4];
        const pdfY = ctm[5];

        // Convert PDF coords (bottom-left) to pdfjs coords (top-left)
        const x = pdfX;
        const y = pageHeight - pdfY - scaleY;

        positions.push({
          imageName: imageName.replace(/^\//, ''),
          pageIndex: pageNum - 1,
          x,
          y,
          drawWidth: scaleX,
          drawHeight: scaleY,
          pdfX,
          pdfY,
        });

        if (debug) {
          console.log(`[extractImages] Position: ${imageName} at (${x.toFixed(1)}, ${y.toFixed(1)}) draw=(${scaleX.toFixed(1)}x${scaleY.toFixed(1)})`);
        }
      }
    }
  }

  return positions;
}

/**
 * Extract image data from an XObject stream.
 * Handles JPEG (DCTDecode), PNG-like (FlateDecode), and raw images.
 *
 * @param {PDFRawStream} xobj - the raw stream object (has .contents)
 * @param {PDFDict} dict - the stream's dictionary (has .get())
 * @param {string} name - XObject name
 * @param {PDFContext} context
 */
function extractImageXObject(xobj, dict, name, context) {
  const width = getNumber(dict, PDFName.of('Width'), context);
  const height = getNumber(dict, PDFName.of('Height'), context);
  if (!width || !height || width <= 0 || height <= 0) return null;

  // Get color space
  let colorSpace = 'RGB';
  let bitsPerComponent = 8;
  const csRef = dict.get(PDFName.of('ColorSpace'));
  if (csRef) {
    const cs = context.lookup(csRef);
    if (cs && cs.toString) {
      const csStr = cs.toString();
      if (csStr.includes('DeviceGray') || csStr.includes('CalGray')) colorSpace = 'Gray';
      else if (csStr.includes('CMYK') || csStr.includes('DeviceCMYK')) colorSpace = 'CMYK';
      else if (csStr.includes('DeviceRGB') || csStr.includes('CalRGB') || csStr.includes('ICCBased')) colorSpace = 'RGB';
    }
  }

  const bpcRef = dict.get(PDFName.of('BitsPerComponent'));
  if (bpcRef) {
    const bpcVal = context.lookup(bpcRef);
    if (bpcVal && bpcVal.value) bitsPerComponent = bpcVal.value();
  }

  // Get filter
  let filter = null;
  const filterRef = dict.get(PDFName.of('Filter'));
  if (filterRef) {
    const filterObj = context.lookup(filterRef);
    if (filterObj && filterObj.value) {
      filter = filterObj.value();
    } else if (filterObj && filterObj.toString) {
      filter = filterObj.toString();
    }
  }

  // DecodeParms (for predictor info)
  let decodeParms = null;
  const dpRef = dict.get(PDFName.of('DecodeParms'));
  if (dpRef) {
    decodeParms = context.lookup(dpRef);
  }

  // Get raw stream data
  let rawData = null;
  if (xobj.contents) {
    rawData = xobj.contents;
  } else if (xobj.getContents) {
    try {
      rawData = xobj.getContents();
    } catch {
      // fallback
    }
  }

  if (!rawData) return null;

  // Determine format and extract image buffer
  let imageBuffer = null;
  let format = 'unknown';

  if (filter) {
    const filterLower = filter.toLowerCase().replace(/^\//, '');

    if (filterLower === 'dctdecode' || filterLower === 'dct') {
      // JPEG - use directly
      format = 'jpeg';
      imageBuffer = Buffer.from(rawData);
    } else if (filterLower === 'flatedecode' || filterLower === 'flate') {
      // Flate-compressed raw image data
      format = 'raw';
      try {
        imageBuffer = zlib.inflateSync(Buffer.from(rawData));
      } catch {
        imageBuffer = Buffer.from(rawData);
        format = 'raw-unsafe';
      }
    } else if (filterLower === 'lzwdecode' || filterLower === 'lzw') {
      format = 'lzw';
      imageBuffer = Buffer.from(rawData); // LZW not easily decompressible without library
    } else if (filterLower === 'asciihexdecode') {
      format = 'hex';
      const hex = Buffer.from(rawData).toString('ascii').trim();
      const cleanHex = hex.replace(/\s/g, '').replace(/>$/, '');
      imageBuffer = Buffer.from(cleanHex, 'hex');
    } else if (filterLower === 'ascii85decode') {
      format = 'ascii85';
      imageBuffer = Buffer.from(rawData); // Would need ascii85 decode
    } else {
      format = filterLower;
      imageBuffer = Buffer.from(rawData);
    }
  } else {
    // No filter = raw image data
    format = 'raw';
    imageBuffer = Buffer.from(rawData);
  }

  // Convert raw RGB data to PNG if needed
  if (format === 'raw' && imageBuffer) {
    const pngBuffer = rawToPng(imageBuffer, width, height, colorSpace, bitsPerComponent);
    if (pngBuffer) {
      imageBuffer = pngBuffer;
      format = 'png';
    }
  }

  // For CMYK JPEG, we'll embed as-is (Word can handle it)
  // For Gray JPEG, also embed as-is

  if (!imageBuffer || imageBuffer.length === 0) return null;

  // Calculate bounding box in PDF points
  const bbox = computeImageBBox(xobj, context);

  return {
    width,
    height,
    colorSpace,
    bitsPerComponent,
    filter,
    format,
    imageBuffer,
    bbox,
    size: imageBuffer.length,
  };
}

/**
 * Get a numeric value from a PDF dictionary entry.
 */
function getNumber(dict, key, context) {
  const ref = dict.get(key);
  if (!ref) return null;
  const obj = context.lookup(ref);
  if (obj && obj.value) return obj.value();
  if (typeof ref === 'number') return ref;
  return null;
}

/**
 * Compute image bounding box from the transformation matrix in the content stream.
 * This is approximate - the actual position depends on the CTM at paint time.
 */
function computeImageBBox(xobj, context) {
  // Default bounding box (will be overridden by paint position)
  return { x: 0, y: 0, width: 0, height: 0 };
}

/**
 * Convert raw image buffer to PNG.
 * Handles RGB (24-bit) and Gray (8-bit) input.
 */
function rawToPng(rawData, width, height, colorSpace, bitsPerComponent) {
  try {
    if (bitsPerComponent !== 8) return null;

    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const colorType = colorSpace === 'Gray' ? 0 : 2;
    const channels = colorSpace === 'Gray' ? 1 : 3;

    // IHDR
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = colorType;
    ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

    // Check if raw data has enough bytes
    const expectedLen = width * height * channels;
    if (rawData.length < expectedLen) return null;

    // Add filter bytes (none for each row)
    const rowStride = width * channels;
    const rawFiltered = Buffer.alloc(height * (1 + rowStride));
    for (let y = 0; y < height; y++) {
      rawFiltered[y * (1 + rowStride)] = 0; // filter: none
      rawData.copy(rawFiltered, y * (1 + rowStride) + 1, y * rowStride, y * rowStride + rowStride);
    }

    const compressed = zlib.deflateSync(rawFiltered);

    function crc32(buf) {
      let c = 0xFFFFFFFF;
      for (let i = 0; i < buf.length; i++) {
        c ^= buf[i];
        for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0);
      }
      return (c ^ 0xFFFFFFFF) | 0;
    }

    function makeChunk(type, data) {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length, 0);
      const typeB = Buffer.from(type, 'ascii');
      const crcBuf = Buffer.alloc(4);
      crcBuf.writeInt32BE(crc32(Buffer.concat([typeB, data])), 0);
      return Buffer.concat([len, typeB, data, crcBuf]);
    }

    return Buffer.concat([
      sig,
      makeChunk('IHDR', ihdr),
      makeChunk('IDAT', compressed),
      makeChunk('IEND', Buffer.alloc(0)),
    ]);
  } catch {
    return null;
  }
}

module.exports = { extractImages };
