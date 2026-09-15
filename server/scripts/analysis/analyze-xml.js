const fs = require('fs');
const pn = fs.readFileSync('uploads/pdfnova-xml.xml','utf8');
const il = fs.readFileSync('uploads/ilovepdf-xml.xml','utf8');

// Extract sectPr sections
const pnSect = pn.match(/<w:sectPr[^>]*>[\s\S]*?<\/w:sectPr>/g);
const ilSect = il.match(/<w:sectPr[^>]*>[\s\S]*?<\/w:sectPr>/g);
console.log('PDFNova section properties:');
(pnSect||[]).forEach((s,i) => console.log('  SectPr', i+1, ':', s.substring(0,500)));
console.log();
console.log('iLovePDF section properties:');
(ilSect||[]).forEach((s,i) => console.log('  SectPr', i+1, ':', s.substring(0,500)));

// Find table structures
console.log('\n=== PDFNova tables ===');
const pnTables = pn.match(/<w:tbl[\s\S]*?<\/w:tbl>/g);
(pnTables||[]).forEach((t,i) => {
  console.log('Table', i+1, 'length:', t.length);
  const cols = t.match(/w:gridCol w:w="(\d+)"/g);
  console.log('  Columns:', cols?cols.join(', '):'none');
  const rows = t.match(/<w:tr[\s>]/g);
  console.log('  Rows:', rows?rows.length:0);
});

console.log('\n=== iLovePDF tables ===');
const ilTables = il.match(/<w:tbl[\s\S]*?<\/w:tbl>/g);
(ilTables||[]).forEach((t,i) => {
  console.log('Table', i+1, 'length:', t.length);
  const cols = t.match(/w:gridCol w:w="(\d+)"/g);
  console.log('  Columns:', cols?cols.join(', '):'none');
  const rows = t.match(/<w:tr[\s>]/g);
  console.log('  Rows:', rows?rows.length:0);
  const tblPr = t.match(/<w:tblPr[\s\S]*?<\/w:tblPr>/);
  if(tblPr) console.log('  tblPr:', tblPr[0].substring(0,300));
});

// Compare first 2000 chars of each document.xml
console.log('\n=== PDFNova document.xml first 2000 chars ===');
console.log(pn.substring(0,2000));
console.log('\n=== iLovePDF document.xml first 2000 chars ===');
console.log(il.substring(0,2000));
