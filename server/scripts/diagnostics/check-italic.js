const AdmZip = require('adm-zip');
const zip = new AdmZip('uploads/ilovepdf-reference.docx');
const doc = zip.getEntry('word/document.xml').getData().toString('utf8');

// Check abstract body text italic status
const abstractIdx = doc.indexOf('Abstract');
const abstractContext = doc.substring(abstractIdx, abstractIdx + 2000);

// Extract runs around "Fault tolerance"
const ftIdx = doc.indexOf('Fault tolerance');
const ftRunContext = doc.substring(Math.max(0, ftIdx - 500), ftIdx + 500);

// Check if "Fault tolerance" run has italic
const runRegex = /<w:r>([\s\S]*?)<\/w:r>/g;
let rm;
let inAbstract = false;
let abstractRuns = [];
let ftRuns = [];
while ((rm = runRegex.exec(doc)) !== null) {
  const start = rm.index;
  const end = start + rm[0].length;
  const text = (rm[0].match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/) || [,''])[1];
  const hasItalic = rm[0].includes('<w:i/>');
  
  if (start < ftIdx + 200 && start > ftIdx - 500) {
    ftRuns.push({ text: text.substring(0, 60), italic: hasItalic, pos: start });
  }
}

console.log('Runs near "Fault tolerance":');
for (const r of ftRuns) {
  console.log('  ' + (r.italic ? 'ITALIC' : '      ') + ' "' + r.text + '"');
}

// Check: abstract runs
const absLabelIdx = doc.indexOf('Abstract\u2014');
const abstractBodyStart = doc.indexOf('Fault', absLabelIdx);
let absRuns = [];
while ((rm = runRegex.exec(doc)) !== null) {
  const text = (rm[0].match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/) || [,''])[1];
  const hasItalic = rm[0].includes('<w:i/>');
  if (rm.index > absLabelIdx && rm.index < absLabelIdx + 3000 && text.length > 0) {
    absRuns.push({ text: text.substring(0, 60), italic: hasItalic });
  }
  if (absRuns.length > 20) break;
}

console.log('\nFirst 20 abstract runs:');
for (const r of absRuns) {
  console.log('  ' + (r.italic ? 'ITALIC' : '      ') + ' "' + r.text + '"');
}
