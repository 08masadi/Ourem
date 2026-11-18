'use client';

import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

/**
 * Print an element directly to A5 Landscape without printing modal UI, scrollbars, or multiple blank pages.
 * Creates an isolated offscreen iframe with the exact A5 landscape CSS and only the printable content.
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
  // Position offscreen so browser paints it, but user doesn't see it
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';
  iframe.style.width = '210mm';
  iframe.style.height = '148mm';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  // Collect head styles and links from host document
  let stylesHtml = '';
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((style) => {
    stylesHtml += style.outerHTML;
  });

  const printStyles = `
    <style>
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
        height: auto !important;
        display: block !important;
        visibility: visible !important;
        overflow: visible !important;
      }
      body * {
        visibility: visible !important;
      }
      .printable-sheet {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        width: 100% !important;
        max-width: 100% !important;
        height: auto !important;
        min-height: 520px !important;
        aspect-ratio: 210 / 148 !important;
        box-shadow: none !important;
        margin: 0 auto !important;
        background-color: #ffffff !important;
        color: #000000 !important;
        border: 2px solid #1E3A8A !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      .no-print,
      .print-control-bar,
      button {
        display: none !important;
      }
    </style>
  `;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${documentTitle}</title>
        ${stylesHtml}
        ${printStyles}
      </head>
      <body>
        ${element.outerHTML}
      </body>
    </html>
  `);
  doc.close();

  // Ensure all images in iframe are loaded before printing
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
        }, 3000);
      }
    }, 300);
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
    // Fallback timer
    setTimeout(performPrint, 1500);
  }
}

/**
 * Download element as A5 Landscape PDF using html-to-image and jsPDF.
 */
export async function downloadVoucherPdf(
  element: HTMLElement | null,
  fileName: string,
  setLoading?: (loading: boolean) => void
) {
  if (!element || typeof window === 'undefined') return;

  if (setLoading) setLoading(true);

  try {
    const imgData = await toPng(element, {
      quality: 0.98,
      pixelRatio: 2.2,
      backgroundColor: '#ffffff',
      cacheBust: true,
      skipFonts: false,
    });

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a5', // 210mm x 148mm
      compress: true,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 148mm

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    pdf.save(fileName);
  } catch (error) {
    console.error('Gagal generate PDF dengan toPng:', error);
    // Fallback: If foreignObject rendering encounters issues, trigger print dialog
    printVoucherDocument(element, fileName.replace('.pdf', ''));
  } finally {
    if (setLoading) setLoading(false);
  }
}
