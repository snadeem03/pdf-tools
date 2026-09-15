const AdmZip = require('adm-zip');
const zip = new AdmZip('uploads/ilovepdf-reference.docx');
const doc = zip.getEntry('word/document.xml').getData().toString('utf8');

// Find ALL bold runs and show their text + context
const runRegex = /<w:r>[\s\S]*?<\/w:r>/g;
let rm;
let boldRuns = [];

while ((rm = runRegex.exec(doc)) !== null) {
  if (rm[0].includes('<w:b/>')) {
    const text = (rm[0].match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/) || [,''])[1];
    if (text.trim()) boldRuns.push(text.trim());
  }
}

console.log('Total bold runs with text:', boldRuns.length);

// Group consecutive short bold runs into phrases
let phrases = [];
let buf = '';
for (const t of boldRuns) {
  if (t.length <= 3 && buf.length > 0) {
    buf += t;
  } else {
    if (buf.trim()) phrases.push(buf.trim());
    buf = t;
  }
}
if (buf.trim()) phrases.push(buf.trim());

console.log('\nBold phrases (' + phrases.length + '):');
for (let i = 0; i < phrases.length; i++) {
  console.log('  ' + (i+1) + '. "' + phrases[i].substring(0, 80) + '"');
}
