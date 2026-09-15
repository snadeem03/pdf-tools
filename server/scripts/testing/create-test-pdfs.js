/**
 * Create test PDFs with embedded images for image extraction testing.
 */
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(width, height, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const rawData = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 3)] = 0;
    for (let x = 0; x < width; x++) {
      const dst = y * (1 + width * 3) + 1 + x * 3;
      // Create a gradient/pattern so images are distinguishable
      rawData[dst] = Math.min(255, r + x * 2);
      rawData[dst + 1] = Math.min(255, g + y * 2);
      rawData[dst + 2] = b;
    }
  }
  const compressed = zlib.deflateSync(rawData);

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
}

async function createTestPdfs() {
  const outDir = path.join(__dirname, '..', '..', 'uploads');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // Test 1: SRS-test with images
  const doc1 = await PDFDocument.create();
  const font = await doc1.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc1.embedFont(StandardFonts.HelveticaBold);

  const page1 = doc1.addPage([612, 792]);
  page1.drawText('SRS with Images', { x: 200, y: 750, size: 20, font: boldFont });
  page1.drawText('Version 1.0', { x: 50, y: 710, size: 12, font });

  // Embed images
  const redPng = createPng(50, 50, 255, 0, 0);
  const redImg = await doc1.embedPng(redPng);
  page1.drawText('Figure 1: Red Image', { x: 50, y: 460, size: 10, font });
  page1.drawImage(redImg, { x: 50, y: 300, width: 200, height: 150 });

  const bluePng = createPng(80, 60, 0, 0, 255);
  const blueImg = await doc1.embedPng(bluePng);
  page1.drawText('Figure 2: Blue Image', { x: 300, y: 460, size: 10, font });
  page1.drawImage(blueImg, { x: 300, y: 300, width: 200, height: 150 });

  const greenPng = createPng(40, 40, 0, 200, 0);
  const greenImg = await doc1.embedPng(greenPng);
  page1.drawImage(greenImg, { x: 200, y: 100, width: 150, height: 100 });

  // Page 2
  const page2 = doc1.addPage([612, 792]);
  page2.drawText('Page 2 with Figure', { x: 50, y: 750, size: 14, font: boldFont });
  const orangePng = createPng(60, 60, 255, 165, 0);
  const orangeImg = await doc1.embedPng(orangePng);
  page2.drawText('Figure 3: Orange Diagram', { x: 50, y: 500, size: 10, font });
  page2.drawImage(orangeImg, { x: 50, y: 300, width: 250, height: 180 });
  page2.drawText('Body text continues after the image.', { x: 50, y: 250, size: 10, font });

  const srsBytes = await doc1.save();
  const srsPath = path.join(outDir, 'SRS-test.pdf');
  fs.writeFileSync(srsPath, srsBytes);
  console.log(`Created: ${srsPath} (${srsBytes.length} bytes, 4 images)`);

  // Test 2: Research paper with images
  const doc2 = await PDFDocument.create();
  const times = await doc2.embedFont(StandardFonts.TimesRoman);
  const timesBold = await doc2.embedFont(StandardFonts.TimesRomanBold);

  // Page 1
  const rp1 = doc2.addPage([595, 842]); // A4
  rp1.drawText('Research Paper with Embedded Figures', { x: 120, y: 800, size: 18, font: timesBold });
  rp1.drawText('Author A, Author B', { x: 200, y: 770, size: 11, font: times });
  rp1.drawText('Abstract', { x: 50, y: 730, size: 12, font: timesBold });
  rp1.drawText('This paper demonstrates image extraction from PDFs.', { x: 50, y: 710, size: 10, font: times });
  rp1.drawText('The figures below show various test patterns.', { x: 50, y: 695, size: 10, font: times });

  // Figure 1: chart-like
  const chartPng = createPng(200, 120, 50, 100, 200);
  const chartImg = await doc2.embedPng(chartPng);
  rp1.drawText('Fig. 1. System Architecture Diagram', { x: 150, y: 540, size: 9, font: times });
  rp1.drawImage(chartImg, { x: 100, y: 380, width: 300, height: 160 });

  // Figure 2: small logo/icon
  const logoPng = createPng(30, 30, 200, 50, 50);
  const logoImg = await doc2.embedPng(logoPng);
  rp1.drawImage(logoImg, { x: 20, y: 810, width: 25, height: 25 });

  // Page 2
  const rp2 = doc2.addPage([595, 842]);
  rp2.drawText('II. Methodology', { x: 50, y: 800, size: 14, font: timesBold });
  rp2.drawText('Our approach uses image extraction from PDF operator lists.', { x: 50, y: 775, size: 10, font: times });
  rp2.drawText('Figure 2 shows the processing pipeline.', { x: 50, y: 755, size: 10, font: times });

  const pipelinePng = createPng(150, 100, 100, 200, 150);
  const pipelineImg = await doc2.embedPng(pipelinePng);
  rp2.drawText('Fig. 2. Processing Pipeline', { x: 200, y: 620, size: 9, font: times });
  rp2.drawImage(pipelineImg, { x: 120, y: 480, width: 280, height: 140 });

  rp2.drawText('III. Results', { x: 50, y: 440, size: 14, font: timesBold });
  rp2.drawText('The results demonstrate effective image preservation.', { x: 50, y: 415, size: 10, font: times });

  // Figure 3 on page 2
  const resultPng = createPng(100, 80, 200, 150, 100);
  const resultImg = await doc2.embedPng(resultPng);
  rp2.drawText('Fig. 3. Results Comparison', { x: 200, y: 380, size: 9, font: times });
  rp2.drawImage(resultImg, { x: 150, y: 250, width: 220, height: 120 });

  // More body text
  rp2.drawText('As shown in Fig. 3, our method achieves comparable results.', { x: 50, y: 220, size: 10, font: times });
  rp2.drawText('The extracted images maintain their original dimensions', { x: 50, y: 205, size: 10, font: times });
  rp2.drawText('and visual quality across different page layouts.', { x: 50, y: 190, size: 10, font: times });

  // Page 3 with more images
  const rp3 = doc2.addPage([595, 842]);
  rp3.drawText('IV. Conclusion', { x: 50, y: 800, size: 14, font: timesBold });
  rp3.drawText('Image preservation is critical for faithful PDF conversion.', { x: 50, y: 775, size: 10, font: times });

  const summaryPng = createPng(180, 100, 150, 100, 200);
  const summaryImg = await doc2.embedPng(summaryPng);
  rp3.drawText('Fig. 4. Summary Statistics', { x: 180, y: 640, size: 9, font: times });
  rp3.drawImage(summaryImg, { x: 130, y: 500, width: 260, height: 130 });

  // Small inline figure
  const smallPng = createPng(20, 20, 255, 200, 0);
  const smallImg = await doc2.embedPng(smallPng);
  rp3.drawImage(smallImg, { x: 265, y: 460, width: 15, height: 15 });
  rp3.drawText('Fig. 5. Inline Icon', { x: 240, y: 440, size: 9, font: times });

  rp3.drawText('References', { x: 50, y: 380, size: 14, font: timesBold });
  rp3.drawText('[1] Smith et al., "PDF Image Extraction", 2024.', { x: 50, y: 355, size: 10, font: times });
  rp3.drawText('[2] Jones, "Document Layout Analysis", 2023.', { x: 50, y: 340, size: 10, font: times });

  const rpBytes = await doc2.save();
  const rpPath = path.join(outDir, 'Research_Paper_Final-split.pdf');
  fs.writeFileSync(rpPath, rpBytes);
  console.log(`Created: ${rpPath} (${rpBytes.length} bytes, 7 images)`);
}

createTestPdfs().catch(console.error);
