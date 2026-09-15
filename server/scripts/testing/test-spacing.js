/**
 * Quick test: verify word spacing reconstruction for both PDFs.
 */
const fs = require('fs');
const path = require('path');
const { extractTextItems } = require('./utils/pdfLayout/extractTextItems');
const { groupLines } = require('./utils/pdfLayout/groupLines');

const PDFS = [
  { name: 'SRS-test.pdf', path: path.join(__dirname, 'uploads', 'SRS-test.pdf') },
  { name: 'Research_Paper_Final-split.pdf', path: path.join(__dirname, 'uploads', '1788798748532-937146359-Research_Paper_Final-split.pdf') },
];

const CHECKS = [
  'Comparative Experimental Analysis',
  'Department of Information Technology',
  'College of Engineering',
  'International Journal of Engineering Development and Research',
  'Subtitle as needed',
  'Tanishq Narayan',
  'IG Student',
  'Bharati Vidyapeeth',
  'Abstract',
  'Index Terms',
  'ENstp',
];

(async () => {
  for (const pdf of PDFS) {
    if (!fs.existsSync(pdf.path)) { console.log(`SKIP: ${pdf.name} not found`); continue; }
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TESTING: ${pdf.name}`);
    console.log(`${'='.repeat(60)}`);

    const bytes = fs.readFileSync(pdf.path);
    const { pages } = await extractTextItems(bytes);

    for (const page of pages) {
      const lines = groupLines(page.items, page.height).filter(Boolean);
      console.log(`\n--- Page ${page.pageIndex + 1}: ${lines.length} lines ---`);

      for (const line of lines) {
        console.log(`  y=${Math.round(line.y).toString().padStart(4)} "${line.text}"`);
      }

      // Check specific strings
      const allText = lines.map(l => l.text).join('\n');
      for (const check of CHECKS) {
        if (allText.includes(check)) {
          console.log(`  ✓ FOUND: "${check}"`);
        }
      }
    }
  }

  // Check for the specific problematic concatenations
  console.log(`\n${'='.repeat(60)}`);
  console.log('SPACING VERIFICATION');
  console.log(`${'='.repeat(60)}`);

  const badPatterns = [
    'ComparativeExperimental',
    'ExperimentalAnalysis',
    'AnalysisOf',
    'ToleranceMechanisms',
    'MechanismsInCaseOf',
    'DepartmentofInformation',
    'InformationTechnology',
    'CollegeofEngineering',
    'InternationalJournal',
    'JournalofEngineering',
    'EngineeringandResearch',
  ];

  const bytes = fs.readFileSync(PDFS[1].path);
  const { pages } = await extractTextItems(bytes);
  const allLines = [];
  for (const page of pages) {
    allLines.push(...groupLines(page.items, page.height).filter(Boolean));
  }
  const allText = allLines.map(l => l.text).join('\n');

  let allPass = true;
  for (const pattern of badPatterns) {
    if (allText.includes(pattern)) {
      console.log(`  ✗ FAIL (still concatenated): "${pattern}"`);
      allPass = false;
    }
  }
  if (allPass) {
    console.log('  ✓ All bad concatenation patterns eliminated');
  }
})();
