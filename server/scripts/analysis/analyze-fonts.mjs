import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const data = new Uint8Array(fs.readFileSync('./uploads/source.pdf'));
const pdf = await getDocument({ data }).promise;

// Analyze font usage patterns across the whole document
const allFontData = {};

for (let p = 1; p <= pdf.numPages; p++) {
  const page = await pdf.getPage(p);
  const content = await page.getTextContent();
  
  for (const item of content.items) {
    const fn = item.fontName;
    if (!allFontData[fn]) {
      allFontData[fn] = {
        count: 0,
        sizes: new Set(),
        widths: [],
        items: [],
      };
    }
    const d = allFontData[fn];
    d.count++;
    const fs = Math.round(Math.abs(item.transform[3]) * 10) / 10;
    d.sizes.add(fs);
    d.widths.push(item.width);
    if (d.items.length < 10) {
      d.items.push({
        str: item.str.substring(0, 40),
        fs,
        w: item.width.toFixed(3),
        h: item.height.toFixed(3),
        x: item.transform[4].toFixed(1),
        y: item.transform[5].toFixed(1),
        t1: item.transform[1].toFixed(4),
        t2: item.transform[2].toFixed(4),
      });
    }
  }
}

console.log('=== Font Analysis (all pages) ===\n');
for (const [fn, d] of Object.entries(allFontData).sort((a, b) => b[1].count - a[1].count)) {
  const avgW = d.widths.reduce((a, b) => a + b, 0) / d.widths.length;
  console.log(`${fn}: count=${d.count}, sizes=[${[...d.sizes].sort((a,b)=>a-b).join(',')}]`);
  console.log(`  avgWidth=${avgW.toFixed(3)}`);
  for (const it of d.items) {
    console.log(`  "${it.str}" fs=${it.fs} w=${it.w} h=${it.h} transform=[${it.t1},${it.t2}]`);
  }
  console.log('');
}

// Compare font widths for same-size text to detect bold variants
console.log('=== Bold Detection by Width Analysis ===\n');
const bySize = {};
for (const [fn, d] of Object.entries(allFontData)) {
  for (const size of d.sizes) {
    const key = `${size}`;
    if (!bySize[key]) bySize[key] = {};
    const items = d.items.filter(it => it.fs === size);
    if (items.length > 0) {
      const avgW = items.reduce((a, it) => a + parseFloat(it.w), 0) / items.length;
      bySize[key][fn] = { avgW: avgW.toFixed(3), count: items.length };
    }
  }
}

for (const [size, fonts] of Object.entries(bySize).sort((a,b) => parseFloat(a[0]) - parseFloat(b[0]))) {
  console.log(`Size ${size}pt:`);
  for (const [fn, info] of Object.entries(fonts)) {
    console.log(`  ${fn}: avgW=${info.avgW} (${info.count} samples)`);
  }
}
