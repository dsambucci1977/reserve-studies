// Professional Report Template - Beahm Consulting Format v5
// Added organization logo, footer branding, and dynamic Study Type support

export const DEFAULT_REPORT_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{projectName} - Reserve Study Report</title>
  <style>
    @page {
      size: letter;
      margin: 0.75in 0.75in 1in 0.75in;
    }
    
    @media print {
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page-footer { 
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
      }
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Segoe UI', 'Arial', sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1a1a1a;
      background: white;
      max-width: 8.5in;
      margin: 0 auto;
    }
    
    /* ============ PAGE FOOTER ============ */
    .page-footer {
      text-align: center;
      padding: 10px 0;
      margin-top: 30px;
      border-top: 1px solid #ddd;
      font-size: 8pt;
      color: #666;
    }
    
    .page-footer .company-name {
      font-weight: bold;
      color: #1e3a5f;
    }
    
    /* ============ COVER PAGE ============ */
    .cover-page {
      min-height: 10in;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
      text-align: center;
      padding: 0.5in 1in 1in 1in;
      background: white;
      color: #1a1a1a;
    }
    
    .cover-logo {
      margin-bottom: 0.5in;
      max-width: 4in;
      max-height: 1.5in;
    }
    
    .cover-logo img {
      max-width: 100%;
      max-height: 1.5in;
      object-fit: contain;
    }
    
    .cover-project-name {
      font-size: 28pt;
      font-weight: bold;
      margin: 0.5in 0;
      color: #1e3a5f;
    }
    
    .cover-title-box {
      border: 3px solid #1e3a5f;
      padding: 0.4in 0.8in;
      margin: 0.3in 0;
    }
    
    .cover-title {
      font-size: 20pt;
      font-weight: bold;
      letter-spacing: 2px;
      color: #1a1a1a;
    }
    
    .cover-title-highlight {
      font-size: 20pt;
      font-weight: bold;
      letter-spacing: 2px;
      background: #e07020;
      color: white;
      padding: 0.05in 0.2in;
      display: inline-block;
      margin: 0.05in 0;
    }
    
    .cover-and {
      font-size: 16pt;
      margin: 0.15in 0;
      color: #666;
    }
    
    .cover-prepared {
      margin-top: 0.8in;
      font-size: 12pt;
    }
    
    .cover-prepared p { margin: 0.1in 0; }
    
    .cover-compliance {
      margin-top: 0.6in;
      font-size: 10pt;
      font-style: italic;
      color: #666;
      border-top: 1px solid #ddd;
      padding-top: 0.3in;
    }
    
    .cover-footer {
      margin-top: auto;
      padding-top: 0.5in;
      text-align: center;
      font-size: 9pt;
      color: #666;
      border-top: 2px solid #1e3a5f;
      width: 100%;
    }
    
    .cover-footer .company-name {
      font-weight: bold;
      font-size: 11pt;
      color: #1e3a5f;
    }
    
    /* ============ TABLE OF CONTENTS ============ */
    .toc-page { padding: 0.3in; }
    
    .toc-title {
      font-size: 18pt;
      font-weight: bold;
      color: #1e3a5f;
      text-align: center;
      margin-bottom: 0.3in;
      padding-bottom: 0.1in;
      border-bottom: 3px solid #1e3a5f;
    }
    
    .toc-section {
      display: flex;
      justify-content: space-between;
      padding: 4px 10px;
      border-bottom: 1px dotted #ccc;
      font-size: 10pt;
      text-decoration: none;
      color: inherit;
    }
    
    .toc-section:hover { background: #e8f4f8; color: #1e3a5f; }
    
    .toc-section span:last-child {
      color: #666;
      font-weight: bold;
      min-width: 30px;
      text-align: right;
    }
    
    /* ============ SECTION HEADERS ============ */
    .section-header {
      background: linear-gradient(90deg, #1e3a5f 0%, #2d5a87 100%);
      color: white;
      padding: 10px 15px;
      font-size: 13pt;
      font-weight: bold;
      margin: 0.25in 0 0.15in 0;
      border-radius: 4px;
    }
    
    .section-header-green {
      background: linear-gradient(90deg, #166534 0%, #22c55e 100%);
    }
    
    .section-header-orange {
      background: linear-gradient(90deg, #c55a11 0%, #e07020 100%);
    }
    
    .sub-header {
      font-size: 12pt;
      font-weight: bold;
      color: #1e3a5f;
      margin: 0.15in 0 0.1in 0;
      padding-bottom: 3px;
      border-bottom: 2px solid #1e3a5f;
    }
    
    /* ============ CONTENT SECTIONS ============ */
    .content-section {
      padding: 0 0.1in;
      margin-bottom: 0.1in;
    }
    
    .content-section p {
      margin: 0.08in 0;
      text-align: justify;
      font-size: 10pt;
    }
    
    /* ============ SUMMARY CARDS ============ */
    .summary-cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.15in;
      margin: 0.15in 0;
    }
    
    .summary-card {
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      overflow: hidden;
    }
    
    .summary-card-header {
      padding: 6px 10px;
      font-weight: bold;
      font-size: 10pt;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .summary-card-header.reserve {
      background: linear-gradient(90deg, #dbeafe 0%, #bfdbfe 100%);
      color: #1e40af;
      border-bottom: 2px solid #3b82f6;
    }
    
    .summary-card-header.pm {
      background: linear-gradient(90deg, #dcfce7 0%, #bbf7d0 100%);
      color: #166534;
      border-bottom: 2px solid #22c55e;
    }
    
    .summary-card-body {
      padding: 10px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    
    .summary-item {
      background: #f8f9fa;
      padding: 6px;
      border-radius: 4px;
    }
    
    .summary-label {
      font-size: 7pt;
      color: #666;
      margin-bottom: 2px;
    }
    
    .summary-value {
      font-size: 12pt;
      font-weight: bold;
      color: #1a1a1a;
    }
    
    .summary-value.highlight { color: #c55a11; }
    
    /* ============ DATA TABLES ============ */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 0.1in 0;
      font-size: 8pt;
    }
    
    th {
      background: #1e3a5f;
      color: white;
      padding: 4px 3px;
      text-align: center;
      font-weight: bold;
      border: 1px solid #1e3a5f;
      font-size: 7pt;
    }
    
    td {
      padding: 3px;
      border: 1px solid #ddd;
      vertical-align: top;
    }
    
    tr:nth-child(even) { background: #f8f9fa; }
    
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-bold { font-weight: bold; }
    
    .total-row {
      background: #d9d9d9 !important;
      font-weight: bold;
    }
    
    .negative { color: #dc2626; font-weight: bold; }
    
    /* ============ COMPONENT TABLE ============ */
    .component-table { font-size: 7pt; }
    .component-table th { padding: 4px 2px; font-size: 6pt; }
    .component-table td { padding: 2px; }
    
    /* ============ CASH FLOW TABLE ============ */
    .cashflow-table { font-size: 7pt; }
    .cashflow-table th { padding: 4px 2px; font-size: 6pt; }
    .cashflow-table td { padding: 2px 3px; text-align: right; }
    .cashflow-table td:first-child { text-align: center; font-weight: bold; background: #f1f5f9; }
    
    /* ============ EXPENDITURE TABLE ============ */
    .expenditure-horizontal { font-size: 8pt; }
    .expenditure-horizontal th { padding: 5px; }
    .expenditure-horizontal td { padding: 4px; }
    
    /* ============ NOTES TABLE ============ */
    .notes-table td:first-child { width: 50px; text-align: center; font-weight: bold; background: #f1f5f9; }
    .notes-table td:nth-child(2) { width: 150px; font-weight: bold; }
    
    /* ============ RECOMMENDATION BOXES ============ */
    .recommendation-box {
      border: 2px solid #c55a11;
      border-radius: 6px;
      margin: 0.1in 0;
      overflow: hidden;
    }
    
    .recommendation-header {
      background: linear-gradient(90deg, #fef3e8 0%, #fde8d8 100%);
      padding: 6px 10px;
      font-weight: bold;
      color: #c55a11;
      border-bottom: 1px solid #c55a11;
      font-size: 9pt;
    }
    
    .recommendation-body {
      padding: 10px;
      background: #fffbf5;
      font-size: 9pt;
    }
    
    .recommendation-box.green { border-color: #22c55e; }
    .recommendation-box.green .recommendation-header {
      background: linear-gradient(90deg, #dcfce7 0%, #bbf7d0 100%);
      color: #166534;
      border-color: #22c55e;
    }
    .recommendation-box.green .recommendation-body { background: #f0fdf4; }
    
    .recommendation-box.blue { border-color: #3b82f6; }
    .recommendation-box.blue .recommendation-header {
      background: linear-gradient(90deg, #dbeafe 0%, #bfdbfe 100%);
      color: #1e40af;
      border-color: #3b82f6;
    }
    .recommendation-box.blue .recommendation-body { background: #eff6ff; }
    
    /* ============ LISTS ============ */
    ul, ol { margin: 0.05in 0 0.05in 0.2in; font-size: 10pt; }
    li { margin: 0.02in 0; }
    
    /* ============ EDITABLE SECTIONS ============ */
    .editable-section { min-height: 10px; }
    .editable-section:focus { outline: 2px dashed #3b82f6; background: #eff6ff; }
    
    /* ============ PAGE BREAKS ============ */
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
  
  <div class="cover-title-box">
    <div class="cover-title">RESERVE STUDY</div>
    {coverSubtitle}
    <div class="cover-and">&</div>
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
    <div>{companyAddress} {companyPhone}</div>
  </div>
</div>

<div class="page-break"></div>

<!-- ==================== TABLE OF CONTENTS ==================== -->
<div class="toc-page">
  <div class="toc-title">TABLE OF CONTENTS</div>
  
  <a href="#introduction" class="toc-section"><span>INTRODUCTION</span><span></span></a>
  <a href="#description" class="toc-section"><span>Description of Development</span><span></span></a>
  <a href="#reserve-chart" class="toc-section"><span>RESERVE STUDY CHART</span><span></span></a>
  <a href="#pm-fund-info" class="toc-section"><span>Preventive Maintenance Fund Information</span><span></span></a>
  <a href="#terms" class="toc-section"><span>TERMS AND DEFINITIONS</span><span></span></a>
  <a href="#responsible-charge" class="toc-section"><span>RESPONSIBLE CHARGE</span><span></span></a>
  <a href="#special-assessment" class="toc-section"><span>SPECIAL ASSESSMENT</span><span></span></a>
  <a href="#physical-analysis" class="toc-section"><span>PHYSICAL ANALYSIS</span><span></span></a>
  <a href="#component-summary" class="toc-section"><span>COMPONENT SCHEDULE SUMMARY</span><span></span></a>
  <a href="#capital-items" class="toc-section"><span>CAPITAL ITEMS / COMPONENTS</span><span></span></a>
  <a href="#component-notes" class="toc-section"><span>COMPONENTS NOTES</span><span></span></a>
  <a href="#financial-results" class="toc-section"><span>FINANCIAL RESULTS</span><span></span></a>
  <a href="#cash-flow" class="toc-section"><span>RESERVE FUND THIRTY YEAR CASH FLOW</span><span></span></a>
  <a href="#threshold" class="toc-section"><span>RESERVE FUND THIRTY YEAR THRESHOLD FUNDING</span><span></span></a>
  <a href="#expenditures" class="toc-section"><span>RESERVE FUND EXPENDITURES</span><span></span></a>
  <a href="#pm-section" class="toc-section"><span>PREVENTIVE MAINTENANCE</span><span></span></a>
  <a href="#pm-cash-flow" class="toc-section"><span>PM THIRTY YEAR CASH FLOW</span><span></span></a>
  <a href="#pm-expenditures" class="toc-section"><span>PM EXPENDITURES</span><span></span></a>
  <a href="#recommendations" class="toc-section"><span>RECOMMENDATIONS</span><span></span></a>
  <a href="#disclosures" class="toc-section"><span>DISCLOSURES</span><span></span></a>
  <a href="#bibliography" class="toc-section"><span>BIBLIOGRAPHY</span><span></span></a>
</div>

<div class="page-break"></div>

<!-- ==================== INTRODUCTION ==================== -->
<div id="introduction" class="section-header">INTRODUCTION</div>

<div class="content-section">
  <div class="sub-header">Financial Planning</div>
  <div class="editable-section">
    <p>One of the key responsibilities of the Board of Trustees or Directors is to ensure that the property is properly protected and maintained. Effective financial planning and budgeting are essential to maintaining the property and ensuring that sufficient funds are available to meet ongoing and future needs.</p>
    <p>The main objective of capital reserve planning is to ensure adequate funding for the future replacement of capital components within the community. Thoughtful planning helps distribute the cost of these projects evenly over time among owners, ensuring funds are available when needed. A well-funded reserve reduces the likelihood of significant fee increases, special assessments, or the need for loans.</p>
  </div>
  
  <div class="sub-header">Capital Reserve Study</div>
  <div class="editable-section">
    <p>A Capital Reserve Study serves as a financial planning tool that estimates the amount of money the Community Association should set aside for the future replacement of common area components. This report has been developed in accordance with the Community Associations Institute (CAI) National Reserve Study Standards. It provides guidance in evaluating and establishing a stable reserve funding strategy for anticipated repairs and replacements.</p>
  </div>
  
  <div class="sub-header">Level of Service Provided</div>
  <div class="editable-section">
    {levelOfServiceText}
  </div>
</div>

<!-- ==================== DESCRIPTION ==================== -->
<div id="description" class="section-header">DESCRIPTION OF DEVELOPMENT</div>

<div class="content-section">
  <div class="editable-section">
    <p>{projectName} consists of a {buildingType} comprising {totalUnits} residential units. The community is located in {projectLocation}.</p>
    <p>Residents access the building through both front and rear entrance stoops. Additional common areas within the community include the front sidewalk, front paver walkway, fencing, exterior building and landscape lighting, the building's exterior, interior hallways and lobbies, as well as the common area HVAC system and domestic hot water infrastructure.</p>
  </div>
</div>

<!-- ==================== RESERVE STUDY CHART ==================== -->
<div id="reserve-chart" class="section-header">RESERVE STUDY CHART</div>

<div class="content-section">
  <div class="summary-cards">
    <div class="summary-card">
      <div class="summary-card-header reserve">💰 Reserve Fund</div>
      <div class="summary-card-body">
        <div class="summary-item">
          <div class="summary-label">Percent Funded</div>
          <div class="summary-value">{percentFunded}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Current Balance</div>
          <div class="summary-value">{beginningReserveBalance}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Current Contribution</div>
          <div class="summary-value">{currentAnnualContribution}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Recommended</div>
          <div class="summary-value highlight">{recommendedAnnualFunding}</div>
        </div>
      </div>
    </div>
    <div class="summary-card">
      <div class="summary-card-header pm">🟢 PM Fund</div>
      <div class="summary-card-body">
        <div class="summary-item">
          <div class="summary-label">Percent Funded</div>
          <div class="summary-value">{pmPercentFunded}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Current Balance</div>
          <div class="summary-value">{pmBeginningBalance}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Current Contribution</div>
          <div class="summary-value">{pmCurrentContribution}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Recommended</div>
          <div class="summary-value highlight">{pmRecommendedFunding}</div>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- ==================== PM FUND INFO ==================== -->
<div id="pm-fund-info" class="section-header section-header-green">PREVENTIVE MAINTENANCE FUND INFORMATION</div>

<div class="content-section">
  <table>
    <tr><td style="width:60%;"><strong>Beginning Preventive Maintenance Balance:</strong></td><td class="text-right text-bold" style="font-size:11pt;">{pmBeginningBalance}</td></tr>
    <tr><td><strong>Current Annual Contribution:</strong></td><td class="text-right text-bold" style="font-size:11pt;">{pmCurrentContribution}</td></tr>
    <tr><td><strong>Current Percent Funded:</strong></td><td class="text-right text-bold" style="font-size:11pt;">{pmPercentFunded}</td></tr>
    <tr><td><strong>Recommended Annual Funding:</strong></td><td class="text-right text-bold" style="font-size:11pt; color:#22c55e;">{pmRecommendedFunding}</td></tr>
    <tr><td><strong>Averaging Length in Years:</strong></td><td class="text-right text-bold" style="font-size:11pt;">30</td></tr>
  </table>
</div>

<!-- ==================== TERMS ==================== -->
<div id="terms" class="section-header">TERMS AND DEFINITIONS</div>

<div class="content-section">
  <div class="editable-section">
    <p><strong>Capital Improvements</strong> - Additions to the association's common elements that were not previously part of the community.</p>
    <p><strong>Cash Flow Method</strong> - A method of creating a reserve funding plan in which contributions are structured to align with projected, fluctuating annual reserve expenditures.</p>
    <p><strong>Component</strong> - Individual items listed in the reserve study as identified through the physical analysis.</p>
    <p><strong>Fully Funded Balance (FFB)</strong> - An ideal benchmark reserve balance. Formula: FFB = Current Cost × (Effective Age ÷ Useful Life)</p>
    <p><strong>Percent Funded</strong> - The ratio of the actual reserve balance to the fully funded balance.</p>
    <p><strong>Remaining Useful Life (RUL)</strong> - The estimated number of years a component will continue to function before replacement.</p>
    <p><strong>Useful Life (UL)</strong> - The total expected lifespan of a component from installation to replacement.</p>
    <p><strong>Replacement Cost</strong> - The total cost to repair, restore, or replace a component.</p>
    <p><strong>Funding Goals:</strong></p>
    <ul>
      <li><strong>Full Funding:</strong> Keep reserves at or near 100% funded.</li>
      <li><strong>Threshold Funding:</strong> Maintain reserves above a specific amount.</li>
      <li><strong>Baseline Funding:</strong> Ensure fund never drops below zero.</li>
    </ul>
  </div>
</div>

<div class="page-break"></div>

<!-- ==================== RESPONSIBLE CHARGE ==================== -->
<div id="responsible-charge" class="section-header">RESPONSIBLE CHARGE</div>

<div class="content-section">
  <div class="editable-section">
    <p>A <strong>Reserve Specialist (RS)</strong> who is in responsible charge of a reserve study must provide consistent and effective oversight of all individuals performing tasks that directly impact the quality and accuracy of the study.</p>
  </div>
</div>

<!-- ==================== SPECIAL ASSESSMENT ==================== -->
<div id="special-assessment" class="section-header">SPECIAL ASSESSMENT</div>

<div class="content-section">
  <div class="editable-section">
    <p>A <strong>Special Assessment</strong> is a temporary fee imposed on association members in addition to regular dues or assessments.</p>
  </div>
</div>

<!-- ==================== PHYSICAL ANALYSIS ==================== -->
<div id="physical-analysis" class="section-header">PHYSICAL ANALYSIS</div>

<div class="content-section">
  <div class="editable-section">
    <p>The quantities used in the replacement cost estimates of the common elements were generated from field measurements taken during our site visit on {inspectionDate}. Current replacement costs were estimated using published construction cost data referenced in the Bibliography section of this report.</p>
    <p>It is recommended that this reserve study be updated every three (3) to five (5) years.</p>
  </div>
</div>

<div class="page-break"></div>

<!-- ==================== COMPONENT SCHEDULE SUMMARY ==================== -->
<div id="component-summary" class="section-header">COMPONENT SCHEDULE SUMMARY</div>

<div class="content-section">
  <p style="font-size:7pt; color:#666; margin-bottom:8px;"><em>Useful Life = Total expected lifespan | Remaining Life = Years until replacement | PM = Preventive Maintenance | Note = Component Note Reference</em></p>
  {componentSummaryTable}
</div>

<div class="page-break"></div>

<!-- ==================== CAPITAL ITEMS ==================== -->
<div id="capital-items" class="section-header">CAPITAL ITEMS / COMPONENTS</div>

<div class="content-section">
  <div class="editable-section">
    <p>The following provides information on the location, condition, and replacement cost of the components. Review of the common elements was conducted by {companyName} on {inspectionDate}.</p>
  </div>
  {categorySections}
</div>

<div class="page-break"></div>

<!-- ==================== COMPONENT NOTES ==================== -->
<div id="component-notes" class="section-header">COMPONENTS NOTES</div>

<div class="content-section">
  <p style="font-size:8pt; margin-bottom:8px;"><em>*EA = Each, *LF = Linear Foot, *LS = Lump Sum, *SF = Square Feet, *SY = Square Yard, *SQ = Square</em></p>
  {componentNotesTable}
</div>

<div class="page-break"></div>

<!-- ==================== FINANCIAL RESULTS ==================== -->
<div id="financial-results" class="section-header">FINANCIAL RESULTS</div>

<div class="content-section">
  <div class="editable-section">
    <p>The primary goal of capital reserve planning is to provide adequate funding for the replacement of the capital components within the community.</p>
    <p><strong>Current Funding</strong> reflects the beginning balance with the current annual contribution added and projected expenses subtracted each year.</p>
    <p><strong>Full Funding</strong> represents the annual contribution and fund balances for each year as if each component were fully funded.</p>
  </div>
  
  <div class="recommendation-box blue">
    <div class="recommendation-header">📊 Reserve Study Funding Summary</div>
    <div class="recommendation-body">
      <ul>
        <li>Current Annual Contribution: <strong>{currentAnnualContribution}</strong></li>
        <li>Full Funding Annual Contribution for {beginningYear}: <strong>{fullFundingContribution}</strong></li>
        <li>Full Funding Average Annual Contribution: <strong>{averageAnnualContribution}</strong></li>
      </ul>
    </div>
  </div>
  
  <div class="recommendation-box green">
    <div class="recommendation-header">🟢 Preventive Maintenance Funding</div>
    <div class="recommendation-body">
      <ul>
        <li>Current Annual Contribution: <strong>{pmCurrentContribution}</strong></li>
        <li>Annual Full Funding Contribution: <strong>{pmRecommendedFunding}</strong></li>
      </ul>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- ==================== CASH FLOW ==================== -->
<div id="cash-flow" class="section-header">RESERVE FUND THIRTY YEAR CASH FLOW</div>

<div class="content-section">
  {reserveCashFlowTable}
</div>

<div class="page-break"></div>

<!-- ==================== THRESHOLD ==================== -->
<div id="threshold" class="section-header">RESERVE FUND THIRTY YEAR THRESHOLD FUNDING</div>

<div class="content-section">
  {thresholdProjectionTable}
</div>

<div class="page-break"></div>

<!-- ==================== EXPENDITURES ==================== -->
<div id="expenditures" class="section-header">RESERVE FUND EXPENDITURES</div>

<div class="content-section">
  {expenditureScheduleTable}
</div>

<div class="page-break"></div>

<!-- ==================== PM SECTION ==================== -->
<div id="pm-section" class="section-header section-header-green">PREVENTIVE MAINTENANCE</div>

<div class="content-section">
  <div class="sub-header">Component Schedule Summary</div>
  {pmComponentSummaryTable}
</div>

<div class="page-break"></div>

<!-- ==================== PM CASH FLOW ==================== -->
<div id="pm-cash-flow" class="section-header section-header-green">PM THIRTY YEAR CASH FLOW</div>

<div class="content-section">
  {pmCashFlowTable}
</div>

<div class="page-break"></div>

<!-- ==================== PM EXPENDITURES ==================== -->
<div id="pm-expenditures" class="section-header section-header-green">PM EXPENDITURES</div>

<div class="content-section">
  {pmExpenditureTable}
</div>

<div class="page-break"></div>

<!-- ==================== RECOMMENDATIONS ==================== -->
<div id="recommendations" class="section-header section-header-orange">RECOMMENDATIONS</div>

<div class="content-section">
  <div class="editable-section">
    <p>The following recommendations are based on our review of the community and information provided by the Association. {companyName} recommends the following:</p>
  </div>
  
  <div class="recommendation-box">
    <div class="recommendation-header">💰 Financial Recommendation - RESERVE FUNDING</div>
    <div class="recommendation-body">
      <div class="editable-section">
        <p>The current annual contribution of {currentAnnualContribution} is {fundingAssessment}.</p>
        <p>{companyName} recommends {fundingRecommendation} as shown on the Reserve Study Funding Plan.</p>
      </div>
    </div>
  </div>
  
  <div class="recommendation-box green">
    <div class="recommendation-header">🟢 Preventive Maintenance Funding</div>
    <div class="recommendation-body">
      <p>Current Annual Contribution: <strong>{pmCurrentContribution}</strong><br>
      Recommended: <strong>{pmRecommendedFunding}</strong></p>
    </div>
  </div>
  
  <div class="recommendation-box blue">
    <div class="recommendation-header">📅 Updating the Reserve Study</div>
    <div class="recommendation-body">
      <p>{companyName} recommends updating the reserve study <strong>Every Three (3) Years</strong>.</p>
      <p>New Jersey Law requires updates at a Maximum of <strong>Every Five (5) Years</strong>.</p>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- ==================== DISCLOSURES ==================== -->
<div id="disclosures" class="section-header">DISCLOSURES</div>

<div class="content-section">
  <div class="editable-section">
    <p>{companyName} is not aware of any conflicts of interest that would influence this study.</p>
    <p>Physical observations were cursory and included only accessible common elements.</p>
    <p>This study was prepared by {preparedBy}, {companyName}.</p>
    <p>The Reserve Study reflects information provided and was not audited.</p>
  </div>
</div>

<!-- ==================== BIBLIOGRAPHY ==================== -->
<div id="bibliography" class="section-header">BIBLIOGRAPHY</div>

<div class="content-section">
  <div class="editable-section">
    <ol>
      <li>Master Deed of {projectName}</li>
      <li>Best Practices for Reserve Studies/Management - Foundation for Community Association Research, 2023</li>
      <li>National Reserve Study Standards - Community Associations Institute, 2023</li>
      <li>Cost Works - R.S. Means Company, 2025</li>
      <li>New Jersey Reserve Study Law (NJ Senate Bill S2760/A4384), 2024</li>
    </ol>
  </div>
</div>

<!-- ==================== PAGE FOOTER (appears on every page when printed) ==================== -->
<div class="page-footer">
  <span class="company-name">{companyName}</span><br>
  {companyFullAddress} • {companyPhone}
</div>

</body>
</html>
`;

export default DEFAULT_REPORT_TEMPLATE;
