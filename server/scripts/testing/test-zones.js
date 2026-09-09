/**
 * Phase 2: Zone classification test.
 * Produces diagnostic report for both regression PDFs.
 */

const fs = require('fs');
const path = require('path');
const { extractTextItems } = require('./utils/pdfLayout/extractTextItems');
const { groupLines } = require('./utils/pdfLayout/groupLines');
const { classifyZones } = require('./utils/pdfLayout/classifyZones');

const TEST_PDFS = [
  { name: 'SRS-test.pdf', path: './uploads/SRS-test.pdf' },
  { name: 'Research_Paper_Final-split.pdf', path: './uploads/1788798748532-937146359-Research_Paper_Final-split.pdf' },
];

async function testZoneClassification() {
  console.log('=== Phase 2: Zone Classification Test ===\n');
  
  for (const pdf of TEST_PDFS) {
    const pdfPath = path.join(__dirname, pdf.path);
    if (!fs.existsSync(pdfPath)) {
      console.log(`✗ ${pdf.name}: File not found`);
      continue;
    }
    
    console.log(`--- ${pdf.name} ---`);
    
    try {
      const pdfBuffer = fs.readFileSync(pdfPath);
      const { pages } = await extractTextItems(pdfBuffer);
      
      // Process each page: group lines first
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
      
      // Classify zones on processed pages
      classifyZones(processedPages);
      
      for (const page of processedPages) {
        console.log(`\nPage ${page.pageIndex + 1}:`);
        
        // Count lines per zone
        const zoneCounts = {};
        for (const line of page.lines) {
          const zone = line.zone || 'UNCLASSIFIED';
          zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
        }
        
        console.log(`  Zone counts: ${JSON.stringify(zoneCounts)}`);
        
        // Show lines in each zone
        const zones = ['HEADER', 'TITLE', 'AUTHOR', 'ABSTRACT', 'INDEX_TERMS', 'BODY', 'FOOTER'];
        for (const zone of zones) {
          const lines = page.lines.filter((l) => l.zone === zone);
          if (lines.length > 0) {
            console.log(`\n  ${zone} (${lines.length} lines):`);
            for (const line of lines.slice(0, 5)) {
              const text = line.text.substring(0, 60) + (line.text.length > 60 ? '...' : '');
              console.log(`    y=${line.y.toFixed(0)} "${text}"`);
            }
            if (lines.length > 5) {
              console.log(`    ... and ${lines.length - 5} more`);
            }
          }
        }
      }
      
    } catch (error) {
      console.log(`✗ Test failed: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('=== Test Complete ===');
}

testZoneClassification().catch(console.error);
