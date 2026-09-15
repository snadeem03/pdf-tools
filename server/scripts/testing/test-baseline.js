/**
 * Phase 0: Baseline conversion test for both regression PDFs.
 * Converts PDFs to DOCX and documents current problems.
 */

const fs = require('fs');
const path = require('path');
const { convertPdfToDocx } = require('./utils/pdfLayout');

const TEST_PDFS = [
  { name: 'SRS-test.pdf', path: './uploads/SRS-test.pdf' },
  { name: 'Research_Paper_Final-split.pdf', path: './uploads/1788798748532-937146359-Research_Paper_Final-split.pdf' },
];

async function runBaselineTest() {
  console.log('=== Phase 0: Baseline Conversion Test ===\n');
  
  for (const pdf of TEST_PDFS) {
    const pdfPath = path.join(__dirname, pdf.path);
    if (!fs.existsSync(pdfPath)) {
      console.log(`✗ ${pdf.name}: File not found at ${pdfPath}`);
      continue;
    }
    
    console.log(`--- Testing: ${pdf.name} ---`);
    
    try {
      const pdfBuffer = fs.readFileSync(pdfPath);
      const { buffer, stats } = await convertPdfToDocx(pdfBuffer, { debug: true });
      
      // Save DOCX for inspection
      const outputPath = path.join(__dirname, `uploads/baseline-${pdf.name.replace('.pdf', '.docx')}`);
      fs.writeFileSync(outputPath, buffer);
      
      console.log(`✓ Converted successfully`);
      console.log(`  Pages: ${stats.totalPages}`);
      console.log(`  Items: ${stats.totalItems}`);
      console.log(`  Lines: ${stats.totalLines}`);
      console.log(`  Blocks: ${stats.totalBlocks}`);
      console.log(`  Tables: ${stats.tablesDetected}`);
      console.log(`  Output: ${outputPath}`);
      
      // Analyze block types
      const blockTypes = {};
      // Note: We'd need to get block details to analyze this
      
    } catch (error) {
      console.log(`✗ Conversion failed: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('=== Baseline Test Complete ===');
}

runBaselineTest().catch(console.error);
