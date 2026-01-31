// Professional Report Template - Beahm Consulting Format v7
// FIXED: Consolidated sections, removed unnecessary page breaks, compact footer

export const DEFAULT_REPORT_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{projectName} - Reserve Study Report</title>
  <style>
    @page {
      size: letter;
      margin: 0.6in 0.6in 0.5in 0.6in;
    }
    
    @media print {
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      .avoid-break { page-break-inside: avoid; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      line-height: 1.35;
      color: #1a1a1a;
      background: white;
      max-width: 8.5in;
      margin: 0 auto;
    }
    
    /* ============ COMPACT PAGE FOOTER ============ */
    .page-footer {
      text-align: center;
      padding: 4px 0;
      margin-top: 10px;
      border-top: 1px solid #ccc;
      font-size: 7pt;
      color: #666;
    }
    
    .page-footer .company-name {
      font-weight: bold;
      color: #1e3a5f;
    }
    
    /* ============ COVER PAGE ============ */
    .cover-page {
      min-height: 9.5in;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
      text-align: center;
      padding: 0.5in 0.8in 0.3in 0.8in;
      background: white;
    }
    
    .cover-logo {
      margin-bottom: 0.3in;
      max-width: 3.5in;
      max-height: 1in;
    }
    
    .cover-logo img {
      max-width: 100%;
      max-height: 1in;
      object-fit: contain;
    }
    
    .cover-project-name {
      font-size: 24pt;
      font-weight: bold;
      margin: 0.3in 0;
      color: #1e3a5f;
    }
    
    .cover-title-section {
      margin: 0.2in 0;
      padding: 0.2in 0;
    }
    
    .cover-title {
      font-size: 16pt;
      font-weight: bold;
      letter-spacing: 2px;
      color: #1a1a1a;
      margin: 0.05in 0;
    }
    
    .cover-title-highlight {
      font-size: 16pt;
      font-weight: bold;
      letter-spacing: 2px;
      background: #e07020;
      color: white;
      padding: 2px 8px;
      display: inline-block;
      margin: 0.03in 0;
    }
    
    .cover-and {
      font-size: 12pt;
      margin: 0.05in 0;
      color: #666;
    }
    
    .cover-prepared {
      margin-top: 0.4in;
      font-size: 10pt;
    }
    
    .cover-prepared p { margin: 0.05in 0; }
    
    .cover-compliance {
      margin-top: 0.3in;
      font-size: 8pt;
      font-style: italic;
      color: #666;
      border-top: 1px solid #ddd;
      padding-top: 0.15in;
    }
    
    .cover-footer {
      margin-top: auto;
      padding-top: 0.2in;
      text-align: center;
      font-size: 8pt;
      color: #666;
      border-top: 1px solid #1e3a5f;
      width: 100%;
    }
    
    .cover-footer .company-name {
      font-weight: bold;
      font-size: 9pt;
      color: #1e3a5f;
    }
    
    /* ============ TABLE OF CONTENTS ============ */
    .toc-page { padding: 0.2in 0; }
    .toc-title {
      font-size: 14pt;
      font-weight: bold;
      color: #1e3a5f;
      border-bottom: 2px solid #1e3a5f;
      padding-bottom: 0.1in;
      margin-bottom: 0.15in;
    }
    
    .toc-section {
      display: flex;
      justify-content: space-between;
      padding: 0.04in 0;
      border-bottom: 1px dotted #ccc;
      text-decoration: none;
      color: #1a1a1a;
      font-size: 9pt;
    }
    
    .toc-section:hover { background: #f5f5f5; }
    
    /* ============ SECTION HEADERS ============ */
    .section-header {
      background: #1e3a5f;
      color: white;
      padding: 8px 12px;
      font-size: 12pt;
      font-weight: bold;
      margin: 0.12in 0 0.08in 0;
      border-radius: 3px;
    }
    
    .section-header.green { background: linear-gradient(135deg, #166534 0%, #22c55e 100%); }
    .section-header.orange { background: linear-gradient(135deg, #c2410c 0%, #f97316 100%); }
    .section-header.gold { background: linear-gradient(135deg, #a16207 0%, #eab308 100%); }
    
    .subsection-header {
      font-size: 11pt;
      font-weight: bold;
      color: #1e3a5f;
      border-bottom: 2px solid #1e3a5f;
      padding-bottom: 3px;
      margin: 0.1in 0 0.06in 0;
    }
    
    /* ============ CONTENT ============ */
    .content-section { margin-bottom: 0.1in; }
    p { margin: 0.05in 0; text-align: justify; font-size: 9pt; }
    
    /* ============ TWO COLUMN CHART ============ */
    .two-column-chart {
      display: flex;
      gap: 0.15in;
      margin: 0.1in 0;
    }
    
    .chart-box {
      flex: 1;
      border: 1px solid #ddd;
      border-radius: 5px;
      overflow: hidden;
    }
    
    .chart-header {
      padding: 6px 10px;
      font-weight: bold;
      font-size: 10pt;
      border-bottom: 1px solid #ddd;
    }
    
    .chart-header.reserve { background: #f1f5f9; color: #1e3a5f; }
    .chart-header.pm { background: #dcfce7; color: #166534; }
    
    .chart-content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding: 8px;
    }
    
    .chart-item label { font-size: 7pt; color: #666; display: block; }
    .chart-item .value { font-size: 11pt; font-weight: bold; color: #1a1a1a; }
    .chart-item .value.green { color: #16a34a; }
    
    /* ============ INFO TABLE ============ */
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 0.08in 0;
      font-size: 9pt;
    }
    
    .info-table td {
      padding: 4px 8px;
      border-bottom: 1px solid #e5e5e5;
    }
    
    .info-table td:first-child { width: 65%; }
    .info-table td:last-child { text-align: right; font-weight: bold; }
    .info-table tr:nth-child(even) { background: #f8f9fa; }
    .info-table .highlight { color: #16a34a; }
    
    /* ============ TABLES ============ */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 0.08in 0;
      font-size: 8pt;
    }
    
    th {
      background: #1e3a5f;
      color: white;
      padding: 4px 3px;
      text-align: left;
      font-weight: bold;
      font-size: 7pt;
    }
    
    td {
      padding: 3px;
      border-bottom: 1px solid #e5e5e5;
    }
    
    tr:nth-child(even) { background: #f8f9fa; }
    
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-bold { font-weight: bold; }
    
    .total-row {
      background: #1e3a5f !important;
      color: white;
      font-weight: bold;
    }
    
    .negative { color: #dc2626; font-weight: bold; }
    
    /* ============ COMPONENT TABLE ============ */
    .component-table { font-size: 7pt; }
    .component-table th { padding: 3px 2px; font-size: 6pt; }
    .component-table td { padding: 2px; }
    
    /* ============ CASH FLOW TABLE ============ */
    .cashflow-table { font-size: 6pt; }
    .cashflow-table th { padding: 3px 2px; font-size: 6pt; }
    .cashflow-table td { padding: 2px; text-align: right; }
    .cashflow-table td:first-child { text-align: center; font-weight: bold; background: #f1f5f9; }
    
    /* ============ EXPENDITURE TABLE ============ */
    .expenditure-table { font-size: 8pt; }
    .expenditure-table th { padding: 4px; }
    .expenditure-table td { padding: 3px 4px; }
    .expenditure-table td:first-child { width: 60px; text-align: center; font-weight: bold; }
    .expenditure-table td:last-child { width: 80px; text-align: right; font-weight: bold; }
    
    /* ============ RECOMMENDATION BOXES ============ */
    .recommendation-box {
      border: 2px solid #c55a11;
      border-radius: 5px;
      margin: 0.08in 0;
      overflow: hidden;
    }
    
    .recommendation-header {
      background: #fef3e8;
      padding: 5px 8px;
      font-weight: bold;
      color: #c55a11;
      border-bottom: 1px solid #c55a11;
      font-size: 9pt;
    }
    
    .recommendation-body {
      padding: 8px;
      background: #fffbf5;
      font-size: 9pt;
    }
    
    .recommendation-box.green { border-color: #22c55e; }
    .recommendation-box.green .recommendation-header {
      background: #dcfce7;
      color: #166534;
      border-color: #22c55e;
    }
    .recommendation-box.green .recommendation-body { background: #f0fdf4; }
    
    .recommendation-box.blue { border-color: #3b82f6; }
    .recommendation-box.blue .recommendation-header {
      background: #dbeafe;
      color: #1e40af;
      border-color: #3b82f6;
    }
    .recommendation-box.blue .recommendation-body { background: #eff6ff; }
    
    /* ============ LISTS ============ */
    ul, ol { margin: 0.04in 0 0.04in 0.2in; font-size: 9pt; }
    li { margin: 0.02in 0; }
    
    /* ============ EDITABLE SECTIONS ============ */
    .editable-section { min-height: 8px; }
    .editable-section:focus { outline: 2px dashed #3b82f6; background: #eff6ff; }
    
    /* ============ PAGE BREAKS - USE SPARINGLY ============ */
    .page-break { page-break-before: always; height: 0; margin: 0; padding: 0; }
  </style>
</head>
<body>

<!-- ==================== COVER PAGE ==================== -->
<div class="cover-page">
  <div class="cover-logo">
    {organizationLogo}
  </div>
  
  <div class="cover-project-name">{projectName}</div>
  
  <div class="cover-title-section">
    <div class="cover-title">RESERVE STUDY</div>
    {coverSubtitle}
    <div class="cover-and">&amp;</div>
    <div class="cover-title">PREVENTIVE MAINTENANCE</div>
    <div class="cover-title">SCHEDULE</div>
  </div>
  
  <div class="cover-prepared">
    <p><strong>PREPARED BY:</strong> {companyName}</p>
    <p><strong>SUBMITTED:</strong> {currentDate}</p>
  </div>
  
  <div class="cover-compliance">
    Complies with New Jersey Residential Housing Bill S2760/A4384
  </div>
  
  <div class="cover-footer">
    <div class="company-name">{companyName}</div>
    <div>{companyFullAddress} • {companyPhone}</div>
  </div>
</div>

<div class="page-break"></div>

<!-- ==================== INTRODUCTION (Combined with Description) ==================== -->
<div id="introduction" class="section-header">INTRODUCTION</div>

<div class="subsection-header">Financial Planning</div>
<p>One of the key responsibilities of the Board of Trustees or Directors is to ensure that the property is properly protected and maintained. Effective financial planning and budgeting are essential to maintaining the property and ensuring that sufficient funds are available to meet ongoing and future needs.</p>
<p>The main objective of capital reserve planning is to ensure adequate funding for the future replacement of capital components within the community. Thoughtful planning helps distribute the cost of these projects evenly over time among owners, ensuring funds are available when needed. A well-funded reserve reduces the likelihood of significant fee increases, special assessments, or the need for loans.</p>

<div class="subsection-header">Capital Reserve Study</div>
<p>A Capital Reserve Study serves as a financial planning tool that estimates the amount of money the Community Association should set aside for the future replacement of common area components. This report has been developed in accordance with the Community Associations Institute (CAI) National Reserve Study Standards. It provides guidance in evaluating and establishing a stable reserve funding strategy for anticipated repairs and replacements.</p>

<div class="subsection-header">Level of Service Provided</div>
<p>{levelOfServiceText}</p>
<ul>
  <li><strong>Component Inventory</strong></li>
  <li><strong>Condition Assessment</strong> (based on on-site visual inspections)</li>
  <li><strong>Life and Valuation Estimates</strong></li>
  <li><strong>Fund Status Evaluation</strong></li>
  <li><strong>Development of a Funding Plan</strong></li>
</ul>

<div id="description" class="section-header">DESCRIPTION OF DEVELOPMENT</div>
<p>{siteDescription}</p>
<p contenteditable="true" class="editable-section">{physicalDescription}</p>

<!-- ==================== RESERVE STUDY CHART ==================== -->
<div id="reserve-chart" class="section-header">RESERVE STUDY CHART</div>

<div class="two-column-chart">
  <div class="chart-box">
    <div class="chart-header reserve">💰 Reserve Fund</div>
    <div class="chart-content">
      <div class="chart-item"><label>Percent Funded</label><div class="value">{reservePercentFunded}</div></div>
      <div class="chart-item"><label>Current Balance</label><div class="value">{reserveCurrentBalance}</div></div>
      <div class="chart-item"><label>Current Contribution</label><div class="value">{reserveCurrentContribution}</div></div>
      <div class="chart-item"><label>Recommended</label><div class="value green">{reserveRecommended}</div></div>
    </div>
  </div>
  <div class="chart-box">
    <div class="chart-header pm">🟢 PM Fund</div>
    <div class="chart-content">
      <div class="chart-item"><label>Percent Funded</label><div class="value">{pmPercentFunded}</div></div>
      <div class="chart-item"><label>Current Balance</label><div class="value">{pmCurrentBalance}</div></div>
      <div class="chart-item"><label>Current Contribution</label><div class="value">{pmCurrentContribution}</div></div>
      <div class="chart-item"><label>Recommended</label><div class="value green">{pmRecommended}</div></div>
    </div>
  </div>
</div>

<div class="section-header">RESERVE FUND INFORMATION</div>
<table class="info-table">
  <tr><td>Beginning Reserve Balance:</td><td>{reserveCurrentBalance}</td></tr>
  <tr><td>Current Annual Contribution:</td><td>{reserveCurrentContribution}</td></tr>
  <tr><td>Current Percent Funded:</td><td>{reservePercentFunded}</td></tr>
  <tr><td>Recommended Annual Funding:</td><td class="highlight">{reserveRecommended}</td></tr>
  <tr><td>Averaging Length in Years:</td><td>30</td></tr>
</table>

<div id="pm-fund-info" class="section-header green">PREVENTIVE MAINTENANCE FUND INFORMATION</div>
<table class="info-table">
  <tr><td>Beginning Preventive Maintenance Balance:</td><td>{pmCurrentBalance}</td></tr>
  <tr><td>Current Annual Contribution:</td><td>{pmCurrentContribution}</td></tr>
  <tr><td>Current Percent Funded:</td><td>{pmPercentFunded}</td></tr>
  <tr><td>Recommended Annual Funding:</td><td class="highlight">{pmRecommended}</td></tr>
  <tr><td>Averaging Length in Years:</td><td>30</td></tr>
</table>

<!-- ==================== TERMS, RESPONSIBLE CHARGE, ETC (Combined) ==================== -->
<div class="page-break"></div>

<div id="terms" class="section-header">TERMS AND DEFINITIONS</div>
<p><strong>Capital Improvements -</strong> Additions to the association's common elements that were not previously part of the community.</p>
<p><strong>Cash Flow Method -</strong> A method of creating a reserve funding plan in which contributions are structured to align with projected, fluctuating annual reserve expenditures.</p>
<p><strong>Component</strong> - Individual items listed in the reserve study as identified through the physical analysis.</p>
<p><strong>Fully Funded Balance (FFB) -</strong> An ideal benchmark reserve balance. Formula: FFB = Current Cost × (Effective Age ÷ Useful Life)</p>
<p><strong>Percent Funded -</strong> The ratio of the actual reserve balance to the fully funded balance.</p>
<p><strong>Remaining Useful Life (RUL) -</strong> The estimated number of years a component will continue to function before replacement.</p>
<p><strong>Useful Life (UL) -</strong> The total expected lifespan of a component from installation to replacement.</p>
<p><strong>Replacement Cost -</strong> The total cost to repair, restore, or replace a component.</p>
<p><strong>Funding Goals:</strong></p>
<ul>
  <li><strong>Full Funding:</strong> Keep reserves at or near 100% funded.</li>
  <li><strong>Threshold Funding:</strong> Maintain reserves above a specific amount.</li>
  <li><strong>Baseline Funding:</strong> Ensure fund never drops below zero.</li>
</ul>

<div id="responsible-charge" class="section-header gold">RESPONSIBLE CHARGE</div>
<p>A <strong>Reserve Specialist (RS)</strong> who is in responsible charge of a reserve study must provide consistent and effective oversight of all individuals performing tasks that directly impact the quality and accuracy of the study.</p>

<div id="special-assessment" class="section-header gold">SPECIAL ASSESSMENT</div>
<p>A <strong>Special Assessment</strong> is a temporary fee imposed on association members in addition to regular dues or assessments.</p>

<div id="physical-analysis" class="section-header">PHYSICAL ANALYSIS</div>
<p>The quantities used in the replacement cost estimates of the common elements were generated from field measurements taken during our site visit on {currentDate}. Current replacement costs were estimated using published construction cost data referenced in the Bibliography section of this report.</p>
<p>It is recommended that this reserve study be updated every three (3) to five (5) years.</p>

<!-- ==================== COMPONENT SCHEDULE SUMMARY ==================== -->
<div class="page-break"></div>

<div id="component-summary" class="section-header">COMPONENT SCHEDULE SUMMARY</div>
<p style="font-size: 8pt; color: #666; margin-bottom: 0.08in;"><em>Useful Life = Total expected lifespan | Remaining Life = Years until replacement | PM = Preventive Maintenance | Note = Component Note Reference</em></p>
{componentSummaryTable}

<!-- ==================== CAPITAL ITEMS / COMPONENTS ==================== -->
<div class="page-break"></div>

<div id="capital-items" class="section-header">CAPITAL ITEMS / COMPONENTS</div>
<p>The following provides information on the location, condition, and replacement cost of the components. Review of the common elements was conducted by {companyName} on {currentDate}.</p>
{componentsByCategory}

<div id="component-notes" class="section-header">COMPONENTS NOTES</div>
<p style="font-size: 8pt; color: #666;"><em>*EA = Each, *LF = Linear Foot, *LS = Lump Sum, *SF = Square Feet, *SY = Square Yard, *SQ = Square</em></p>
{componentNotes}

<!-- ==================== FINANCIAL RESULTS ==================== -->
<div class="page-break"></div>

<div id="financial-results" class="section-header">FINANCIAL RESULTS</div>
<p>The primary goal of capital reserve planning is to provide adequate funding for the replacement of the capital components within the community.</p>
<p><strong>Current Funding</strong> reflects the beginning balance with the current annual contribution added and projected expenses subtracted each year.</p>
<p><strong>Full Funding</strong> represents the annual contribution and fund balances for each year as if each component were fully funded.</p>

<div class="recommendation-box">
  <div class="recommendation-header">📊 Reserve Study Funding Summary</div>
  <div class="recommendation-body">
    <ul>
      <li>Current Annual Contribution: <strong>{reserveCurrentContribution}</strong></li>
      <li>Full Funding Annual Contribution for {currentYear}: <strong>{reserveRecommended}</strong></li>
      <li>Full Funding Average Annual Contribution: <strong>{reserveRecommended}</strong></li>
    </ul>
  </div>
</div>

<div class="recommendation-box green">
  <div class="recommendation-header">🟢 Preventive Maintenance Funding</div>
  <div class="recommendation-body">
    <ul>
      <li>Current Annual Contribution: <strong>{pmCurrentContribution}</strong></li>
      <li>Annual Full Funding Contribution: <strong>{pmRecommended}</strong></li>
    </ul>
  </div>
</div>

<!-- ==================== RESERVE FUND CASH FLOW ==================== -->
<div class="page-break"></div>

<div id="cash-flow" class="section-header">RESERVE FUND THIRTY YEAR CASH FLOW</div>
{reserveCashFlowTable}

<!-- ==================== THRESHOLD FUNDING ==================== -->
<div class="page-break"></div>

<div id="threshold" class="section-header">RESERVE FUND THIRTY YEAR THRESHOLD FUNDING</div>
{thresholdSection}

<!-- ==================== RESERVE FUND EXPENDITURES ==================== -->
<div class="page-break"></div>

<div id="expenditures" class="section-header">RESERVE FUND EXPENDITURES</div>
{reserveExpendituresTable}

<!-- ==================== PREVENTIVE MAINTENANCE SECTION ==================== -->
<div class="page-break"></div>

<div id="pm-section" class="section-header green">PREVENTIVE MAINTENANCE</div>
<div class="subsection-header">Component Schedule Summary</div>
{pmComponentTable}

<div id="pm-cash-flow" class="section-header green">PM THIRTY YEAR CASH FLOW</div>
{pmCashFlowTable}

<div class="page-break"></div>

<div id="pm-expenditures" class="section-header green">PM EXPENDITURES</div>
{pmExpendituresTable}

<!-- ==================== RECOMMENDATIONS ==================== -->
<div class="page-break"></div>

<div id="recommendations" class="section-header orange">RECOMMENDATIONS</div>
<p>The following recommendations are based on our review of the community and information provided by the Association. {companyName} recommends the following:</p>

<div class="recommendation-box">
  <div class="recommendation-header">💰 Financial Recommendation - RESERVE FUNDING</div>
  <div class="recommendation-body">
    <p>The current annual contribution of {reserveCurrentContribution} is {fundingAssessment}.</p>
    <p>{companyName} recommends increasing the annual contribution to {reserveRecommended} as shown on the Reserve Study Funding Plan.</p>
  </div>
</div>

<div class="recommendation-box green">
  <div class="recommendation-header">🟢 Preventive Maintenance Funding</div>
  <div class="recommendation-body">
    <p>Current Annual Contribution: <strong>{pmCurrentContribution}</strong></p>
    <p>Recommended: <strong>{pmRecommended}</strong></p>
  </div>
</div>

<div class="recommendation-box blue">
  <div class="recommendation-header">📅 Updating the Reserve Study</div>
  <div class="recommendation-body">
    <p>{companyName} recommends updating the reserve study <strong>Every Three (3) Years</strong>.</p>
    <p>New Jersey Law requires updates at a Maximum of <strong>Every Five (5) Years</strong>.</p>
  </div>
</div>

<!-- ==================== DISCLOSURES & BIBLIOGRAPHY ==================== -->
<div id="disclosures" class="section-header gold">DISCLOSURES</div>
<p>{companyName} is not aware of any conflicts of interest that would influence this study.</p>
<p>Physical observations were cursory and included only accessible common elements.</p>
<p>This study was prepared by {preparedBy}, {companyName}.</p>
<p>The Reserve Study reflects information provided and was not audited.</p>

<div id="bibliography" class="section-header">BIBLIOGRAPHY</div>
<ol>
  <li>Master Deed of {projectName}</li>
  <li>Best Practices for Reserve Studies/Management - Foundation for Community Association Research, 2023</li>
  <li>National Reserve Study Standards - Community Associations Institute, 2023</li>
  <li>Cost Works - R.S. Means Company, 2025</li>
  <li>New Jersey Reserve Study Law (NJ Senate Bill S2760/A4384), 2024</li>
</ol>

<!-- ==================== FOOTER ==================== -->
<div class="page-footer">
  <span class="company-name">{companyName}</span> | {companyFullAddress} | {companyPhone}
</div>

</body>
</html>
`;

export default DEFAULT_REPORT_TEMPLATE;
