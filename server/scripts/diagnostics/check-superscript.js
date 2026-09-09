const AdmZip = require('adm-zip');
const zip = new AdmZip('uploads/ilovepdf-reference.docx');
const doc = zip.getEntry('word/document.xml').getData().toString('utf8');

// Find superscript runs
const regex = /<w:r>[\s\S]*?<w:rPr>[\s\S]*?<w:vertAlign w:val="superscript"\/>[\s\S]*?<\/w:rPr>[\s\S]*?<w:t[^>]*>([\s\S]*?)<\/w:t>[\s\S]*?<\/w:r>/g;
let m;
let supers = [];
while ((m = regex.exec(doc)) !== null) {
  supers.push(m[1]);
}
console.log('Superscript runs:', supers.length);
for (let i = 0; i < supers.length; i++) {
  console.log('  ' + (i+1) + '. "' + supers[i] + '"');
}
