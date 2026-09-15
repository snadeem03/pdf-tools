/**
 * Generate a simple SRS test PDF for regression testing.
 */
const { PDFDocument, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function createSrsTestPdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  // Page 1
  const page1 = doc.addPage([612, 792]);
  page1.drawText('Software Requirements Specification', { x: 150, y: 750, size: 20, font: boldFont });
  page1.drawText('Project: Test Application', { x: 50, y: 710, size: 12, font });
  page1.drawText('Version: 1.0', { x: 50, y: 690, size: 12, font });
  page1.drawText('Date: 2026-09-07', { x: 50, y: 670, size: 12, font });

  // Table on page 1
  page1.drawText('Requirements Table', { x: 50, y: 630, size: 14, font: boldFont });
  page1.drawText('ID', { x: 50, y: 600, size: 10, font: boldFont });
  page1.drawText('Requirement', { x: 100, y: 600, size: 10, font: boldFont });
  page1.drawText('Priority', { x: 400, y: 600, size: 10, font: boldFont });
  page1.drawText('REQ-001', { x: 50, y: 580, size: 10, font });
  page1.drawText('System shall support user login', { x: 100, y: 580, size: 10, font });
  page1.drawText('High', { x: 400, y: 580, size: 10, font });
  page1.drawText('REQ-002', { x: 50, y: 560, size: 10, font });
  page1.drawText('System shall support data export', { x: 100, y: 560, size: 10, font });
  page1.drawText('Medium', { x: 400, y: 560, size: 10, font });
  page1.drawText('REQ-003', { x: 50, y: 540, size: 10, font });
  page1.drawText('System shall generate reports', { x: 100, y: 540, size: 10, font });
  page1.drawText('Low', { x: 400, y: 540, size: 10, font });

  // Page 2
  const page2 = doc.addPage([612, 792]);
  page2.drawText('Functional Requirements', { x: 50, y: 750, size: 16, font: boldFont });
  page2.drawText('1.1 User Authentication', { x: 70, y: 720, size: 12, font: boldFont });
  page2.drawText('The system shall allow users to log in with username and password.', { x: 70, y: 700, size: 10, font });
  page2.drawText('1.2 Data Management', { x: 70, y: 670, size: 12, font: boldFont });
  page2.drawText('The system shall support CRUD operations on all entities.', { x: 70, y: 650, size: 10, font });

  const bytes = await doc.save();
  const outPath = path.join(__dirname, 'uploads', 'SRS-test.pdf');
  fs.writeFileSync(outPath, bytes);
  console.log(`Created ${outPath} (${bytes.length} bytes)`);
}

createSrsTestPdf().catch(console.error);
