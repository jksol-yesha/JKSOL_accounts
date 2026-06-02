type ProfitLossItem = {
  subCategory?: string;
  account?: string;
  name?: string;
  amount?: number;
};

type ProfitLossGroup = {
  category?: string;
  total?: number;
  items?: ProfitLossItem[];
};

type ProfitLossData = {
  expenses?: ProfitLossGroup[];
  incomes?: ProfitLossGroup[];
  netProfit?: number;
  netLoss?: number;
  totalLeft?: number;
  totalRight?: number;
};

type ProfitLossReport = {
  data?: ProfitLossData;
};

type ProfitLossPdfMeta = {
  organizationName?: string;
  organizationAddress?: string;
  organizationBranchLine?: string;
  startDate?: string;
  endDate?: string;
};

type StatementRow = {
  kind: 'section' | 'item' | 'balance';
  label: string;
  total?: number;
  amount?: number;
};

type SideRenderRow = {
  kind: 'section' | 'item' | 'balance' | 'blank';
  label: string;
  itemAmount: string;
  totalAmount: string;
  underlineItemAmount: boolean;
};

type PdfFont = 'F1' | 'F2' | 'F3';

type PdfTextOp = {
  text: string;
  x: number;
  y: number;
  font: PdfFont;
  size: number;
};

type PdfLineOp = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width?: number;
};

type PdfPage = {
  texts: PdfTextOp[];
  lines: PdfLineOp[];
};

type ActivePage = {
  page: PdfPage;
  tableTopY: number;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN_X = 32;
const PAGE_MARGIN_TOP = 34;
const PAGE_MARGIN_BOTTOM = 34;
const TABLE_WIDTH = PAGE_WIDTH - (PAGE_MARGIN_X * 2);
const HALF_WIDTH = TABLE_WIDTH / 2;
const LABEL_COL_RATIO = 0.52;
const ITEM_COL_RATIO = 0.22;
const TOTAL_COL_RATIO = 0.26;
const SIDE_PADDING_X = 16;
const SIDE_GAP_Y = 16;
const ITEM_INDENT_X = 8;
const HEADER_NAME_SIZE = 17;
const HEADER_TITLE_SIZE = 15.5;
const HEADER_DATE_SIZE = 10.5;
const COLUMN_TITLE_SIZE = 11.5;
const ROW_LABEL_SIZE = 11;
const ROW_SECTION_SIZE = 11.2;
const ROW_AMOUNT_SIZE = 10.8;
const TOTAL_ROW_SIZE = 11.5;
const ROW_LINE_HEIGHT = 14;
const BLANK_ROW_HEIGHT = 16;
const TABLE_HEADER_HEIGHT = 18;
const TOTAL_ROW_HEIGHT = 18;
const TABLE_HEADER_TEXT_OFFSET = 12;
const TOTAL_ROW_TEXT_OFFSET = 12;
const PRE_TOTAL_GAP = 14;

const escapePdfText = (value: string) => (
  String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r?\n/g, ' ')
);

const getItemLabel = (item: ProfitLossItem) => (
  String(item?.subCategory || item?.account || item?.name || '').trim()
);

const formatDateShort = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: '2-digit'
  }).format(date).replace(/ /g, '-');
};

const formatAmount = (value?: number, showZero = false) => {
  const amount = Number(value || 0);
  if (!showZero && amount === 0) return '';

  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const buildStatementRows = (
  groups: ProfitLossGroup[] = [],
  balancingRow: { label: string; amount: number } | null = null
): StatementRow[] => {
  const rows: StatementRow[] = [];

  groups
    .filter((group) => String(group?.category || '').trim())
    .forEach((group) => {
      rows.push({
        kind: 'section',
        label: String(group?.category || '').trim(),
        total: Number(group?.total || 0)
      });

      (group.items || []).forEach((item) => {
        const label = getItemLabel(item);
        if (!label) return;

        rows.push({
          kind: 'item',
          label,
          amount: Number(item.amount || 0)
        });
      });
    });

  if (balancingRow?.amount && balancingRow.amount > 0) {
    rows.push({
      kind: 'balance',
      label: balancingRow.label,
      total: Number(balancingRow.amount || 0)
    });
  }

  return rows;
};

const buildSideRows = (rows: StatementRow[]): SideRenderRow[] => {
  const output: SideRenderRow[] = [];

  rows.forEach((row, index) => {
    if (index > 0 && (row.kind === 'section' || row.kind === 'balance')) {
      output.push({
        kind: 'blank',
        label: '',
        itemAmount: '',
        totalAmount: '',
        underlineItemAmount: false
      });
    }

    output.push({
      kind: row.kind,
      label: row.label,
      itemAmount: row.kind === 'item' ? formatAmount(row.amount) : '',
      totalAmount: row.kind === 'item' ? '' : formatAmount(row.total),
      underlineItemAmount: row.kind === 'item' && rows[index + 1]?.kind !== 'item'
    });
  });

  return output;
};

const fontWidthFactor = (font: PdfFont, char: string) => {
  if (char === ' ') return 0.28;
  if (/[0-9]/.test(char)) return 0.56;
  if (/[A-Z]/.test(char)) return font === 'F2' ? 0.62 : 0.58;
  if (/[a-z]/.test(char)) return font === 'F2' ? 0.56 : 0.52;
  if (/[.,:;|]/.test(char)) return 0.24;
  if (/[-/&]/.test(char)) return 0.3;
  return 0.5;
};

const measureTextWidth = (text: string, size: number, font: PdfFont) => (
  Array.from(String(text || '')).reduce((sum, char) => sum + (fontWidthFactor(font, char) * size), 0)
);

const wrapTextToWidth = (value: string, maxWidth: number, size: number, font: PdfFont): string[] => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [''];

  const words = normalized.split(' ');
  const lines: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (current) lines.push(current);
    current = '';
  };

  const splitLongToken = (token: string) => {
    let buffer = '';
    for (const char of token) {
      const candidate = buffer + char;
      if (measureTextWidth(candidate, size, font) <= maxWidth || !buffer) {
        buffer = candidate;
      } else {
        lines.push(buffer);
        buffer = char;
      }
    }
    return buffer;
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measureTextWidth(candidate, size, font) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) pushCurrent();

    if (measureTextWidth(word, size, font) <= maxWidth) {
      current = word;
    } else {
      current = splitLongToken(word);
    }
  }

  pushCurrent();
  return lines.length ? lines : [''];
};

const buildPdfBuffer = (pages: PdfPage[]) => {
  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>';

  const pageRefs: number[] = [];
  let nextObjectNumber = 6;

  for (const page of pages) {
    const streamParts: string[] = [];

    for (const line of page.lines) {
      streamParts.push(`q ${line.width || 0.8} w ${line.x1.toFixed(2)} ${line.y1.toFixed(2)} m ${line.x2.toFixed(2)} ${line.y2.toFixed(2)} l S Q`);
    }

    for (const text of page.texts) {
      streamParts.push(
        `BT /${text.font} ${text.size.toFixed(2)} Tf 1 0 0 1 ${text.x.toFixed(2)} ${text.y.toFixed(2)} Tm (${escapePdfText(text.text)}) Tj ET`
      );
    }

    const stream = streamParts.join('\n');
    const contentObjectNumber = nextObjectNumber++;
    const pageObjectNumber = nextObjectNumber++;

    objects[contentObjectNumber] = `<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`;
    objects[pageObjectNumber] = [
      '<< /Type /Page',
      '/Parent 2 0 R',
      `/MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}]`,
      '/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >>',
      `/Contents ${contentObjectNumber} 0 R`,
      '>>'
    ].join(' ');

    pageRefs.push(pageObjectNumber);
  }

  objects[2] = `<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(' ')}] >>`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (let index = 1; index < objects.length; index += 1) {
    const objectBody = objects[index];
    if (!objectBody) continue;
    offsets[index] = Buffer.byteLength(pdf, 'utf8');
    pdf += `${index} 0 obj\n${objectBody}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += '0000000000 65535 f \n';

  for (let index = 1; index < objects.length; index += 1) {
    const offset = offsets[index] || 0;
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer << /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
};

const alignCenter = (text: string, centerX: number, size: number, font: PdfFont) => (
  centerX - (measureTextWidth(text, size, font) / 2)
);

const alignRight = (text: string, rightX: number, size: number, font: PdfFont) => (
  rightX - measureTextWidth(text, size, font)
);

export const buildProfitLossPdfBuffer = (
  report: ProfitLossReport,
  meta: ProfitLossPdfMeta = {}
) => {
  const data = report?.data || {};
  const pages: PdfPage[] = [];

  const leftRows = buildSideRows(
    buildStatementRows(
      data.expenses || [],
      Number(data.netProfit || 0) > 0 ? { label: 'Nett Profit', amount: Number(data.netProfit || 0) } : null
    )
  );
  const rightRows = buildSideRows(
    buildStatementRows(
      data.incomes || [],
      Number(data.netLoss || 0) > 0 ? { label: 'Nett Loss', amount: Number(data.netLoss || 0) } : null
    )
  );
  const hasProfitLossData = leftRows.length > 0 || rightRows.length > 0;

  const organizationName = String(meta.organizationName || 'Organization Name').trim() || 'Organization Name';
  const headerLines = String(meta.organizationAddress || '')
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (headerLines.length === 0 && String(meta.organizationBranchLine || '').trim()) {
    headerLines.push(String(meta.organizationBranchLine).trim());
  }

  const periodLabel = `${formatDateShort(meta.startDate) || '-'} to ${formatDateShort(meta.endDate) || '-'}`;
  const leftTotal = formatAmount(Number(data.totalLeft || 0), true);
  const rightTotal = formatAmount(Number(data.totalRight || 0), true);

  const tableLeft = PAGE_MARGIN_X;
  const tableRight = PAGE_WIDTH - PAGE_MARGIN_X;
  const centerDividerX = PAGE_WIDTH / 2;
  const leftLabelX = tableLeft + SIDE_PADDING_X;
  const rightLabelX = centerDividerX + SIDE_PADDING_X;
  const sideWidth = HALF_WIDTH;
  const labelColWidth = sideWidth * LABEL_COL_RATIO;
  const itemColWidth = sideWidth * ITEM_COL_RATIO;
  const totalColWidth = sideWidth * TOTAL_COL_RATIO;
  const leftItemRight = tableLeft + labelColWidth + itemColWidth - SIDE_PADDING_X;
  const leftTotalRight = centerDividerX - SIDE_PADDING_X;
  const rightItemRight = centerDividerX + labelColWidth + itemColWidth - SIDE_PADDING_X;
  const rightTotalRight = tableRight - SIDE_PADDING_X;

  let activePage: ActivePage | null = null;
  let currentY = 0;

  const addText = (text: string, x: number, y: number, font: PdfFont, size: number) => {
    activePage?.page.texts.push({ text, x, y, font, size });
  };

  const addLine = (x1: number, y1: number, x2: number, y2: number, width = 0.8) => {
    activePage?.page.lines.push({ x1, y1, x2, y2, width });
  };

  const startPage = (includeTable = true) => {
    const page: PdfPage = { texts: [], lines: [] };
    pages.push(page);
    activePage = { page, tableTopY: 0 };

    let y = PAGE_HEIGHT - PAGE_MARGIN_TOP;
    addText(organizationName.toUpperCase(), alignCenter(organizationName.toUpperCase(), PAGE_WIDTH / 2, HEADER_NAME_SIZE, 'F2'), y, 'F2', HEADER_NAME_SIZE);
    y -= 18;

    headerLines.forEach((line) => {
      addText(line, alignCenter(line, PAGE_WIDTH / 2, 9.5, 'F1'), y, 'F1', 9.5);
      y -= 11;
    });

    addText('Profit & Loss A/c', alignCenter('Profit & Loss A/c', PAGE_WIDTH / 2, HEADER_TITLE_SIZE, 'F2'), y, 'F2', HEADER_TITLE_SIZE);
    y -= 16;
    addText(periodLabel, alignCenter(periodLabel, PAGE_WIDTH / 2, HEADER_DATE_SIZE, 'F1'), y, 'F1', HEADER_DATE_SIZE);
    y -= 18;

    if (!includeTable) {
      currentY = y;
      return;
    }

    const tableTopY = y;
    activePage.tableTopY = tableTopY;
    addLine(tableLeft, tableTopY, tableRight, tableTopY, 0.9);
    addText('Expense', alignCenter('Expense', tableLeft + (HALF_WIDTH / 2), COLUMN_TITLE_SIZE, 'F2'), tableTopY - TABLE_HEADER_TEXT_OFFSET, 'F2', COLUMN_TITLE_SIZE);
    addText('Income', alignCenter('Income', centerDividerX + (HALF_WIDTH / 2), COLUMN_TITLE_SIZE, 'F2'), tableTopY - TABLE_HEADER_TEXT_OFFSET, 'F2', COLUMN_TITLE_SIZE);
    const headerBottomY = tableTopY - TABLE_HEADER_HEIGHT;
    addLine(tableLeft, headerBottomY, tableRight, headerBottomY, 0.9);
    currentY = headerBottomY - 6;
  };

  const closeCurrentPage = (bottomY: number, drawBottom = false) => {
    if (!activePage) return;
    addLine(centerDividerX, activePage.tableTopY, centerDividerX, bottomY, 0.6);
    if (drawBottom) {
      addLine(tableLeft, bottomY, tableRight, bottomY, 0.9);
    }
  };

  const getLabelFont = (kind: SideRenderRow['kind']): PdfFont => (
    kind === 'section' ? 'F2' : kind === 'item' ? 'F3' : 'F1'
  );

  const getLabelSize = (kind: SideRenderRow['kind']) => (
    kind === 'section' ? ROW_SECTION_SIZE : ROW_LABEL_SIZE
  );

  const getTotalFont = (row: SideRenderRow): PdfFont => (
    row.kind === 'section' ? 'F2' : row.kind === 'balance' ? 'F1' : 'F1'
  );

  const measureRowHeight = (row: SideRenderRow | null, labelWidth: number) => {
    if (!row || row.kind === 'blank') return BLANK_ROW_HEIGHT;
    const font = getLabelFont(row.kind);
    const size = getLabelSize(row.kind);
    const lines = wrapTextToWidth(row.label, labelWidth, size, font);
    return Math.max(BLANK_ROW_HEIGHT, lines.length * ROW_LINE_HEIGHT);
  };

  const renderSideRow = (
    row: SideRenderRow | null,
    side: 'left' | 'right',
    rowTopY: number,
    rowHeight: number
  ) => {
    if (!row || row.kind === 'blank') return;

    const labelX = (side === 'left' ? leftLabelX : rightLabelX) + (row.kind === 'item' ? ITEM_INDENT_X : 0);
    const labelWidth = labelColWidth - (SIDE_PADDING_X * 2);
    const font = getLabelFont(row.kind);
    const size = getLabelSize(row.kind);
    const labelLines = wrapTextToWidth(row.label, labelWidth, size, font);
    const baselineStart = rowTopY - 12;

    labelLines.forEach((line, index) => {
      addText(line, labelX, baselineStart - (index * ROW_LINE_HEIGHT), font, size);
    });

    if (row.itemAmount) {
      const rightX = side === 'left' ? leftItemRight : rightItemRight;
      addText(
        row.itemAmount,
        alignRight(row.itemAmount, rightX, ROW_AMOUNT_SIZE, 'F3'),
        baselineStart,
        'F3',
        ROW_AMOUNT_SIZE
      );

      if (row.underlineItemAmount) {
        const underlineWidth = Math.max(84, measureTextWidth(row.itemAmount, ROW_AMOUNT_SIZE, 'F3') + 8);
        const underlineY = baselineStart - 6;
        addLine(rightX - underlineWidth, underlineY, rightX, underlineY, 0.6);
      }
    }

    if (row.totalAmount) {
      const rightX = side === 'left' ? leftTotalRight : rightTotalRight;
      const totalFont = getTotalFont(row);
      addText(
        row.totalAmount,
        alignRight(row.totalAmount, rightX, ROW_AMOUNT_SIZE, totalFont),
        baselineStart,
        totalFont,
        ROW_AMOUNT_SIZE
      );
    }
  };

  if (!hasProfitLossData) {
    startPage(false);
    const emptyStateLabel = 'No data found for this period';
    addText(
      emptyStateLabel,
      alignCenter(emptyStateLabel, PAGE_WIDTH / 2, 12, 'F2'),
      currentY - 12,
      'F2',
      12
    );
    return buildPdfBuffer(pages);
  }

  startPage();

  const reserveForFooter = PRE_TOTAL_GAP + TOTAL_ROW_HEIGHT + 18;
  const rowCount = Math.max(leftRows.length, rightRows.length, 1);

  for (let index = 0; index < rowCount; index += 1) {
    const leftRow = leftRows[index] || null;
    const rightRow = rightRows[index] || null;
    const rowHeight = Math.max(
      measureRowHeight(leftRow, labelColWidth - (SIDE_PADDING_X * 2)),
      measureRowHeight(rightRow, labelColWidth - (SIDE_PADDING_X * 2))
    );

    if (currentY - rowHeight < PAGE_MARGIN_BOTTOM + reserveForFooter) {
      closeCurrentPage(currentY + 6, true);
      startPage();
    }

    renderSideRow(leftRow, 'left', currentY, rowHeight);
    renderSideRow(rightRow, 'right', currentY, rowHeight);
    currentY -= rowHeight;
  }

  if (currentY - (PRE_TOTAL_GAP + TOTAL_ROW_HEIGHT) < PAGE_MARGIN_BOTTOM) {
    closeCurrentPage(currentY + 6, true);
    startPage();
  }

  const totalTopY = currentY - PRE_TOTAL_GAP;
  addLine(tableLeft, totalTopY, tableRight, totalTopY, 0.9);
  const totalBaseline = totalTopY - TOTAL_ROW_TEXT_OFFSET;
  addText('T o t a l', leftLabelX, totalBaseline, 'F2', TOTAL_ROW_SIZE);
  addText(leftTotal, alignRight(leftTotal, leftTotalRight, TOTAL_ROW_SIZE, 'F2'), totalBaseline, 'F2', TOTAL_ROW_SIZE);
  addText('T o t a l', rightLabelX, totalBaseline, 'F2', TOTAL_ROW_SIZE);
  addText(rightTotal, alignRight(rightTotal, rightTotalRight, TOTAL_ROW_SIZE, 'F2'), totalBaseline, 'F2', TOTAL_ROW_SIZE);
  const totalBottomY = totalTopY - TOTAL_ROW_HEIGHT;
  closeCurrentPage(totalBottomY, true);

  return buildPdfBuffer(pages);
};
