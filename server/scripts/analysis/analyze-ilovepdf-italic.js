const AdmZip = require('adm-zip');
const zip = new AdmZip('uploads/ilovepdf-reference.docx');
const doc = zip.getEntry('word/document.xml').getData().toString('utf8');

const italicTexts = [];
const regex = /<w:r>[\s\S]*?<w:rPr>[\s\S]*?<w:i\/>[\s\S]*?<\/w:rPr>[\s\S]*?<w:t[^>]*>([\s\S]*?)<\/w:t>[\s\S]*?<\/w:r>/g;
let m;
while ((m = regex.exec(doc)) !== null) {
  italicTexts.push(m[1]);
}
console.log('Total italic runs:', italicTexts.length);
console.log('Samples:');
for (let i = 0; i < Math.min(50, italicTexts.length); i++) {
  const t = italicTexts[i].replace(/\n/g, ' ').substring(0, 80);
  console.log('  ' + (i+1) + '. "' + t + '"');
}

// Also check where italic is used (by paragraph style)
const paraRegex = /<w:p[\s\S]*?<\/w:p>/g;
let paraMatch;
let italicParaStyles = {};
let idx = 0;
while ((paraMatch = paraRegex.exec(doc)) !== null) {
  const pStyle = paraMatch[0].match(/<w:pStyle w:val="([^"]+)"/);
  const hasItalic = /<w:i\/>/.test(paraMatch[0].match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] || '');
  if (hasItalic) {
    const style = pStyle ? pStyle[1] : 'normal';
    italicParaStyles[style] = (italicParaStyles[style] || 0) + 1;
  }
  idx++;
}
console.log('\nItalic by paragraph style:', JSON.stringify(italicParaStyles, null, 2));
