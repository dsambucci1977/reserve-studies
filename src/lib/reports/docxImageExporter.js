// src/lib/reports/docxImageExporter.js
// Captures rendered report HTML sections as images and embeds them in a real .docx.
// Preserves exact visual fidelity — cards, colored tables, everything looks like the app.
// Footer and page numbers are native Word elements.

import {
  Document, Packer, Paragraph, TextRun, ImageRun,
  Footer, Header, PageNumber, PageBreak,
  AlignmentType, BorderStyle
} from 'docx';
import html2canvas from 'html2canvas';

const GRAY = '666666';

// ============================================================
// CONSTANTS for page sizing
// ============================================================
const RENDER_WIDTH = 750;         // px - width of hidden render container
const CAPTURE_SCALE = 2;          // 2x for crisp text
const CAPTURE_WIDTH = RENDER_WIDTH * CAPTURE_SCALE; // 1500px
const DISPLAY_WIDTH_PT = 468;     // 6.5 inches in points (72pt/in)
const MAX_PAGE_HEIGHT_PT = 660;   // ~9.17" content area (11" - margins - footer)
// Max capture height before we slice into a new page:
const MAX_SLICE_HEIGHT = Math.floor(MAX_PAGE_HEIGHT_PT * (CAPTURE_WIDTH / DISPLAY_WIDTH_PT)); // ~2115px

/**
 * Slice a tall canvas image into page-sized PNG strips.
 * Returns array of { data: Uint8Array, width, height }
 */
async function sliceImage(imgData, imgWidth, imgHeight) {
  const slices = [];
  let y = 0;
  
  while (y < imgHeight) {
    const sliceH = Math.min(MAX_SLICE_HEIGHT, imgHeight - y);
    
    const canvas = document.createElement('canvas');
    canvas.width = imgWidth;
    canvas.height = sliceH;
    const ctx = canvas.getContext('2d');
    
    // Create temp image from source data
    const tempImg = await createImageFromData(imgData);
    ctx.drawImage(tempImg, 0, y, imgWidth, sliceH, 0, 0, imgWidth, sliceH);
    
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png', 0.92));
    if (blob) {
      const buf = await blob.arrayBuffer();
      slices.push({
        data: new Uint8Array(buf),
        width: imgWidth,
        height: sliceH,
      });
    }
    y += sliceH;
  }
  
  return slices;
}

/**
 * Create an HTMLImageElement from Uint8Array PNG data
 */
function createImageFromData(uint8Data) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([uint8Data], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

/**
 * Capture an HTML element as a PNG Uint8Array
 */
async function captureElement(element) {
  const canvas = await html2canvas(element, {
    width: RENDER_WIDTH,
    scale: CAPTURE_SCALE,
    backgroundColor: '#ffffff',
    useCORS: true,
    allowTaint: true,
    logging: false,
    removeContainer: false,
  });
  
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png', 0.92));
  if (!blob) return null;
  
  const buf = await blob.arrayBuffer();
  return {
    data: new Uint8Array(buf),
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Main export function.
 * @param {string} htmlContent - Full report HTML (from report generation)
 * @param {string} fileName - Output filename
 * @param {Object} options - { companyName, companyAddress, companyPhone }
 * @param {function} onProgress - Optional callback(message) for progress updates
 */
export async function exportToDocxWithImages(htmlContent, fileName, options = {}, onProgress) {
  const { companyName = '', companyAddress = '', companyPhone = '' } = options;
  const footerParts = [companyName, companyAddress, companyPhone].filter(Boolean);
  const footerText = footerParts.join(' | ');
  
  const progress = (msg) => {
    console.log('[docx-export]', msg);
    if (onProgress) onProgress(msg);
  };

  // ============================================================
  // 1. RENDER HTML IN HIDDEN CONTAINER
  // ============================================================
  progress('Rendering report...');
  
  const container = document.createElement('div');
  container.id = 'docx-export-container';
  container.style.cssText = `
    position: fixed;
    left: -10000px;
    top: 0;
    width: ${RENDER_WIDTH}px;
    background: white;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    line-height: 1.4;
    color: #1a1a1a;
    z-index: -9999;
    overflow: visible;
  `;

  // Extract body content if wrapped in full HTML doc
  let bodyHTML = htmlContent;
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) bodyHTML = bodyMatch[1];

  // Extract and apply <style> blocks
  const styleBlocks = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
  let styleHTML = '';
  if (styleBlocks) {
    styleHTML = styleBlocks.join('\n');
  }

  container.innerHTML = styleHTML + bodyHTML;
  document.body.appendChild(container);

  // Wait for images to load
  const imgs = container.querySelectorAll('img');
  if (imgs.length > 0) {
    await Promise.allSettled(
      Array.from(imgs).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
          setTimeout(resolve, 3000);
        });
      })
    );
  }

  // Wait for layout
  await new Promise(r => setTimeout(r, 500));

  // ============================================================
  // 2. SPLIT INTO SECTIONS AT PAGE BREAKS
  // ============================================================
  progress('Splitting pages...');
  
  // Remove no-print elements
  container.querySelectorAll('.page-break-indicator, .no-print').forEach(el => el.remove());

  // Split at .page-break elements
  const sections = [];
  const allTopLevel = Array.from(container.children);
  let currentSection = document.createElement('div');
  currentSection.style.cssText = `width:${RENDER_WIDTH}px; padding:30px 40px; background:white; font-family:Arial,Helvetica,sans-serif; font-size:10pt; line-height:1.4; color:#1a1a1a;`;

  for (const child of allTopLevel) {
    // Skip style elements
    if (child.tagName === 'STYLE') continue;
    
    if (child.classList && child.classList.contains('page-break')) {
      if (currentSection.children.length > 0 || currentSection.textContent.trim()) {
        sections.push(currentSection);
      }
      currentSection = document.createElement('div');
      currentSection.style.cssText = `width:${RENDER_WIDTH}px; padding:30px 40px; background:white; font-family:Arial,Helvetica,sans-serif; font-size:10pt; line-height:1.4; color:#1a1a1a;`;
    } else {
      currentSection.appendChild(child.cloneNode(true));
    }
  }
  // Last section
  if (currentSection.children.length > 0 || currentSection.textContent.trim()) {
    sections.push(currentSection);
  }

  progress(`Found ${sections.length} sections`);

  // ============================================================
  // 3. CAPTURE EACH SECTION AS IMAGE(S)
  // ============================================================
  // We'll capture each section, then slice tall ones into page-sized strips
  const allPageImages = []; // Array of { data, width, height, isCover }
  
  // Create a capture host element
  const captureHost = document.createElement('div');
  captureHost.style.cssText = `position:fixed; left:-10000px; top:0; width:${RENDER_WIDTH}px; background:white; z-index:-9999;`;
  document.body.appendChild(captureHost);

  for (let i = 0; i < sections.length; i++) {
    progress(`Capturing section ${i + 1} of ${sections.length}...`);
    
    // Clear host and add this section
    captureHost.innerHTML = '';
    if (styleHTML) {
      const styleDiv = document.createElement('div');
      styleDiv.innerHTML = styleHTML;
      captureHost.appendChild(styleDiv);
    }
    captureHost.appendChild(sections[i]);
    
    await new Promise(r => setTimeout(r, 150));
    
    try {
      const captured = await captureElement(sections[i]);
      if (!captured) continue;
      
      // Slice if too tall
      if (captured.height > MAX_SLICE_HEIGHT) {
        progress(`  Section ${i + 1} is tall (${captured.height}px), slicing...`);
        const slices = await sliceImage(captured.data, captured.width, captured.height);
        slices.forEach((s, j) => {
          allPageImages.push({ ...s, isCover: i === 0 && j === 0 });
        });
      } else {
        allPageImages.push({ ...captured, isCover: i === 0 });
      }
    } catch (err) {
      console.warn(`Failed to capture section ${i + 1}:`, err);
    }
  }

  // Cleanup DOM
  document.body.removeChild(container);
  document.body.removeChild(captureHost);

  if (allPageImages.length === 0) {
    throw new Error('No pages were captured. Report may be empty.');
  }

  progress(`Captured ${allPageImages.length} page images, building .docx...`);

  // ============================================================
  // 4. BUILD DOCX
  // ============================================================
  // Cover page footer (company name + address, no page number)
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
          new TextRun({ text: `${companyAddress} ${companyPhone}`.trim(), size: 18, color: GRAY, font: 'Arial' }),
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

  // Convert page images to docx paragraphs
  function imgParagraph(img) {
    const aspectRatio = img.height / img.width;
    const widthPt = DISPLAY_WIDTH_PT;
    const heightPt = Math.round(widthPt * aspectRatio);
    
    return new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [
        new ImageRun({
          data: img.data,
          transformation: { width: widthPt, height: heightPt },
          type: 'png',
        })
      ]
    });
  }

  const docSections = [];

  // Cover page section (first image only)
  docSections.push({
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 360, bottom: 720, left: 720, right: 720 },
      },
    },
    footers: { default: coverFooter },
    children: [imgParagraph(allPageImages[0])],
  });

  // Main content section (all remaining images)
  if (allPageImages.length > 1) {
    const mainChildren = [];
    
    for (let i = 1; i < allPageImages.length; i++) {
      if (i > 1) {
        mainChildren.push(new Paragraph({ children: [new PageBreak()] }));
      }
      mainChildren.push(imgParagraph(allPageImages[i]));
    }

    docSections.push({
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 360, bottom: 900, left: 720, right: 720 },
          pageNumbers: { start: 2 },
        },
      },
      footers: { default: mainFooter },
      children: mainChildren,
    });
  }

  const doc = new Document({ sections: docSections });

  // Generate and trigger download
  progress('Generating file...');
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.docx') ? fileName : fileName.replace(/\.doc$/, '.docx');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  progress('Done!');
}
