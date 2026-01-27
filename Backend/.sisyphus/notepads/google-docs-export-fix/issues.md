# Issues - Google Docs Export Fix

## [2026-01-27T16:55:41Z] Known Issues

### Current Bug
- **Error**: `Invalid requests[73].insertText: The insertion index must be inside the bounds of an existing paragraph`
- **Location**: `convex/actions/export.ts:359-365` (post-table newline insertion)
- **Trigger**: Complex documents with multiple tables
- **Impact**: Export fails completely, no Google Doc created

### Suspected Root Causes
1. **Primary**: Post-table newline insertion at invalid index
   - After inserting table and cells, calculated `currentIndex` may be outside paragraph bounds
   - Google Docs API rejects insertions not within existing paragraphs

2. **Secondary**: Incorrect `tableStructureSize` formula
   - Current: `1 + numRows * (1 + numCols * 2) + 1`
   - May not account for implicit paragraph markers within cells
   - Accumulates error across multiple tables

### Edge Cases to Watch
- Empty tables (headers only, no data rows)
- Single-column tables
- Table at end of document (no content after)
- Consecutive tables (table immediately followed by table)
- Tables with empty cells
