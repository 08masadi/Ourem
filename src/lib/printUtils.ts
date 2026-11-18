'use client';

import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

/**
 * Print an element directly to A5 Landscape without printing modal UI, scrollbars, or multiple blank pages.
 * Creates an isolated hidden iframe with the exact A5 landscape CSS and only the printable content.
 */
export function printVoucherDocument(element: HTMLElement | null, documentTitle: string) {
  if (!element || typeof window === 'undefined') return;

  // Remove any leftover print iframes
  const existingIframe = document.getElementById('ourem-print-frame');
  if (existingIframe) {
    existingIframe.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'ourem-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.title = documentTitle;

  // Clone head styles and links
  const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
  styles.forEach((style) => {
    doc.head.appendChild(style.cloneNode(true));
  });

  // Inject exact A5 Landscape print styles
  const printStyle = doc.createElement('style');
  printStyle.textContent = `
    @page {
      size: A5 landscape;
      margin: 4mm;
    }
    * {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      width: 100% !important;
      height: 100% !important;
      overflow: visible !important;
    }
    .printable-sheet {
      box-shadow: none !important;
      margin: 0 auto !important;
      width: 100% !important;
      max-width: 100% !important;
      border: 2px solid #1E3A8A !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
  `;
  doc.head.appendChild(printStyle);

  // Clone printable content
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.boxShadow = 'none';
  clone.style.margin = '0 auto';
  clone.style.width = '100%';
  clone.style.maxWidth = '100%';
  doc.body.appendChild(clone);

  // Ensure all images are loaded before printing
  const images = doc.querySelectorAll('img');
  let loadedCount = 0;
  const totalImages = images.length;

  const performPrint = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Print iframe error:', err);
        window.print();
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 1500);
      }
    }, 200);
  };

  if (totalImages === 0) {
    performPrint();
  } else {
    images.forEach((img) => {
      if (img.complete) {
        loadedCount++;
        if (loadedCount >= totalImages) performPrint();
      } else {
        img.onload = () => {
          loadedCount++;
          if (loadedCount >= totalImages) performPrint();
        };
        img.onerror = () => {
          loadedCount++;
          if (loadedCount >= totalImages) performPrint();
        };
      }
    });
    // Fallback timer if any image stalls
    setTimeout(performPrint, 1200);
  }
}

/**
 * Download element as A5 Landscape PDF using html-to-image and jsPDF.
 * html-to-image is immune to modern Tailwind v4 color issues (color-mix, oklch) unlike html2canvas.
 */
export async function downloadVoucherPdf(
  element: HTMLElement | null,
  fileName: string,
  setLoading?: (loading: boolean) => void
) {
  if (!element || typeof window === 'undefined') return;

  if (setLoading) setLoading(true);

  try {
    // Generate crisp PNG image using browser's native SVG foreignObject rendering
    const imgData = await toPng(element, {
      quality: 0.98,
      pixelRatio: 2.2,
      backgroundColor: '#ffffff',
      cacheBust: true,
      skipFonts: false,
    });

    // Create jsPDF document with A5 Landscape
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a5', // 210mm x 148mm
      compress: true,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth(); // 210
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 148

    // Fit image exactly into A5 Landscape sheet
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    pdf.save(fileName);
  } catch (error) {
    console.error('Gagal generate PDF dengan toPng:', error);

    // Fallback: If foreignObject rendering encounters CORS security restrictions on external images,
    // trigger print dialog where user can save as PDF directly.
    printVoucherDocument(element, fileName.replace('.pdf', ''));
  } finally {
    if (setLoading) setLoading(false);
  }
}
