# PDFNova vs iLovePDF — Discrepancy Report

## Source: Research_Paper_Final-split.pdf (4 pages, A4, 317KB)

### CRITICAL DIFFERENCES (highest impact first)

| # | Issue | PDFNova | iLovePDF | Impact |
|---|-------|---------|----------|--------|
| 1 | **Text fragmentation** | Each character is a separate `<w:r>` run | Words are properly joined as runs | CRITICAL — breaks search, select, copy |
| 2 | **Bold applied indiscriminately** | 99.5% of runs are bold | 25.8% of runs are bold | CRITICAL — wrong visual appearance |
| 3 | **No justified alignment** | Only center + left | Justified body text | HIGH — doesn't match PDF |
| 4 | **Table column widths** | Uniform 100 twips per column | Proper proportional widths | HIGH — tables unusable |
| 5 | **No list detection** | 0 bullet/numbered lists | 6 UL + 2 OL | HIGH — loses list structure |
| 6 | **Heading hierarchy wrong** | Title→H1, subsections→H4 | Title→Title style, subsections→H2 | MEDIUM — wrong document structure |
| 7 | **Margins wrong** | 1-inch (1440 twips) everywhere | Journal-specific (708/1000 twips) | MEDIUM — different text flow |
| 8 | **No superscripts** | 0 superscripts | 13 superscripts (author affiliations) | MEDIUM — loses formatting |
| 9 | **No images** | 0 images | 2 JPEG images extracted | MEDIUM — loses visual content |
| 10 | **No hyperlinks** | 0 links | 3 email mailto links | LOW — loses interactivity |
| 11 | **Paragraph styles** | 4% of paragraphs styled | 95% of paragraphs styled | MEDIUM — poor Word integration |
| 12 | **No italic detection** | 455 runs italic (also bold) | 338 runs italic (properly selective) | MEDIUM — wrong formatting |

### WHAT PDFNova DOES BETTER
- Font mapping: Times New Roman (serif, matching PDF) vs iLovePDF's Courier New (monospace)

### ROOT CAUSES

1. **Text fragmentation**: `buildTextRuns()` creates one TextRun per PDF text item instead of merging same-style adjacent items
2. **Indiscriminate bold**: `block.bold` is set once per block from `isLikelyBold()` which returns false for obfuscated fonts, but the analysis shows 99.5% bold — need to investigate actual runtime behavior
3. **No justified alignment**: `detectBlockAlignment()` doesn't detect justified text
4. **Table widths**: `computeColumnWidths()` uses fixed 9000 twips total with equal distribution
5. **No lists**: No list detection logic exists
6. **Wrong margins**: Hardcoded to 1 inch, not extracted from PDF
