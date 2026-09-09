const AdmZip = require('adm-zip');
const zip = new AdmZip('uploads/ilovepdf-reference.docx');
const doc = zip.readAsText('word/document.xml');

const paragraphs = doc.match(/<w:p>[\s\S]*?<\/w:p>/g) || [];
let boldParas = 0;
let italicParas = 0;
const boldSamples = [];
const italicSamples = [];

for (const p of paragraphs) {
  const hasBold = p.includes('<w:b/>') || p.includes('<w:b w:val="true"');
  const hasItalic = p.includes('<w:i/>') || p.includes('<w:i w:val="true"');
  
  if (hasBold) {
    boldParas++;
    if (boldSamples.length < 15) {
      const text = p.replace(/<[^>]+>/g, '').trim();
      if (text.length > 0) boldSamples.push(text.substring(0, 100));
    }
  }
  if (hasItalic) {
    italicParas++;
    if (italicSamples.length < 15) {
      const text = p.replace(/<[^>]+>/g, '').trim();
      if (text.length > 0) italicSamples.push(text.substring(0, 100));
    }
  }
}

console.log('Bold paragraphs: ' + boldParas + '/' + paragraphs.length);
console.log('Italic paragraphs: ' + italicParas + '/' + paragraphs.length);
console.log('\nBold samples:');
boldSamples.forEach((s, i) => console.log('  ' + i + ': ' + s));
console.log('\nItalic samples:');
italicSamples.forEach((s, i) => console.log('  ' + i + ': ' + s));

// Also check which paragraph styles have bold
const styleMatches = doc.match(/<w:pStyle w:val="([^"]+)"/g) || [];
const styleBold = {};
for (const p of paragraphs) {
  const hasBold = p.includes('<w:b/>') || p.includes('<w:b w:val="true"');
  const styleMatch = p.match(/<w:pStyle w:val="([^"]+)"/);
  if (styleMatch) {
    const style = styleMatch[1];
    if (!styleBold[style]) styleBold[style] = { total: 0, bold: 0 };
    styleBold[style].total++;
    if (hasBold) styleBold[style].bold++;
  }
}
console.log('\nStyle bold distribution:');
for (const [style, counts] of Object.entries(styleBold)) {
  console.log('  ' + style + ': ' + counts.bold + '/' + counts.total + ' bold');
}
