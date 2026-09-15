const AdmZip = require('adm-zip');
const zip = new AdmZip('uploads/ilovepdf-reference.docx');
const doc = zip.getEntry('word/document.xml').getData().toString('utf8');

// Find ALL italic text runs
const regex = /<w:r>[\s\S]*?<w:rPr>[\s\S]*?<w:i\/>[\s\S]*?<\/w:rPr>[\s\S]*?<w:t[^>]*>([\s\S]*?)<\/w:t>[\s\S]*?<\/w:r>/g;
let m;
let italicTexts = [];
while ((m = regex.exec(doc)) !== null) {
  italicTexts.push({ text: m[1].substring(0, 80), pos: m.index });
}
console.log('Total italic runs (strict):', italicTexts.length);

// Also try with <w:i/> nested in rPr more loosely
const regex2 = /<w:r[^>]*>[\s\S]*?<w:rPr>[\s\S]*?<w:i[\s\/]/>[\s\S]*?<\/w:rPr>[\s\S]*?<w:t[^>]*>([\s\S]*?)<\/w:t>[\s\S]*?<\/w:r>/g;
let italicTexts2 = [];
while ((m = regex2.exec(doc)) !== null) {
  italicTexts2.push(m[1]);
}
console.log('Total italic runs (loose):', italicTexts2.length);

// Group consecutive italic runs into phrases
let phrases = [];
let currentPhrase = '';
for (const run of italicTexts) {
  if (currentPhrase && run.pos - phrases[phrases.length - 1]?.end > 5) {
    if (currentPhrase.trim()) phrases.push({ text: currentPhrase.trim() });
    currentPhrase = run.text;
  } else {
    currentPhrase += run.text;
  }
  phrases.push({ text: '', end: run.pos + run.text.length });
}
if (currentPhrase.trim()) phrases.push({ text: currentPhrase.trim() });

// Show unique italic phrases
let uniquePhrases = new Set();
for (const run of italicTexts) {
  uniquePhrases.add(run.text);
}
console.log('\nUnique italic text values (' + uniquePhrases.size + '):');
for (const p of uniquePhrases) {
  if (p.trim()) console.log('  "' + p.replace(/\n/g, ' ') + '"');
}
