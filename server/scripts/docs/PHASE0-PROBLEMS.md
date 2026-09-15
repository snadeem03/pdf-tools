# Phase 0: Current Problems in PDF-to-Word Conversion

## Summary
The current implementation converts PDFs to DOCX but has significant issues with:
1. **Zone classification** - Headers, footers, titles, authors not properly identified
2. **Paragraph grouping** - Text is over-merged or under-merged
3. **Table detection** - False positives and poor table cell parsing
4. **Typography** - Font mapping is basic, no italic/bold detection from PDF metadata

## Detailed Problems

### SRS-test.pdf (2 pages)

#### Page 1
- ✓ Table detected (good)
- ✗ Table content merged into single block: "ID Requirement Priority REQ-001 System shall support user login High REQ-002 Sys..."
- ✗ Should be separate table cells, not continuous text

#### Page 2
- ✓ Headings detected: "Functional Requirements"
- ✗ Section numbers merged with text: "1.1 User Authentication The system shall allow..."
- ✗ Should be separate heading + paragraph

### Research_Paper_Final-split.pdf (4 pages)

#### Page 1
- ✗ No zone classification:
  - Header ("ISSN: 2321-9939...") not identified
  - Title ("Comparative Experimental Analysis...") not identified as title
  - Subtitle not identified
  - Author block not identified
  - Abstract not identified
  - Index Terms not identified
  - Footer not identified

- ✗ Block grouping issues:
  - Title split into 2 blocks: "Comparative Experimental Analysis Of Fault Tolerance..." + "Failures"
  - Should be single title block

- ✗ Typography:
  - All text mapped to Arial (should be Times New Roman for serif)
  - No italic detection for subtitle

#### Page 2
- ✗ Massive over-merging:
  - 59 lines → only 5 blocks
  - Entire sections merged into single paragraphs
  - "II. RELATED WORK" + all subsection content in one block

- ✗ Should be:
  - "II. RELATED WORK" (heading)
  - "A. Fault tolerance mechanisms" (subheading)
  - Body paragraph(s)
  - "B. Experimental fault injection" (subheading)
  - etc.

#### Page 3
- ✓ Table detected (good)
- ✗ Table content not properly parsed into cells
- ✗ "TABLE I. SIMULATION PARAMETERS" merged with table data

#### Page 4
- ✓ Table detected (good)
- ✗ Same table parsing issues

## Root Causes

### 1. No Zone Classification
- Headers/footers appear on every page but aren't identified
- Title/author/abstract on first page aren't recognized
- No page-aware processing

### 2. Poor Paragraph Grouping
- Current algorithm merges based on vertical proximity only
- Doesn't consider:
  - Section headings (Roman numerals, letters)
  - Font size changes
  - Indentation
  - Semantic structure

### 3. Table Detection Issues
- Current: Detects multi-column text as table
- Problem: Single-column body text can be falsely detected
- Need: Multiple signals (X clustering, row alignment, etc.)

### 4. Typography Limitations
- Font mapping is keyword-based only
- Obfuscated PDF font names (e.g., "g_d0_f2") not mapped
- No italic/bold detection from PDF metadata

## Recommended Fixes

### Phase 2: Zone Classification
- Detect repeated headers/footers across pages
- Identify title by position, size, alignment
- Identify author block by position and formatting
- Recognize "Abstract" and "Index Terms" headings

### Phase 3: Paragraph Grouping
- Consider section heading patterns (I., II., A., B., 1., 2.)
- Use font size changes as paragraph breaks
- Respect indentation changes
- Don't merge across zone boundaries

### Phase 5: Table Detection
- Require multiple column positions
- Check row alignment consistency
- Avoid false positives on single-column text
- Parse table cells properly

### Phase 4: Typography
- Analyze PDF font descriptors for italic/bold
- Use serif/sans classification
- Map obfuscated names to sensible defaults
