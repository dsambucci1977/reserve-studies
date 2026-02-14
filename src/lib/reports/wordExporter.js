// src/lib/reports/wordExporter.js
// Converts report HTML to Word-compatible .doc and triggers download
// Uses DOM-based transformation to handle CSS Grid, Flexbox, gradients etc.

export async function exportToWord(htmlContent, fileName, options = {}) {
  const { companyName, companyAddress, companyPhone } = options;
  // Extract body content if it's a full HTML document
  let bodyContent = htmlContent;
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    bodyContent = bodyMatch[1];
  } else {
    bodyContent = htmlContent
      .replace(/<!DOCTYPE[^>]*>/gi, '')
      .replace(/<html[^>]*>/gi, '')
      .replace(/<\/html>/gi, '')
      .replace(/<head[\s\S]*?<\/head>/gi, '');
  }
  
  // ============================================================
  // DOM-BASED TRANSFORMATION
  // ============================================================
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = bodyContent;
  
  // 1. Strip editor-only elements
  tempDiv.querySelectorAll('.page-break-indicator, .no-print').forEach(el => el.remove());
  
  // 2. Mark page-break divs with a data attribute for post-DOM string replacement
  //    CRITICAL: Cannot set page-break-before via DOM because the browser normalizes
  //    it to 'break-before:page' in innerHTML output, and Word ignores that.
  //    We mark them here, then do string replacement after getting innerHTML.
  tempDiv.querySelectorAll('.page-break').forEach(el => {
    const marker = document.createElement('div');
    marker.setAttribute('data-word-page-break', 'true');
    el.parentNode.replaceChild(marker, el);
  });
  
  // 3. Unwrap page-container divs (keep children)
  tempDiv.querySelectorAll('.page-container').forEach(el => {
    while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
    el.remove();
  });
  
  // 4. Convert .summary-cards grid → HTML table (side-by-side cards)
  tempDiv.querySelectorAll('.summary-cards').forEach(grid => {
    const cards = grid.querySelectorAll('.summary-card');
    if (cards.length === 0) return;
    const table = document.createElement('table');
    table.setAttribute('width', '100%');
    table.setAttribute('cellpadding', '0');
    table.setAttribute('cellspacing', '8');
    table.style.cssText = 'border-collapse: separate; border-spacing: 8px; margin: 8px 0;';
    const row = document.createElement('tr');
    cards.forEach(card => {
      const td = document.createElement('td');
      td.setAttribute('width', Math.floor(100 / cards.length) + '%');
      td.setAttribute('valign', 'top');
      td.style.cssText = 'border: 2px solid #e0e0e0; padding: 0; vertical-align: top;';
      td.innerHTML = card.innerHTML;
      row.appendChild(td);
    });
    table.appendChild(row);
    grid.parentNode.replaceChild(table, grid);
  });
  
  // 5. Single-card grids
  tempDiv.querySelectorAll('.summary-cards-single').forEach(grid => {
    const cards = grid.querySelectorAll('.summary-card');
    if (cards.length === 0) return;
    const table = document.createElement('table');
    table.setAttribute('width', '50%');
    table.setAttribute('cellpadding', '0');
    table.setAttribute('cellspacing', '0');
    table.style.cssText = 'border: 2px solid #e0e0e0; margin: 8px 0;';
    const row = document.createElement('tr');
    const td = document.createElement('td');
    td.style.cssText = 'padding: 0;';
    td.innerHTML = cards[0].innerHTML;
    row.appendChild(td);
    table.appendChild(row);
    grid.parentNode.replaceChild(table, grid);
  });
  
  // 6. Convert .summary-card-body grid → 2x2 table
  tempDiv.querySelectorAll('.summary-card-body').forEach(body => {
    const items = body.querySelectorAll('.summary-item');
    if (items.length === 0) return;
    const table = document.createElement('table');
    table.setAttribute('width', '100%');
    table.setAttribute('cellpadding', '4');
    table.setAttribute('cellspacing', '0');
    table.style.cssText = 'border-collapse: collapse;';
    for (let i = 0; i < items.length; i += 2) {
      const row = document.createElement('tr');
      for (let j = 0; j < 2 && (i + j) < items.length; j++) {
        const item = items[i + j];
        const td = document.createElement('td');
        td.setAttribute('width', '50%');
        td.style.cssText = 'padding: 4px 8px; border-bottom: 1px solid #eee;';
        const label = item.querySelector('.summary-label');
        const value = item.querySelector('.summary-value');
        if (label && value) {
          const isHighlight = value.classList.contains('highlight');
          td.innerHTML = `<div style="font-size:7pt;color:#666;">${label.textContent}</div><div style="font-size:12pt;font-weight:bold;${isHighlight ? 'color:#c55a11;' : ''}">${value.textContent}</div>`;
        } else {
          td.innerHTML = item.innerHTML;
        }
        row.appendChild(td);
      }
      table.appendChild(row);
    }
    body.parentNode.replaceChild(table, body);
  });
  
  // 7. Card headers (replace gradient with solid color)
  tempDiv.querySelectorAll('.summary-card-header').forEach(header => {
    if (header.classList.contains('reserve')) {
      header.style.cssText = 'background-color: #dbeafe; color: #1e40af; padding: 6px 8px; font-weight: bold; font-size: 9pt; text-align: center; border-bottom: 2px solid #3b82f6;';
    } else if (header.classList.contains('pm')) {
      header.style.cssText = 'background-color: #dcfce7; color: #166534; padding: 6px 8px; font-weight: bold; font-size: 9pt; text-align: center; border-bottom: 2px solid #22c55e;';
    }
  });
  
  // 8. Recommendation boxes
  tempDiv.querySelectorAll('.recommendation-header').forEach(header => {
    header.style.cssText = (header.style.cssText || '') + 'background-color: #fef3e8; color: #c55a11; padding: 5px 8px; font-weight: bold; border-bottom: 1px solid #c55a11;';
  });
  
  // 9. Alternating row backgrounds (Word ignores :nth-child)
  tempDiv.querySelectorAll('table').forEach(table => {
    const rows = table.querySelectorAll('tr');
    rows.forEach((row, i) => {
      if (i > 0 && i % 2 === 0 && !row.classList.contains('total-row')) {
        if (!row.style.background && !row.style.backgroundColor) {
          row.style.backgroundColor = '#f8f9fa';
        }
      }
    });
  });
  
  // 10. Section headers
  tempDiv.querySelectorAll('.section-header').forEach(header => {
    const isGreen = header.classList.contains('section-header-green');
    const bg = isGreen ? '#166534' : '#1e3a5f';
    header.style.cssText = `background-color:${bg}; color:white; padding:8px 12px; font-size:12pt; font-weight:bold; letter-spacing:1px; margin:16px 0 0 0;`;
  });
  
  // 11. Sub-headers
  tempDiv.querySelectorAll('.sub-header').forEach(header => {
    header.style.cssText = 'font-size:10pt; font-weight:bold; color:#1e3a5f; border-bottom:1px solid #3b82f6; padding-bottom:3px; margin:12px 0 6px 0;';
  });
  
  // 12. Content sections
  tempDiv.querySelectorAll('.content-section').forEach(section => {
    section.style.cssText = 'padding: 8px 4px; margin-bottom: 8px;';
  });
  
  // 13. Cover page
  tempDiv.querySelectorAll('.cover-page').forEach(cover => {
    cover.style.cssText = 'text-align:center; padding:48px 72px; min-height:700px;';
  });
  tempDiv.querySelectorAll('.cover-project-name').forEach(el => {
    el.style.cssText = 'font-size:26pt; font-weight:bold; color:#1e3a5f; margin:24px 0;';
  });
  tempDiv.querySelectorAll('.cover-title').forEach(el => {
    el.style.cssText = 'font-size:18pt; font-weight:bold; letter-spacing:2px; margin:4px 0;';
  });
  tempDiv.querySelectorAll('.cover-title-highlight').forEach(el => {
    el.style.cssText = 'font-size:18pt; font-weight:bold; letter-spacing:2px; background-color:#e07020; color:white; padding:3px 12px; margin:4px 0; display:inline-block;';
  });
  tempDiv.querySelectorAll('.cover-prepared').forEach(el => {
    el.style.cssText = 'margin-top:36px; font-size:11pt;';
  });
  tempDiv.querySelectorAll('.cover-footer').forEach(el => {
    el.style.cssText = 'margin-top:48px; font-size:9pt; color:#666;';
  });
  tempDiv.querySelectorAll('.cover-logo img').forEach(img => {
    img.style.cssText = 'max-width:300px; max-height:100px;';
  });
  
  // 14. Remove in-content page footers (Word footer handles page numbering)
  tempDiv.querySelectorAll('.page-footer').forEach(footer => {
    footer.remove();
  });
  
  // 15. Table of Contents - style cells, keep links functional
  tempDiv.querySelectorAll('.toc-page').forEach(el => {
    el.style.cssText = 'padding: 16px;';
  });
  tempDiv.querySelectorAll('.toc-title').forEach(el => {
    el.style.cssText = 'font-size:16pt; font-weight:bold; color:#1e3a5f; text-align:center; margin-bottom:16px; padding-bottom:8px; border-bottom:2px solid #1e3a5f;';
  });
  // Style TOC table cells - remove borders, keep links
  tempDiv.querySelectorAll('.toc-table td').forEach(td => {
    // Preserve existing inline styles but ensure no visible border
    const existing = td.getAttribute('style') || '';
    if (!existing.includes('border-bottom:1px dotted')) {
      td.style.cssText = existing + ' border:none;';
    } else {
      td.style.cssText = existing.replace(/border:1px solid #ddd;?/g, '');
    }
  });
  // Mark toc-pageref spans for string replacement (PAGEREF field codes)
  tempDiv.querySelectorAll('.toc-pageref').forEach(span => {
    span.setAttribute('data-word-pageref', span.getAttribute('data-ref') || '');
  });
  
  // 16. Strip border-radius from all inline styles (Word doesn't support it)
  tempDiv.querySelectorAll('[style]').forEach(el => {
    if (el.style.cssText.includes('border-radius')) {
      el.style.cssText = el.style.cssText.replace(/border-radius\s*:\s*[^;]+;?/g, '');
    }
  });
  
  // Get the transformed HTML
  bodyContent = tempDiv.innerHTML;
  
  // Replace page break markers with Word-compatible page breaks
  // (done as string replacement to avoid browser CSS normalization)
  bodyContent = bodyContent.replace(
    /<div data-word-page-break="true"><\/div>/g,
    '<p style="page-break-before:always; margin:0; padding:0; line-height:0; font-size:1pt;">&nbsp;</p>'
  );
  
  // Replace PAGEREF markers with Word field codes for TOC page numbers
  // Pattern: <span class="toc-pageref" data-ref="xxx" data-word-pageref="xxx">fallback</span>
  bodyContent = bodyContent.replace(
    /<span[^>]*data-word-pageref="([^"]*)"[^>]*>(\d+)<\/span>/g,
    '<span style=\'mso-field-code:" PAGEREF $1 \\\\h"\'>$2</span>'
  );
  
  // ============================================================
  // CONVERT IMAGES TO BASE64
  // ============================================================
  const imgRegex = /<img[^>]+src="(https?:\/\/[^"]+)"[^>]*>/gi;
  const imgMatches = [...bodyContent.matchAll(imgRegex)];
  for (const match of imgMatches) {
    try {
      const response = await fetch(match[1]);
      const blob = await response.blob();
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      bodyContent = bodyContent.replace(match[1], base64);
    } catch (e) {
      console.warn('Could not embed image:', match[1], e);
    }
  }
  
  // Build footer text from company info
  const footerParts = [companyName, companyAddress, companyPhone].filter(Boolean);
  const footerLine = footerParts.length > 1 
    ? `<b style='color:#1e3a5f;'>${companyName || ''}</b> | ${footerParts.slice(1).join(' | ')}`
    : `<b style='color:#1e3a5f;'>${companyName || ''}</b>`;
  
  // Fix TOC links to match bookmark names
  // Template TOC uses href="#introduction" but bookmarks are name="_introduction"
  // Convert all TOC anchor hrefs to match bookmark naming convention
  bodyContent = bodyContent.replace(
    /href="#([^"]+)"/g,
    (match, id) => {
      // Convert kebab-case to bookmark style: reserve-chart -> _reservechart
      const bookmarkName = '_' + id.replace(/-/g, '');
      return `href="#${bookmarkName}"`;
    }
  );
  
  // ============================================================
  // BUILD WORD-COMPATIBLE DOCUMENT  
  // ============================================================
  // Single section approach with mso-title-page:yes to suppress footer on page 1.
  // Footer div MUST be outside conditional comments for Word to recognize
  // mso-element:footer attribute. It won't render visually in body because
  // Word intercepts elements with mso-element and moves them to the footer area.
  const wordDoc = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:w="urn:schemas-microsoft-com:office:word"
    xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
  @page WordSection1 {
    size: 8.5in 11.0in;
    mso-page-orientation: portrait;
    margin: 0.75in 0.75in 1.0in 0.75in;
    mso-header-margin: 0.3in;
    mso-footer-margin: 0.5in;
    mso-title-page: yes;
    mso-footer: f1;
  }
  div.WordSection1 { page: WordSection1; }
  body { 
    font-family: Arial, Helvetica, sans-serif; 
    font-size: 10pt; 
    line-height: 1.4;
    color: #1a1a1a;
  }
  p { margin: 4pt 0; }
  table { 
    width: 100%; 
    border-collapse: collapse; 
    margin: 6px 0;
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
  .table-green th { background: #166534; color: white; border: 1px solid #166534; }
  .table-teal th { background: #0f766e; color: white; border: 1px solid #0f766e; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .text-bold { font-weight: bold; }
  .total-row { background: #d9d9d9; font-weight: bold; }
  .negative { color: #dc2626; font-weight: bold; }
  .component-table { font-size: 7pt; }
  .component-table th { padding: 3px 2px; font-size: 6pt; }
  .component-table td { padding: 2px; }
  .cashflow-table { font-size: 7pt; }
  .cashflow-table th { padding: 3px 2px; font-size: 6pt; }
  .cashflow-table td { padding: 2px 3px; text-align: right; }
  .cashflow-table-green th { background: #166534; color: white; border: 1px solid #166534; }
  .expenditure-horizontal { font-size: 8pt; }
  .expenditure-table-green th { background: #166534; color: white; border: 1px solid #166534; }
</style>
</head>
<body>
<div style='mso-element:footer' id=f1>
  <p style='text-align:center; font-size:7pt; color:#666; font-family:Arial,sans-serif; border-top:1px solid #ccc; padding-top:4px;'>
    ${footerLine} &nbsp;&nbsp;|&nbsp;&nbsp; Page <span style='mso-field-code:" PAGE "'>1</span>
  </p>
</div>
<div class="WordSection1">
${bodyContent}
</div>
</body>
</html>`;
  
  // Trigger download
  const docBlob = new Blob([wordDoc], { type: 'application/msword' });
  const url = URL.createObjectURL(docBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
