/**
 * Quick test: convert a PDF and inspect formatting transitions in the output.
 */
const fs = require('fs');
const path = require('path');
const { convertPdfToDocx } = require('./utils/pdfLayout/index');

const PDF_PATH = path.join(__dirname, 'uploads', 'formatting-test.pdf');
const OUT_PATH = path.join(__dirname, 'uploads', 'formatting-test-output.docx');

async function test() {
  const pdfBytes = fs.readFileSync(PDF_PATH);
  const { buffer, stats } = await convertPdfToDocx(pdfBytes, { debug: true });

  fs.writeFileSync(OUT_PATH, buffer);
  console.log(`\nOutput: ${OUT_PATH} (${buffer.length} bytes)`);
  console.log('Stats:', JSON.stringify(stats, null, 2));

  // Inspect the docx structure
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(buffer);
  const docXml = zip.readAsText('word/document.xml');

  // Count paragraphs, runs, bold, italic, superscript
  const paragraphs = (docXml.match(/<w:p[ >]/g) || []).length;
  const runs = (docXml.match(/<w:r[ >]/g) || []).length;
  const bolds = (docXml.match(/<w:b\/>/g) || []).length;
  const italics = (docXml.match(/<w:i\/>/g) || []).length;
  const superscripts = (docXml.match(/<w:vertAlign w:val="superscript"\/>/g) || []).length;
  const courierRuns = (docXml.match(/w:ascii="Courier New"/g) || []).length;

  console.log(`\nDOCX structure:`);
  console.log(`  Paragraphs: ${paragraphs}`);
  console.log(`  Total runs: ${runs}`);
  console.log(`  Bold runs:  ${bolds}`);
  console.log(`  Italic runs: ${italics}`);
  console.log(`  Superscript runs: ${superscripts}`);
  console.log(`  Courier runs: ${courierRuns}`);

  // Show first few paragraphs with their run details
  const paraRegex = /<w:p[\s\S]*?<\/w:p>/g;
  const paras = docXml.match(paraRegex) || [];
  console.log(`\nFirst 10 paragraphs:`);
  for (let i = 0; i < Math.min(10, paras.length); i++) {
    const p = paras[i];
    const text = (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
      .map(t => t.replace(/<[^>]+>/g, ''))
      .join('');
    const hasBold = p.includes('<w:b/>');
    const hasItalic = p.includes('<w:i/>');
    const hasSuper = p.includes('superscript');
    const font = (p.match(/w:ascii="([^"]+)"/) || [])[1] || '?';
    const style = (p.match(/w:pStyle w:val="([^"]+)"/) || [])[1] || 'Normal';
    console.log(`  [${i}] "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`);
    console.log(`      style=${style} font=${font} bold=${hasBold} italic=${hasItalic} super=${hasSuper}`);
  }
}

test().catch(console.error);
