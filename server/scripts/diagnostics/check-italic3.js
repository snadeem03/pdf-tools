const AdmZip = require('adm-zip');
const zip = new AdmZip('uploads/ilovepdf-reference.docx');
const doc = zip.getEntry('word/document.xml').getData().toString('utf8');

const regex = /<w:r>[\s\S]*?<w:rPr>[\s\S]*?<w:i\/>[\s\S]*?<\/w:rPr>[\s\S]*?<w:t[^>]*>([\s\S]*?)<\/w:t>[\s\S]*?<\/w:r>/g;
let m;
let italicTexts = [];
while ((m = regex.exec(doc)) !== null) {
  italicTexts.push({ text: m[1].substring(0, 80), pos: m.index });
}
console.log('Total italic runs:', italicTexts.length);

// Group by contiguous phrases
let phrases = [];
let buf = '';
let lastPos = -100;
for (const run of italicTexts) {
  if (run.pos - lastPos > 10 && buf.trim()) {
    phrases.push(buf.trim());
    buf = '';
  }
  buf += run.text;
  lastPos = run.pos + run.text.length;
}
if (buf.trim()) phrases.push(buf.trim());

console.log('\nItalic phrases (' + phrases.length + '):');
for (let i = 0; i < phrases.length; i++) {
  console.log('  ' + (i+1) + '. "' + phrases[i].replace(/\n/g, ' ').substring(0, 100) + '"');
}
