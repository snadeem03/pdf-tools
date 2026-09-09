const fs = require('fs');
const { extractTextItems } = require('./utils/pdfLayout/extractTextItems');

async function test() {
  const buf = fs.readFileSync('./uploads/source.pdf');
  const { pages } = await extractTextItems(buf);
  
  const p1 = pages[0];
  const smallItems = p1.items.filter(i => i.fontSize >= 6.0 && i.fontSize <= 7.5 && i.str.trim());
  
  for (const si of smallItems) {
    // The small font items are likely superscripts - their topY is above the baseline
    // Check: are they higher than nearby 10pt items?
    const nearbyItems = p1.items.filter(i => 
      Math.abs(i.x - si.x) < 40 && 
      i.fontSize >= 9 && 
      i.fontSize <= 11 &&
      Math.abs(i.topY - si.topY) < 15 &&
      i.str.trim()
    );
    
    if (nearbyItems.length > 0) {
      const ni = nearbyItems[0];
      const isSuperscript = si.topY < ni.topY; // Higher on page = smaller y = superscript
      console.log('  "' + si.str + '" (size=' + si.fontSize.toFixed(1) + ', topY=' + Math.round(si.topY) + ') near "' + ni.str + '" (topY=' + Math.round(ni.topY) + ') -> ' + (isSuperscript ? 'SUPERSCRIPT' : 'not'));
    } else {
      console.log('  "' + si.str + '" (size=' + si.fontSize.toFixed(1) + ', topY=' + Math.round(si.topY) + ') no nearby text');
    }
  }
}
test();
