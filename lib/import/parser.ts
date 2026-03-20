// Pure Excel parser — no DB calls, no server imports.
// Safe to run in the browser (called from client component).
// Input: a 2D array of rows (from xlsx sheet_to_json with header:1)
// Output: a structured ParsedProjectFile ready for preview and import.

export interface ParsedItem {
  category: string
  worker: string
  material: string
  quantity: number | null
  raw_quantity: string
  unit: string
  unit_price: number | null
  total_price: number | null
  vendor: string
  status: string
  notes: string
  display_order: number
}

export interface ParsedSection {
  name: string
  display_order: number
  items: ParsedItem[]
}

export interface ParsedProjectFile {
  projectName: string
  sections: ParsedSection[]
  totalRowsFound: number
  totalRowsSkipped: number
  emptyRowsSkipped: number
  parseWarnings: { rowNumber: number; message: string }[]
}

// Column header aliases — maps any variant to our canonical field name.
// Keys are always lowercase-trimmed before lookup.
const COLUMN_MAP: Record<string, keyof Omit<ParsedItem, 'display_order'>> = {
  // ── Category ────────────────────────────────────────────
  'category':          'category',
  'cat':               'category',
  'type':              'category',
  'work type':         'category',
  'work_type':         'category',
  'trade':             'category',
  'trade type':        'category',
  'scope':             'category',

  // ── Worker ──────────────────────────────────────────────
  'worker':            'worker',
  'workers':           'worker',
  'assigned to':       'worker',
  'assigned_to':       'worker',
  'assignee':          'worker',
  'crew':              'worker',
  'technician':        'worker',
  'installer':         'worker',
  'contractor':        'worker',
  'sub-contractor':    'worker',
  'subcontractor':     'worker',
  'labor':             'worker',
  'labour':            'worker',

  // ── Material ────────────────────────────────────────────
  'material':          'material',
  'materials':         'material',
  'item':              'material',
  'items':             'material',
  'name':              'material',
  'item name':         'material',
  'part':              'material',
  'part name':         'material',
  'description':       'material',
  'item description':  'material',
  'product':           'material',
  'product name':      'material',
  'service':           'material',
  'task':              'material',
  'line item':         'material',
  'work description':  'material',
  'scope of work':     'material',

  // ── Quantity ────────────────────────────────────────────
  'quantity':          'quantity',
  'qty':               'quantity',
  'count':             'quantity',
  'no.':               'quantity',
  'no':                'quantity',
  'num':               'quantity',
  'number':            'quantity',
  'units':             'quantity',
  'amount qty':        'quantity',
  'hours':             'quantity',
  'hrs':               'quantity',
  'days':              'quantity',

  // ── Unit (explicit column) ───────────────────────────────
  'unit':              'unit',
  'uom':               'unit',
  'unit of measure':   'unit',
  'measure':           'unit',

  // ── Unit Price ──────────────────────────────────────────
  'unit price':        'unit_price',
  'unit_price':        'unit_price',
  'price per unit':    'unit_price',
  'price/unit':        'unit_price',
  'rate':              'unit_price',
  'cost':              'unit_price',
  'cost per unit':     'unit_price',
  'unit cost':         'unit_price',
  'price':             'unit_price',
  'each':              'unit_price',
  'per unit':          'unit_price',

  // ── Total Price ─────────────────────────────────────────
  'total':             'total_price',
  'total price':       'total_price',
  'total_price':       'total_price',
  'line total':        'total_price',
  'subtotal':          'total_price',
  'sub total':         'total_price',
  'sub-total':         'total_price',
  'line amount':       'total_price',
  'amount':            'total_price',
  'extended price':    'total_price',
  'ext price':         'total_price',
  'ext. price':        'total_price',
  'extended amount':   'total_price',
  'line value':        'total_price',
  'total cost':        'total_price',

  // ── Vendor ──────────────────────────────────────────────
  'vendor':            'vendor',
  'vendor/supplier':   'vendor',
  'vendor / supplier': 'vendor',
  'supplier':          'vendor',
  'supplied by':       'vendor',
  'manufacturer':      'vendor',
  'brand':             'vendor',
  'source':            'vendor',

  // ── Status ──────────────────────────────────────────────
  'status':            'status',
  'state':             'status',
  'progress':          'status',
  'item status':       'status',
  'completion':        'status',

  // ── Notes ───────────────────────────────────────────────
  'notes':             'notes',
  'note':              'notes',
  'comments':          'notes',
  'comment':           'notes',
  'remarks':           'notes',
  'remark':            'notes',
  'details':           'notes',
  'additional info':   'notes',
  'info':              'notes',
  'memo':              'notes',
}

type RawRow = (string | number | null | undefined)[]

function cellStr(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function isRowEmpty(row: RawRow): boolean {
  return row.every((cell) => cell === null || cell === undefined || String(cell).trim() === '')
}

// A TOTAL row: first non-empty cell starts with "total" (case-insensitive)
function isTotalRow(row: RawRow): boolean {
  const first = row.find((c) => c !== null && c !== undefined && String(c).trim() !== '')
  if (!first) return false
  return String(first).trim().toLowerCase().startsWith('total')
}

// A section header: exactly one non-empty cell in the first two columns
function isSectionHeader(row: RawRow): boolean {
  const nonEmpty = row.filter((c) => c !== null && c !== undefined && String(c).trim() !== '')
  if (nonEmpty.length !== 1) return false
  const firstNonEmptyIdx = row.findIndex((c) => c !== null && c !== undefined && String(c).trim() !== '')
  return firstNonEmptyIdx <= 1
}

// Find the header row by scanning for a row with 2+ recognised column aliases.
// Lowered threshold from 3 to 2 so sparse sheets still get detected.
function findHeaderRow(rows: RawRow[]): {
  rowIndex: number
  colMap: Map<number, keyof Omit<ParsedItem, 'display_order'>>
} | null {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i]
    const colMap = new Map<number, keyof Omit<ParsedItem, 'display_order'>>()
    for (let j = 0; j < row.length; j++) {
      const key = cellStr(row[j]).toLowerCase()
      if (COLUMN_MAP[key]) colMap.set(j, COLUMN_MAP[key])
    }
    if (colMap.size >= 2) return { rowIndex: i, colMap }
  }
  return null
}

// Strip currency symbols and commas; parse to float
function parseNumeric(raw: string): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[$,\s]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

// Extract trailing unit suffix from a quantity cell: "24 sq ft" → "sq ft"
function extractUnit(raw: string): string {
  const match = raw.match(/^[\d.,\s$]+([a-zA-Z²³°%/\s]+)$/)
  return match ? match[1].trim() : ''
}

export function parseProjectRows(rows: RawRow[], fileName: string): ParsedProjectFile {
  const warnings: { rowNumber: number; message: string }[] = []
  let totalRowsFound = 0
  let totalRowsSkipped = 0
  let emptyRowsSkipped = 0

  // ── Project title ──────────────────────────────────────────
  let projectName = ''
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const val = cellStr(rows[i]?.[0])
    if (val) { projectName = val; break }
  }
  if (!projectName) projectName = fileName.replace(/\.[^.]+$/, '')

  // ── Find header row ────────────────────────────────────────
  const header = findHeaderRow(rows)
  if (!header) {
    warnings.push({
      rowNumber: 0,
      message: 'Could not find column headers. Expected columns like: Category, Worker, Material, Quantity, Unit Price, Total, Status, Notes.',
    })
    return { projectName, sections: [], totalRowsFound: 0, totalRowsSkipped: 0, emptyRowsSkipped: 0, parseWarnings: warnings }
  }

  const { rowIndex: headerRowIndex, colMap } = header
  const dataRows = rows.slice(headerRowIndex + 1)

  // ── Parse data rows ────────────────────────────────────────
  const sections: ParsedSection[] = []
  let currentSection: ParsedSection | null = null
  let itemOrder = 0

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const globalRowNum = headerRowIndex + 2 + i

    totalRowsFound++

    if (isRowEmpty(row)) {
      emptyRowsSkipped++
      totalRowsFound--
      continue
    }

    if (isTotalRow(row)) {
      totalRowsSkipped++
      continue
    }

    if (isSectionHeader(row)) {
      const name = cellStr(
        row.find((c) => c !== null && c !== undefined && String(c).trim() !== '') as string | number
      )
      currentSection = { name, display_order: sections.length, items: [] }
      sections.push(currentSection)
      itemOrder = 0
      continue
    }

    if (!currentSection) {
      currentSection = { name: 'General', display_order: 0, items: [] }
      sections.unshift(currentSection)
    }

    const item: ParsedItem = {
      category: '', worker: '', material: '',
      quantity: null, raw_quantity: '', unit: '',
      unit_price: null, total_price: null,
      vendor: '', status: '', notes: '',
      display_order: itemOrder++,
    }

    // Track whether an explicit "unit" column was found (overrides qty-extracted unit)
    let explicitUnitValue: string | null = null

    for (const [colIdx, field] of colMap.entries()) {
      const rawVal = cellStr(row[colIdx])

      if (field === 'quantity') {
        item.raw_quantity = rawVal
        if (rawVal) {
          item.quantity = parseNumeric(rawVal)
          item.unit = extractUnit(rawVal)   // may be overridden below
          if (item.quantity === null) {
            warnings.push({ rowNumber: globalRowNum, message: `Quantity "${rawVal}" could not be parsed — stored as null` })
          }
        }
      } else if (field === 'unit') {
        // Explicit unit column — save it; apply after the loop
        explicitUnitValue = rawVal || null
      } else if (field === 'unit_price') {
        if (rawVal) {
          item.unit_price = parseNumeric(rawVal)
          if (item.unit_price === null) {
            warnings.push({ rowNumber: globalRowNum, message: `Unit price "${rawVal}" could not be parsed — stored as null` })
          }
        }
      } else if (field === 'total_price') {
        if (rawVal) {
          item.total_price = parseNumeric(rawVal)
          if (item.total_price === null) {
            warnings.push({ rowNumber: globalRowNum, message: `Total price "${rawVal}" could not be parsed — stored as null` })
          }
        }
      } else {
        // category, worker, material, vendor, status, notes
        item[field] = rawVal
      }
    }

    // Explicit unit column wins over suffix extracted from quantity string
    if (explicitUnitValue !== null) {
      item.unit = explicitUnitValue
    }

    // Compute total_price if Excel didn't provide it
    if (item.total_price === null && item.quantity !== null && item.unit_price !== null) {
      item.total_price = Math.round(item.quantity * item.unit_price * 100) / 100
    }

    currentSection.items.push(item)
  }

  const nonEmptySections = sections.filter((s) => s.items.length > 0)

  return {
    projectName,
    sections: nonEmptySections,
    totalRowsFound,
    totalRowsSkipped,
    emptyRowsSkipped,
    parseWarnings: warnings,
  }
}
