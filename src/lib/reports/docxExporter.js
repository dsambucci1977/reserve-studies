// src/lib/reports/docxExporter.js
// Generates a real .docx file using the docx npm package.
// Takes raw report data (same as loadReportData returns) and builds a proper Word document
// with native footers, bookmarks, TOC links, and page numbering.

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Footer, Header, PageNumber, PageBreak, ImageRun,
  AlignmentType, WidthType, BorderStyle, ShadingType,
  BookmarkStart, BookmarkEnd, InternalHyperlink,
  NumberFormat, TabStopType, TabStopPosition
} from 'docx';

// ============================================================
// CONSTANTS
// ============================================================
const NAVY = '1e3a5f';
const GREEN = '166534';
const ORANGE = 'c55a11';
const GRAY = '666666';
const LIGHT_GRAY = 'f8f9fa';
const WHITE = 'ffffff';

const fmt = (n) => {
  if (n === null || n === undefined) return '$0';
  const num = parseFloat(n);
  if (isNaN(num)) return '$0';
  const neg = num < 0;
  const abs = Math.abs(Math.round(num));
  const formatted = '$' + abs.toLocaleString('en-US');
  return neg ? '-' + formatted : formatted;
};

const fmtPct = (n) => {
  const num = parseFloat(n);
  if (isNaN(num)) return '0.00%';
  return num.toFixed(2) + '%';
};

// ============================================================
// HELPER BUILDERS
// ============================================================
function sectionHeader(text, color = NAVY) {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    shading: { type: ShadingType.SOLID, color: color },
    children: [
      new TextRun({ text: text, bold: true, size: 24, color: WHITE, font: 'Arial' })
    ],
    indent: { left: 100, right: 100 },
  });
}

function subHeader(text) {
  return new Paragraph({
    spacing: { before: 200, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: '3b82f6' } },
    children: [
      new TextRun({ text: text, bold: true, size: 20, color: NAVY, font: 'Arial' })
    ],
  });
}

function bodyPara(text, options = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [
      new TextRun({ text: text, size: 20, font: 'Arial', ...options })
    ],
  });
}

function bulletPara(text) {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    bullet: { level: 0 },
    children: [
      new TextRun({ text: text, size: 20, font: 'Arial' })
    ],
  });
}

function emptyPara() {
  return new Paragraph({ children: [new TextRun({ text: '', size: 20 })] });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function bookmarkPara(id, text, color = NAVY) {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    shading: { type: ShadingType.SOLID, color: color },
    children: [
      new BookmarkStart({ id: id, name: id }),
      new TextRun({ text: text, bold: true, size: 24, color: WHITE, font: 'Arial' }),
      new BookmarkEnd({ id: id }),
    ],
    indent: { left: 100, right: 100 },
  });
}

// Simple table cell
function tc(text, opts = {}) {
  const { bold, align, shading, width, color, size, span } = opts;
  const cellOpts = {
    children: [
      new Paragraph({
        alignment: align || AlignmentType.LEFT,
        children: [
          new TextRun({
            text: String(text ?? ''),
            bold: bold || false,
            size: size || 16,
            font: 'Arial',
            color: color || '1a1a1a'
          })
        ]
      })
    ],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'dddddd' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'dddddd' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'dddddd' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'dddddd' },
    },
  };
  if (shading) cellOpts.shading = { type: ShadingType.SOLID, color: shading };
  if (width) cellOpts.width = { size: width, type: WidthType.PERCENTAGE };
  if (span) cellOpts.columnSpan = span;
  return new TableCell(cellOpts);
}

// Header cell (white text on colored background)
function thc(text, opts = {}) {
  return tc(text, { bold: true, color: WHITE, shading: opts.shading || NAVY, align: AlignmentType.CENTER, size: 14, ...opts });
}

// ============================================================
// SECTION BUILDERS
// ============================================================

function buildTOC(hasPM) {
  const entries = [
    ['intro', 'Introduction'],
    ['description', 'Description of Development'],
    ['reservechart', 'Reserve Study Chart'],
    ['terms', 'Terms and Definitions'],
    ['responsible', 'Responsible Charge'],
    ['special', 'Special Assessment'],
    ['physical', 'Physical Analysis'],
    ['compsummary', 'Component Schedule Summary'],
    ['capitalitems', 'Capital Items / Components'],
    ['compnotes', 'Components Notes'],
    ['financial', 'Financial Results'],
    ['cashflow', 'Reserve Fund Thirty Year Cash Flow'],
    ['threshold', 'Reserve Fund Thirty Year Threshold Funding'],
    ['expenditures', 'Reserve Fund Expenditures'],
  ];
  if (hasPM) {
    entries.push(['pmsection', 'Preventive Maintenance']);
    entries.push(['pmexpend', 'PM Expenditures']);
    entries.push(['pmcashflow', 'PM Thirty Year Cash Flow']);
  }
  entries.push(['recommendations', 'Recommendations']);
  entries.push(['disclosures', 'Disclosures']);
  entries.push(['bibliography', 'Bibliography']);

  const children = [
    new Paragraph({
      spacing: { before: 200, after: 200 },
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: NAVY } },
      children: [
        new TextRun({ text: 'TABLE OF CONTENTS', bold: true, size: 32, color: NAVY, font: 'Arial' })
      ],
    }),
  ];

  entries.forEach(([id, label]) => {
    children.push(new Paragraph({
      spacing: { before: 80, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc', space: 1 } },
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [
        new InternalHyperlink({
          anchor: id,
          children: [
            new TextRun({ text: label, size: 22, font: 'Arial', style: 'Hyperlink' })
          ]
        }),
      ],
    }));
  });

  return children;
}

function buildIntroduction(data) {
  const { site } = data;
  const studyType = site.studyType || 'Level 1: Full Reserve Study';
  let levelText = 'This report includes a Level 1: Full Reserve Study, With Site Visit/On-Site Review. A full reserve study consists of the following five key tasks:';
  if (studyType === 'Level 2: Update, With Site Visit') {
    levelText = 'This report includes a Level 2: Update Reserve Study, With Site Visit. An update with site visit includes the following key tasks:';
  } else if (studyType === 'Level 3: Update, Without Site Visit') {
    levelText = 'This report includes a Level 3: Update Reserve Study, Without Site Visit. An update without site visit includes the following key tasks:';
  }

  return [
    bookmarkPara('intro', 'INTRODUCTION'),
    subHeader('Financial Planning'),
    bodyPara('One of the key responsibilities of the Board of Trustees or Directors is to ensure that the property is properly protected and maintained. Effective financial planning and budgeting are essential to maintaining the property and ensuring that sufficient funds are available to meet ongoing and future needs.'),
    bodyPara('The main objective of capital reserve planning is to ensure adequate funding for the future replacement of capital components within the community. Thoughtful planning helps distribute the cost of these projects evenly over time among owners, ensuring funds are available when needed. A well-funded reserve reduces the likelihood of significant fee increases, special assessments, or the need for loans.'),
    subHeader('Capital Reserve Study'),
    bodyPara('A Capital Reserve Study serves as a financial planning tool that estimates the amount of money the Community Association should set aside for the future replacement of common area components. This report has been developed in accordance with the Community Associations Institute (CAI) National Reserve Study Standards. It provides guidance in evaluating and establishing a stable reserve funding strategy for anticipated repairs and replacements.'),
    subHeader('Level of Service Provided'),
    bodyPara(levelText),
    bulletPara('Component Inventory'),
    bulletPara('Condition Assessment (based on on-site visual inspections)'),
    bulletPara('Life and Valuation Estimates'),
    bulletPara('Fund Status Evaluation'),
    bulletPara('Development of a Funding Plan'),
  ];
}

function buildDescription(data) {
  const { site } = data;
  const name = site.siteName || 'Project Name';
  const type = site.buildingType || 'Residential';
  const units = site.totalUnits || 'N/A';
  const location = [site.city, site.state].filter(Boolean).join(', ') || 'Location';

  return [
    bookmarkPara('description', 'DESCRIPTION OF DEVELOPMENT'),
    bodyPara(`${name} consists of a ${type} comprising ${units} residential units. The community is located in ${location}.`),
    bodyPara('Residents access the building through both front and rear entrance stoops. Additional common areas within the community include the front sidewalk, front paver walkway, fencing, exterior building and landscape lighting, the building\'s exterior, interior hallways and lobbies, as well as the common area HVAC system and domestic hot water infrastructure.'),
  ];
}

function buildReserveChart(data) {
  const { results, site } = data;
  const rf = results.reserveFund || {};
  const pf = results.pmFund || {};
  const hasPM = results.pmRequired;
  const beginBal = site.beginningReserveBalance || rf.currentBalance || 0;
  const curContrib = site.currentAnnualContribution || rf.currentContribution || 0;

  const children = [
    bookmarkPara('reservechart', 'RESERVE STUDY CHART'),
    subHeader('Reserve Fund Information'),
    bodyPara(`Beginning Reserve Balance: ${fmt(beginBal)}`),
    bodyPara(`Current Annual Contribution: ${fmt(curContrib)}`),
    bodyPara(`Current Percent Funded: ${fmtPct(rf.percentFunded)}`),
    bodyPara(`Recommended Annual Funding: ${fmt(rf.recommendedContribution)}`),
    bodyPara('Averaging Length in Years: 30'),
  ];

  if (hasPM) {
    children.push(emptyPara());
    children.push(subHeader('Preventive Maintenance Fund Information'));
    children.push(bodyPara(`Beginning PM Balance: ${fmt(site.beginningPMBalance || pf.currentBalance)}`));
    children.push(bodyPara(`Current Annual Contribution: ${fmt(site.currentPMContribution || pf.currentContribution)}`));
    children.push(bodyPara(`Current Percent Funded: ${fmtPct(pf.percentFunded)}`));
    children.push(bodyPara(`Recommended Annual Funding: ${fmt(pf.recommendedContribution)}`));
    children.push(bodyPara('Averaging Length in Years: 30'));
  }

  return children;
}

function buildTerms() {
  const terms = [
    ['Capital Improvements', 'Additions to the association\'s common elements that were not previously part of the community. While these new components should be incorporated into future reserve studies for ongoing replacement planning, the initial construction costs should not be paid from the reserve fund.'],
    ['Cash Flow Method', 'A method of creating a reserve funding plan in which contributions are structured to align with projected, fluctuating annual reserve expenditures.'],
    ['Component', 'Individual items listed in the reserve study as identified through the physical analysis. These components represent the common elements of the community.'],
    ['Fully Funded', 'A reserve fund is considered fully funded when the actual or projected balance equals the fully funded balance (FFB), or 100% funded.'],
    ['Fully Funded Balance (FFB)', 'An ideal benchmark reserve balance. Formula: FFB = Current Cost × (Effective Age ÷ Useful Life)'],
    ['Funding Goals', 'Primary reserve funding objectives: Full Funding (most conservative), Threshold Funding (maintain above a minimum), and Baseline Funding (never below zero).'],
    ['Percent Funded', 'The ratio of the actual reserve balance to the fully funded balance at a specific point in time.'],
    ['Remaining Useful Life (RUL)', 'The estimated number of years a component will continue to function before replacement is necessary.'],
    ['Replacement Cost', 'The total cost to repair, restore, or replace a component to its original functional condition.'],
    ['Reserve Study', 'A strategic budgeting tool that identifies components the association must maintain or replace, assesses the current reserve fund status, and recommends a funding plan.'],
    ['Useful Life (UL)', 'The total expected lifespan of a component from installation to replacement.'],
  ];

  const children = [bookmarkPara('terms', 'TERMS AND DEFINITIONS')];
  terms.forEach(([term, def]) => {
    children.push(new Paragraph({
      spacing: { before: 80, after: 60 },
      children: [
        new TextRun({ text: term + ' - ', bold: true, size: 20, font: 'Arial' }),
        new TextRun({ text: def, size: 20, font: 'Arial' }),
      ]
    }));
  });
  return children;
}

function buildResponsibleCharge() {
  return [
    bookmarkPara('responsible', 'RESPONSIBLE CHARGE'),
    bodyPara('A Reserve Specialist (RS) who is in responsible charge of a reserve study must provide consistent and effective oversight of all individuals performing tasks that directly impact the quality and accuracy of the study. The RS must retain sufficient records to demonstrate that they exercised appropriate and regular supervision throughout the course of the project.'),
  ];
}

function buildSpecialAssessment() {
  return [
    bookmarkPara('special', 'SPECIAL ASSESSMENT'),
    bodyPara('A Special Assessment is a temporary fee imposed on association members in addition to regular dues or assessments. These assessments are typically used to cover unexpected or one-time expenses and are often subject to limitations or procedures outlined in the association\'s governing documents or applicable local laws.'),
  ];
}

function buildPhysicalAnalysis(data) {
  const { organization, site } = data;
  const companyName = organization.name || site.companyName || 'the consultant';
  const inspDate = site.inspectionDate || 'the site visit date';

  return [
    bookmarkPara('physical', 'PHYSICAL ANALYSIS'),
    bodyPara(`The quantities used in the replacement cost estimates of the common elements were generated from field measurements taken during our site visit on ${inspDate}, and/or from take-offs based on architectural and site design drawings. The remaining life expectancies of the common elements were determined through a visual site inspection of the Community, as well as information provided by the Property Manager and maintenance contractors familiar with the common elements of the Community.`),
    bodyPara(`Current replacement costs were estimated using published construction cost data referenced in the Bibliography section of this report, along with average costs provided by contractors who have performed similar projects bid out by ${companyName}. Useful life and remaining useful life estimates were based on field observations and the assumption that an adequate maintenance schedule is in place and will be followed.`),
    bodyPara('It is recommended that this reserve study be updated every three (3) to five (5) years.'),
  ];
}

function buildComponentTable(components, isPM = false) {
  const filtered = isPM
    ? components.filter(c => c.isPreventiveMaintenance)
    : components.filter(c => !c.isPreventiveMaintenance);

  if (filtered.length === 0) return [bodyPara('No components found.')];

  const headerColor = isPM ? GREEN : NAVY;

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      thc('Component', { shading: headerColor, width: 28 }),
      thc('Category', { shading: headerColor, width: 10 }),
      thc('Qty', { shading: headerColor, width: 6 }),
      thc('Unit', { shading: headerColor, width: 6 }),
      thc('Unit Cost', { shading: headerColor, width: 10 }),
      thc('Total Cost', { shading: headerColor, width: 10 }),
      thc('Useful Life', { shading: headerColor, width: 8 }),
      thc('Remaining Life', { shading: headerColor, width: 8 }),
      thc('Replace Year', { shading: headerColor, width: 8 }),
      thc('Note', { shading: headerColor, width: 6 }),
    ]
  });

  const rows = [headerRow];
  let totalCost = 0;

  filtered.forEach((comp, i) => {
    const bg = i % 2 === 0 ? WHITE : LIGHT_GRAY;
    const cost = parseFloat(comp.totalCost) || 0;
    totalCost += cost;
    const startYear = parseInt(comp.replacementYear) || '';

    rows.push(new TableRow({
      children: [
        tc(comp.description || comp.name || '', { size: 14, shading: bg }),
        tc(comp.category || '', { size: 14, shading: bg, align: AlignmentType.CENTER }),
        tc(comp.quantity || '', { size: 14, shading: bg, align: AlignmentType.CENTER }),
        tc(comp.unit || '', { size: 14, shading: bg, align: AlignmentType.CENTER }),
        tc(fmt(comp.unitCost), { size: 14, shading: bg, align: AlignmentType.RIGHT }),
        tc(fmt(cost), { size: 14, shading: bg, align: AlignmentType.RIGHT }),
        tc(comp.usefulLife || '', { size: 14, shading: bg, align: AlignmentType.CENTER }),
        tc(comp.remainingUsefulLife || '', { size: 14, shading: bg, align: AlignmentType.CENTER }),
        tc(startYear, { size: 14, shading: bg, align: AlignmentType.CENTER }),
        tc('N/A', { size: 14, shading: bg, align: AlignmentType.CENTER }),
      ]
    }));
  });

  // Total row
  rows.push(new TableRow({
    children: [
      tc('TOTAL:', { bold: true, size: 14, shading: 'd9d9d9', span: 5, align: AlignmentType.RIGHT }),
      tc(fmt(totalCost), { bold: true, size: 14, shading: 'd9d9d9', align: AlignmentType.RIGHT }),
      tc('', { size: 14, shading: 'd9d9d9', span: 4 }),
    ]
  }));

  return [new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })];
}

function buildCashFlowTable(cashFlow, fundInfo, startingBalance, isPM = false) {
  if (!cashFlow || cashFlow.length === 0) return [bodyPara('No cash flow data available.')];

  const headerColor = isPM ? GREEN : NAVY;
  const recommended = fundInfo.recommendedContribution || 0;

  const rows = [];

  // Header rows
  rows.push(new TableRow({
    tableHeader: true,
    children: [
      thc('Fiscal\nYear', { shading: headerColor, width: 8 }),
      thc('Current\nContribution', { shading: headerColor, width: 13 }),
      thc('Annual\nExpenditures', { shading: headerColor, width: 13 }),
      thc('Ending\nBalance', { shading: headerColor, width: 13 }),
      thc('Annual\nContribution', { shading: headerColor, width: 13 }),
      thc('Average Annual\nContribution', { shading: headerColor, width: 13 }),
      thc('Ending\nBalance', { shading: headerColor, width: 13 }),
    ]
  }));

  let cumulativeExpend = 0;

  cashFlow.forEach((row, i) => {
    const bg = i % 2 === 0 ? WHITE : LIGHT_GRAY;
    cumulativeExpend += (row.expenditures || 0);
    const fullBal = startingBalance + (recommended * (i + 1)) - cumulativeExpend;
    const endBal = row.endingBalance || 0;

    rows.push(new TableRow({
      children: [
        tc(row.year, { bold: true, size: 14, shading: bg, align: AlignmentType.CENTER }),
        tc(fmt(row.contributions), { size: 14, shading: bg, align: AlignmentType.RIGHT }),
        tc(fmt(row.expenditures), { size: 14, shading: bg, align: AlignmentType.RIGHT }),
        tc(fmt(endBal), { size: 14, shading: bg, align: AlignmentType.RIGHT, color: endBal < 0 ? 'dc2626' : '1a1a1a', bold: endBal < 0 }),
        tc(fmt(recommended), { size: 14, shading: bg, align: AlignmentType.RIGHT }),
        tc(fmt(recommended), { size: 14, shading: bg, align: AlignmentType.RIGHT }),
        tc(fmt(fullBal), { size: 14, shading: bg, align: AlignmentType.RIGHT }),
      ]
    }));
  });

  // Total row
  const totalContrib = cashFlow.reduce((s, r) => s + (r.contributions || 0), 0);
  const totalExpend = cashFlow.reduce((s, r) => s + (r.expenditures || 0), 0);
  rows.push(new TableRow({
    children: [
      tc('TOTAL', { bold: true, size: 14, shading: 'd9d9d9', align: AlignmentType.CENTER }),
      tc(fmt(totalContrib), { bold: true, size: 14, shading: 'd9d9d9', align: AlignmentType.RIGHT }),
      tc(fmt(totalExpend), { bold: true, size: 14, shading: 'd9d9d9', align: AlignmentType.RIGHT }),
      tc('', { size: 14, shading: 'd9d9d9' }),
      tc(fmt(recommended * 30), { bold: true, size: 14, shading: 'd9d9d9', align: AlignmentType.RIGHT }),
      tc(fmt(recommended * 30), { bold: true, size: 14, shading: 'd9d9d9', align: AlignmentType.RIGHT }),
      tc('', { size: 14, shading: 'd9d9d9' }),
    ]
  }));

  return [new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })];
}

function buildThresholdSection(data) {
  const { results, site } = data;
  const thresholds = results.thresholds || {};
  const rf = results.reserveFund || {};
  const cashFlow = results.reserveCashFlow || [];
  const startBal = parseFloat(site.beginningReserveBalance) || rf.currentBalance || 0;

  const children = [
    bookmarkPara('threshold', 'RESERVE FUND THIRTY YEAR THRESHOLD FUNDING'),
    bodyPara('Shows 30-year projections under four funding scenarios: 10% Threshold, 5% Threshold, Baseline (0%), and Full Funding.'),
    emptyPara(),
  ];

  // Summary info
  const scenarios = [
    { name: '10% Threshold', mult: thresholds.multiplier10, contrib: thresholds.contribution10, minBal: thresholds.minBalance10, pct: thresholds.percentOfBeginning10 },
    { name: '5% Threshold', mult: thresholds.multiplier5, contrib: thresholds.contribution5, minBal: thresholds.minBalance5, pct: thresholds.percentOfBeginning5 },
    { name: 'Baseline (0%)', mult: thresholds.multiplierBaseline, contrib: thresholds.contributionBaseline, minBal: thresholds.minBalanceBaseline, pct: thresholds.percentOfBeginningBaseline },
    { name: 'Full Funding', mult: 1, contrib: rf.recommendedContribution, minBal: null, pct: rf.percentFunded },
  ];

  scenarios.forEach(s => {
    children.push(new Paragraph({
      spacing: { before: 60, after: 40 },
      children: [
        new TextRun({ text: `${s.name}: `, bold: true, size: 20, font: 'Arial' }),
        new TextRun({ text: `Multiplier ${(s.mult || 0).toFixed(4)} | Annual Contribution ${fmt(s.contrib)}${s.minBal !== null ? ' | Min Balance ' + fmt(s.minBal) : ''}`, size: 20, font: 'Arial' }),
      ]
    }));
  });

  children.push(pageBreak());

  // Build 30-year comparison table
  const proj10 = thresholds.projection10 || [];
  const proj5 = thresholds.projection5 || [];
  const projBase = thresholds.projectionBaseline || [];
  const fullContrib = rf.recommendedContribution || 0;

  children.push(new Paragraph({
    spacing: { before: 100, after: 100 },
    shading: { type: ShadingType.SOLID, color: NAVY },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: '30-Year Threshold Projection Comparison', bold: true, size: 22, color: WHITE, font: 'Arial' })]
  }));

  const thRows = [];
  // Header
  thRows.push(new TableRow({
    tableHeader: true,
    children: [
      thc('Year', { width: 8 }),
      thc('10% Expend', { shading: 'f59e0b', width: 11 }),
      thc('10% Balance', { shading: 'f59e0b', width: 12 }),
      thc('5% Expend', { shading: 'eab308', width: 11 }),
      thc('5% Balance', { shading: 'eab308', width: 12 }),
      thc('Base Expend', { shading: '22c55e', width: 11 }),
      thc('Base Balance', { shading: '22c55e', width: 12 }),
      thc('Full Expend', { shading: '3b82f6', width: 11 }),
      thc('Full Balance', { shading: '3b82f6', width: 12 }),
    ]
  }));

  let fullBal = startBal;
  const baseProj = proj10.length > 0 ? proj10 : cashFlow;

  baseProj.forEach((row, i) => {
    const bg = i % 2 === 0 ? WHITE : LIGHT_GRAY;
    const r10 = proj10[i] || {};
    const r5 = proj5[i] || {};
    const rB = projBase[i] || {};
    const exp = row.expenditures || 0;
    fullBal = fullBal + fullContrib - exp;

    thRows.push(new TableRow({
      children: [
        tc(row.year || r10.year || '', { bold: true, size: 12, shading: bg, align: AlignmentType.CENTER }),
        tc(fmt(r10.expenditures || exp), { size: 12, shading: bg, align: AlignmentType.RIGHT }),
        tc(fmt(r10.endingBalance), { size: 12, shading: bg, align: AlignmentType.RIGHT }),
        tc(fmt(r5.expenditures || exp), { size: 12, shading: bg, align: AlignmentType.RIGHT }),
        tc(fmt(r5.endingBalance), { size: 12, shading: bg, align: AlignmentType.RIGHT }),
        tc(fmt(rB.expenditures || exp), { size: 12, shading: bg, align: AlignmentType.RIGHT }),
        tc(fmt(rB.endingBalance), { size: 12, shading: bg, align: AlignmentType.RIGHT }),
        tc(fmt(exp), { size: 12, shading: bg, align: AlignmentType.RIGHT }),
        tc(fmt(fullBal), { size: 12, shading: bg, align: AlignmentType.RIGHT }),
      ]
    }));
  });

  children.push(new Table({ rows: thRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
  return children;
}

function buildExpenditureSection(components, startYear, isPM = false) {
  const filtered = isPM
    ? components.filter(c => c.isPreventiveMaintenance)
    : components.filter(c => !c.isPreventiveMaintenance);

  const yearData = [];
  for (let i = 0; i < 30; i++) {
    const year = startYear + i;
    const items = [];
    let total = 0;
    filtered.forEach(comp => {
      const replYear = parseInt(comp.replacementYear) || (startYear + (parseInt(comp.remainingUsefulLife) || 0));
      if (replYear === year) {
        items.push({ name: comp.description || comp.name, cost: parseFloat(comp.totalCost) || 0 });
        total += parseFloat(comp.totalCost) || 0;
      }
    });
    if (total > 0) yearData.push({ year, items, total });
  }

  if (yearData.length === 0) return [bodyPara('No expenditures scheduled.')];

  const headerColor = isPM ? GREEN : NAVY;
  const rows = [];
  rows.push(new TableRow({
    tableHeader: true,
    children: [
      thc('Year', { shading: headerColor, width: 10 }),
      thc('Components to be Replaced', { shading: headerColor, width: 65 }),
      thc('Total Cost', { shading: headerColor, width: 25 }),
    ]
  }));

  let grandTotal = 0;
  yearData.forEach((yd, i) => {
    const bg = i % 2 === 0 ? WHITE : LIGHT_GRAY;
    const compList = yd.items.map(e => `${e.name} (${fmt(e.cost)})`).join('; ');
    grandTotal += yd.total;
    rows.push(new TableRow({
      children: [
        tc(yd.year, { bold: true, size: 16, shading: bg, align: AlignmentType.CENTER }),
        tc(compList, { size: 16, shading: bg }),
        tc(fmt(yd.total), { bold: true, size: 16, shading: bg, align: AlignmentType.RIGHT }),
      ]
    }));
  });

  rows.push(new TableRow({
    children: [
      tc('TOTAL ALL YEARS:', { bold: true, size: 16, shading: 'd9d9d9', span: 2, align: AlignmentType.RIGHT }),
      tc(fmt(grandTotal), { bold: true, size: 16, shading: 'd9d9d9', align: AlignmentType.RIGHT }),
    ]
  }));

  return [new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })];
}

function buildFinancialResults(data) {
  const { results, site } = data;
  const rf = results.reserveFund || {};
  const pf = results.pmFund || {};
  const hasPM = results.pmRequired;
  const beginBal = fmt(site.beginningReserveBalance || rf.currentBalance);
  const curContrib = fmt(site.currentAnnualContribution || rf.currentContribution);
  const name = site.siteName || 'the Association';

  const children = [
    bookmarkPara('financial', 'FINANCIAL RESULTS'),
    bodyPara(`The primary goal of capital reserve planning is to provide adequate funding for the replacement of the capital components within the community. Effective planning ensures that expenditures for these projects are spread across many years, making funds available when they are needed.`),
    bodyPara(`The charts shown in this report provide a 30-year projection of the funding requirements for ${name}. This reserve study funding analysis includes funding options: Full Funding, Current Funding, and Threshold Funding.`),
    bodyPara(`Current Funding: reflects the beginning balance with the current annual contribution added and projected expenses subtracted each year. The beginning balance and current annual contribution of ${beginBal} and ${curContrib} were provided by the Property Manager.`),
    bodyPara('Full Funding: is the annual contribution and fund balances for each year as if each component were Fully Funded.'),
    bodyPara('Threshold Funding: represents the annual contribution and fund balance for each year as if the reserve balance were to be maintained at or above a specified amount.'),
    emptyPara(),
    subHeader('Reserve Study Funding Summary'),
    bodyPara(`Current Annual Contribution: ${curContrib}`),
    bodyPara(`Full Funding Annual Contribution: ${fmt(rf.recommendedContribution)}`),
  ];

  if (hasPM) {
    children.push(emptyPara());
    children.push(subHeader('Preventive Maintenance Funding'));
    children.push(bodyPara(`Current Annual Contribution: ${fmt(site.currentPMContribution || pf.currentContribution)}`));
    children.push(bodyPara(`Annual Full Funding Contribution: ${fmt(pf.recommendedContribution)}`));
  }

  return children;
}

function buildRecommendations(data) {
  const { results, site, organization } = data;
  const rf = results.reserveFund || {};
  const pf = results.pmFund || {};
  const hasPM = results.pmRequired;
  const name = site.siteName || 'the Association';
  const company = organization.name || site.companyName || 'the consultant';
  const curContrib = fmt(site.currentAnnualContribution || rf.currentContribution);

  const children = [
    bookmarkPara('recommendations', 'RECOMMENDATIONS', ORANGE),
    bodyPara(`The following recommendations are based on our review of the community and information provided by the Association and other representatives of ${name}.`),
    emptyPara(),
    subHeader('Financial Recommendation - Reserve Funding'),
    bodyPara(`The current annual contribution of ${curContrib} is inadequate.`),
    bodyPara(`${company} recommends increasing the annual contribution to ${fmt(rf.recommendedContribution)} as shown on the Reserve Study Funding Plan.`),
  ];

  if (hasPM) {
    children.push(emptyPara());
    children.push(subHeader('Preventive Maintenance Funding'));
    children.push(bodyPara(`Current Annual Contribution: ${fmt(site.currentPMContribution || pf.currentContribution)}`));
    children.push(bodyPara(`Recommended: ${fmt(pf.recommendedContribution)}`));
  }

  children.push(emptyPara());
  children.push(subHeader('Updating the Reserve Study'));
  children.push(bodyPara(`${company} recommends updating the reserve study Every Three (3) Years.`));
  children.push(bodyPara('Regular updates will help avoid the necessity of large increases in the future.'));

  return children;
}

function buildDisclosures(data) {
  const { site, organization } = data;
  const name = site.siteName || 'the Association';
  const company = organization.name || site.companyName || 'the consultant';
  const preparedBy = organization.preparedBy || site.preparedBy || 'the preparer';

  return [
    bookmarkPara('disclosures', 'DISCLOSURES'),
    bodyPara(`${company} is not aware of any involvement with ${name} that could result in any actual or perceived conflicts of interest that would influence the preparation of this study.`),
    bodyPara('The physical on-site observations performed in the preparation of this study were cursory in nature and only included the accessible common and limited common elements.'),
    bodyPara(`Unless specifically noted within this report, ${company} has not utilized any assumptions regarding interest, inflation, taxes, or any other outside economic factors.`),
    bodyPara(`This study was prepared by ${preparedBy}, ${company}.`),
    bodyPara(`${company} is not aware of any material issues which, if not disclosed, would cause a distortion of the Association's situation.`),
    bodyPara(`Information provided by the official representative of the Association regarding financial, physical, quantity, or historical issues will be deemed reliable by ${company}.`),
  ];
}

function buildBibliography(data) {
  const { site } = data;
  const name = site.siteName || 'the Association';
  const prepBy = site.masterDeedPreparedBy || '{prepared by}';
  const dated = site.masterDeedDate || '{dated}';

  return [
    bookmarkPara('bibliography', 'BIBLIOGRAPHY'),
    bodyPara(`1. Master Deed of ${name}`),
    bodyPara(`   Prepared by ${prepBy}`),
    bodyPara(`   Dated ${dated}`),
    emptyPara(),
    bodyPara('2. Best Practices for Reserve Studies/Management'),
    bodyPara('   By the Foundation for Community Association Research, Dated 2023'),
    emptyPara(),
    bodyPara('3. National Reserve Study Standards'),
    bodyPara('   By the Community Associations Institute, Dated 2023'),
    emptyPara(),
    bodyPara('4. Cost Works'),
    bodyPara('   By R.S. Means Company, Dated 2025'),
    emptyPara(),
    bodyPara('5. Common Interest Realty Association Audit and Accounting Guide'),
    bodyPara('   By the American Institute of Certified Public Accountants, Dated 2021'),
  ];
}

// ============================================================
// MAIN EXPORT FUNCTION
// ============================================================
export async function exportToDocx(reportData, fileName, options = {}) {
  const { site, components, results, organization, notes } = reportData;
  const { logoData: preloadedLogo } = options;

  const hasPM = results.pmRequired;
  const startYear = parseInt(site.beginningYear) || new Date().getFullYear();
  const companyName = organization.name || site.companyName || '';
  const orgCity = organization.city || '';
  const orgState = organization.state || '';
  const orgZip = organization.zipCode || '';
  const orgPhone = organization.phone || '';
  const addressStr = [orgCity, orgState].filter(Boolean).join(', ') + (orgZip ? ' ' + orgZip : '');
  const phoneStr = orgPhone ? 'C:' + orgPhone : '';
  const footerParts = [companyName, addressStr, phoneStr].filter(Boolean);
  const footerText = footerParts.join(' | ');
  const beginBal = parseFloat(site.beginningReserveBalance) || (results.reserveFund || {}).currentBalance || 0;

  // Logo: use pre-loaded data or try fetching
  let logoImageData = preloadedLogo || null;
  const logoUrl = organization.logoUrl || '';
  if (!logoImageData && logoUrl) {
    try {
      const resp = await fetch(logoUrl, { mode: 'cors' });
      if (resp.ok) {
        const blob = await resp.blob();
        const buffer = await blob.arrayBuffer();
        logoImageData = new Uint8Array(buffer);
        console.log('Logo fetched successfully, size:', logoImageData.length);
      } else {
        console.warn('Logo fetch failed with status:', resp.status);
      }
    } catch (e) {
      console.warn('Could not fetch logo:', e.message);
      // Try loading via Image element as fallback
      try {
        logoImageData = await new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(async (blob) => {
              if (blob) {
                const buf = await blob.arrayBuffer();
                resolve(new Uint8Array(buf));
              } else {
                reject(new Error('Canvas toBlob failed'));
              }
            }, 'image/png');
          };
          img.onerror = () => reject(new Error('Image load failed'));
          img.src = logoUrl;
        });
        console.log('Logo loaded via Image element, size:', logoImageData.length);
      } catch (e2) {
        console.warn('Logo fallback also failed:', e2.message);
      }
    }
  }

  // ========================================
  // BUILD COVER PAGE CHILDREN
  // ========================================
  const coverChildren = [];

  // Spacer
  coverChildren.push(emptyPara());
  coverChildren.push(emptyPara());

  // Logo
  if (logoImageData) {
    coverChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new ImageRun({
          data: logoImageData,
          transformation: { width: 250, height: 80 },
          type: 'png',
        })
      ]
    }));
    coverChildren.push(emptyPara());
  }

  // Project Name
  coverChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
    children: [
      new TextRun({ text: site.siteName || 'Project Name', bold: true, size: 52, color: NAVY, font: 'Arial' })
    ]
  }));

  // Study titles
  const studyType = site.studyType || 'Level 1: Full Reserve Study';
  const titles = ['RESERVE STUDY'];
  if (hasPM) {
    titles.push('&');
    titles.push('PREVENTIVE MAINTENANCE');
    titles.push('SCHEDULE');
  }
  titles.forEach(t => {
    coverChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 40 },
      children: [
        new TextRun({ text: t, bold: true, size: 36, font: 'Arial', characterSpacing: 60 })
      ]
    }));
  });

  // Prepared By
  coverChildren.push(emptyPara());
  coverChildren.push(emptyPara());
  coverChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: 'PREPARED BY: ', bold: true, size: 22, font: 'Arial' }),
      new TextRun({ text: companyName, size: 22, font: 'Arial' }),
    ]
  }));
  coverChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: 'SUBMITTED: ', bold: true, size: 22, font: 'Arial' }),
      new TextRun({ text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), size: 22, font: 'Arial' }),
    ]
  }));

  // ========================================
  // BUILD MAIN CONTENT CHILDREN
  // ========================================
  const mainChildren = [];

  // TOC
  mainChildren.push(...buildTOC(hasPM));
  mainChildren.push(pageBreak());

  // Introduction
  mainChildren.push(...buildIntroduction(reportData));
  mainChildren.push(pageBreak());

  // Description
  mainChildren.push(...buildDescription(reportData));
  mainChildren.push(pageBreak());

  // Reserve Chart
  mainChildren.push(...buildReserveChart(reportData));
  mainChildren.push(pageBreak());

  // Terms
  mainChildren.push(...buildTerms());
  mainChildren.push(pageBreak());

  // Responsible Charge
  mainChildren.push(...buildResponsibleCharge());

  // Special Assessment
  mainChildren.push(...buildSpecialAssessment());
  mainChildren.push(pageBreak());

  // Physical Analysis
  mainChildren.push(...buildPhysicalAnalysis(reportData));
  mainChildren.push(pageBreak());

  // Component Summary
  mainChildren.push(bookmarkPara('compsummary', 'COMPONENT SCHEDULE SUMMARY'));
  mainChildren.push(bodyPara('Useful Life = Total expected lifespan | Remaining Life = Years until replacement | PM = Preventive Maintenance | Note = Component Note Reference'));
  mainChildren.push(...buildComponentTable(components, false));
  mainChildren.push(pageBreak());

  // Capital Items
  mainChildren.push(bookmarkPara('capitalitems', 'CAPITAL ITEMS / COMPONENTS'));
  mainChildren.push(bodyPara('The following notes provide information on the location, condition, and replacement cost of the components listed in the tables.'));

  // Group by category
  const reserveComps = components.filter(c => !c.isPreventiveMaintenance);
  const categories = [...new Set(reserveComps.map(c => c.category || 'General'))];
  categories.forEach(cat => {
    const catComps = reserveComps.filter(c => (c.category || 'General') === cat);
    mainChildren.push(subHeader(cat));
    mainChildren.push(...buildComponentTable(catComps.map(c => ({ ...c, isPreventiveMaintenance: false }))));
  });
  mainChildren.push(pageBreak());

  // Component Notes
  mainChildren.push(bookmarkPara('compnotes', 'COMPONENTS NOTES'));
  mainChildren.push(bodyPara('*EA = Each, *LF = Linear Foot, *LS = Lump Sum, *SF = Square Feet, *SY = Square Yard, *SQ = Square'));
  const compNotes = (notes || []).filter(n => components.some(c => c.noteId === n.id));
  if (compNotes.length === 0) {
    mainChildren.push(bodyPara('No component notes assigned'));
  } else {
    compNotes.forEach(n => {
      mainChildren.push(bodyPara(`${n.label || n.id}: ${n.text || ''}`));
    });
  }
  mainChildren.push(pageBreak());

  // Financial Results
  mainChildren.push(...buildFinancialResults(reportData));
  mainChildren.push(pageBreak());

  // Cash Flow
  mainChildren.push(bookmarkPara('cashflow', 'RESERVE FUND THIRTY YEAR CASH FLOW'));
  mainChildren.push(...buildCashFlowTable(results.reserveCashFlow, results.reserveFund || {}, beginBal));
  mainChildren.push(pageBreak());

  // Threshold
  mainChildren.push(...buildThresholdSection(reportData));
  mainChildren.push(pageBreak());

  // Expenditures
  mainChildren.push(bookmarkPara('expenditures', 'RESERVE FUND EXPENDITURES'));
  mainChildren.push(...buildExpenditureSection(components, startYear, false));
  mainChildren.push(pageBreak());

  // PM Sections
  if (hasPM) {
    mainChildren.push(bookmarkPara('pmsection', 'PREVENTIVE MAINTENANCE', GREEN));
    mainChildren.push(subHeader('Component Schedule Summary'));
    mainChildren.push(...buildComponentTable(components, true));
    mainChildren.push(pageBreak());

    mainChildren.push(bookmarkPara('pmexpend', 'PM EXPENDITURES', GREEN));
    mainChildren.push(...buildExpenditureSection(components, startYear, true));
    mainChildren.push(pageBreak());

    mainChildren.push(bookmarkPara('pmcashflow', 'PM THIRTY YEAR CASH FLOW', GREEN));
    const pmBal = parseFloat(site.beginningPMBalance) || (results.pmFund || {}).currentBalance || 0;
    mainChildren.push(...buildCashFlowTable(results.pmCashFlow, results.pmFund || {}, pmBal, true));
    mainChildren.push(pageBreak());
  }

  // Recommendations
  mainChildren.push(...buildRecommendations(reportData));
  mainChildren.push(pageBreak());

  // Disclosures
  mainChildren.push(...buildDisclosures(reportData));
  mainChildren.push(pageBreak());

  // Bibliography
  mainChildren.push(...buildBibliography(reportData));

  // ========================================
  // CREATE DOCUMENT
  // ========================================
  // Cover page footer (company info, no page number)
  const coverFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: companyName, size: 18, color: GRAY, font: 'Arial' }),
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: `${addressStr} ${phoneStr}`, size: 18, color: GRAY, font: 'Arial' }),
        ]
      }),
    ]
  });

  // Main pages footer (company info + page number)
  const mainFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc', space: 4 } },
        children: [
          new TextRun({ text: footerText + '  |  Page ', size: 14, color: GRAY, font: 'Arial' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 14, color: GRAY, font: 'Arial' }),
        ]
      })
    ]
  });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 20 }
        },
        hyperlink: {
          run: { color: '1a1a1a', underline: {} }
        }
      }
    },
    sections: [
      // COVER PAGE - company info footer (no page number)
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 720, bottom: 720, left: 1080, right: 1080 },
          },
        },
        footers: {
          default: coverFooter,
        },
        children: coverChildren,
      },
      // MAIN CONTENT - full footer with page numbers
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, bottom: 1440, left: 1080, right: 1080 },
            pageNumbers: { start: 2 },
          },
        },
        headers: {
          default: new Header({ children: [emptyPara()] }),
        },
        footers: {
          default: mainFooter,
        },
        children: mainChildren,
      },
    ],
  });

  // Generate and download
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.replace(/\.doc$/, '.docx');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
