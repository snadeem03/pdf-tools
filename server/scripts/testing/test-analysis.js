/**
 * Phase 0: Detailed analysis of conversion quality.
 * Examines blocks, tables, typography, etc.
 */

const fs = require('fs');
const path = require('path');
const { extractTextItems } = require('./utils/pdfLayout/extractTextItems');
const { groupLines } = require('./utils/pdfLayout/groupLines');
const { groupBlocks } = require('./utils/pdfLayout/groupBlocks');
const { detectTables } = require('./utils/pdfLayout/detectTables');

const TEST_PDFS = [
  { name: 'SRS-test.pdf', path: './uploads/SRS-test.pdf' },
  { name: 'Research_Paper_Final-split.pdf', path: './uploads/1788798748532-937146359-Research_Paper_Final-split.pdf' },
];

async function analyzeConversion() {
  console.log('=== Phase 0: Conversion Quality Analysis ===\n');
  
  for (const pdf of TEST_PDFS) {
    const pdfPath = path.join(__dirname, pdf.path);
    if (!fs.existsSync(pdfPath)) {
      console.log(`✗ ${pdf.name}: File not found`);
      continue;
    }
    
    console.log(`--- Analyzing: ${pdf.name} ---`);
    
    try {
      const pdfBuffer = fs.readFileSync(pdfPath);
      const { pages } = await extractTextItems(pdfBuffer);
      
      for (const page of pages) {
        console.log(`\nPage ${page.pageIndex + 1}:`);
        console.log(`  Dimensions: ${page.width} x ${page.height} pts`);
        
        // Group into lines
        const lines = groupLines(page.items, page.height).filter(Boolean);
        console.log(`  Lines: ${lines.length}`);
        
        // Group into blocks
        const blocks = groupBlocks(lines);
        console.log(`  Blocks: ${blocks.length}`);
        
        // Detect tables
        const { tables, remaining } = detectTables(blocks, page.width);
        console.log(`  Tables: ${tables.length}`);
        console.log(`  Remaining blocks after tables: ${remaining.length}`);
        
        // Analyze block types
        const blockAnalysis = {
          headings: 0,
          listItems: 0,
          justified: 0,
          centered: 0,
          leftAligned: 0,
          rightAligned: 0,
          fontSizes: {},
        };
        
        for (const block of blocks) {
          if (block.isHeading) blockAnalysis.headings++;
          if (block.isListItem) blockAnalysis.listItems++;
          
          switch (block.alignment) {
            case 'justified': blockAnalysis.justified++; break;
            case 'center': blockAnalysis.centered++; break;
            case 'left': blockAnalysis.leftAligned++; break;
            case 'right': blockAnalysis.rightAligned++; break;
          }
          
          const size = Math.round(block.fontSize);
          blockAnalysis.fontSizes[size] = (blockAnalysis.fontSizes[size] || 0) + 1;
        }
        
        console.log(`  Block analysis:`);
        console.log(`    Headings: ${blockAnalysis.headings}`);
        console.log(`    List items: ${blockAnalysis.listItems}`);
        console.log(`    Justified: ${blockAnalysis.justified}`);
        console.log(`    Centered: ${blockAnalysis.centered}`);
        console.log(`    Left: ${blockAnalysis.leftAligned}`);
        console.log(`    Right: ${blockAnalysis.rightAligned}`);
        console.log(`    Font sizes: ${JSON.stringify(blockAnalysis.fontSizes)}`);
        
        // Sample text from first few blocks
        console.log(`  Sample blocks:`);
        for (let i = 0; i < Math.min(5, blocks.length); i++) {
          const block = blocks[i];
          const text = block.text.substring(0, 80) + (block.text.length > 80 ? '...' : '');
          console.log(`    [${block.isHeading ? 'H' : 'P'}] "${text}"`);
        }
      }
      
    } catch (error) {
      console.log(`✗ Analysis failed: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('=== Analysis Complete ===');
}

analyzeConversion().catch(console.error);
