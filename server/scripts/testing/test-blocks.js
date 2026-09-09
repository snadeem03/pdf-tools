/**
 * Phase 3: Detailed block analysis for both PDFs.
 */

const fs = require('fs');
const path = require('path');
const { extractTextItems } = require('./utils/pdfLayout/extractTextItems');
const { groupLines } = require('./utils/pdfLayout/groupLines');
const { classifyZones } = require('./utils/pdfLayout/classifyZones');
const { groupBlocks } = require('./utils/pdfLayout/groupBlocks');

const TEST_PDFS = [
  { name: 'SRS-test.pdf', path: './uploads/SRS-test.pdf' },
  { name: 'Research_Paper_Final-split.pdf', path: './uploads/1788798748532-937146359-Research_Paper_Final-split.pdf' },
];

async function analyzeBlocks() {
  console.log('=== Phase 3: Block Analysis ===\n');
  
  for (const pdf of TEST_PDFS) {
    const pdfPath = path.join(__dirname, pdf.path);
    if (!fs.existsSync(pdfPath)) continue;
    
    console.log(`--- ${pdf.name} ---`);
    
    try {
      const pdfBuffer = fs.readFileSync(pdfPath);
      const { pages } = await extractTextItems(pdfBuffer);
      
      const processedPages = [];
      for (const page of pages) {
        const lines = groupLines(page.items, page.height).filter(Boolean);
        processedPages.push({
          pageIndex: page.pageIndex,
          width: page.width,
          height: page.height,
          items: page.items,
          lines,
        });
      }
      
      classifyZones(processedPages);
      
      for (const page of processedPages) {
        const blocks = groupBlocks(page.lines);
        console.log(`\nPage ${page.pageIndex + 1}: ${blocks.length} blocks`);
        
        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i];
          const zone = block.zone || 'BODY';
          const heading = block.isHeading ? `[H${block.headingLevel}]` : '[P]';
          const text = block.text.substring(0, 70) + (block.text.length > 70 ? '...' : '');
          console.log(`  ${i+1}. ${heading} ${zone} (${block.lineCount} lines) "${text}"`);
        }
      }
      
    } catch (error) {
      console.log(`✗ Failed: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('=== Analysis Complete ===');
}

analyzeBlocks().catch(console.error);
