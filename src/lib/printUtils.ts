'use client';

import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

/**
 * Print an element directly to A5 Landscape.
 * - On Android app: calls Android native PrintManager via JavaScriptInterface.
 * - On Web/Desktop: calls window.print() instantly without lag, formatted via @media print to 1 sheet.
 */
export function printVoucherDocument(element: HTMLElement | null, documentTitle: string) {
  if (typeof window === 'undefined') return;

  // 1. Android App: Use native Android PrintManager
  const androidApp = (window as any).AndroidApp;
  if (androidApp && typeof androidApp.printDocument === 'function') {
    androidApp.printDocument(documentTitle);
    return;
  }

  // 2. Desktop & Standard Web Browser: Instant native print with @media print
  window.print();
}

/**
 * Print Word Reimbursement Form directly to A4 Portrait (multi-page).
 * - On Android app: calls Android native PrintManager.
 * - On Desktop/Web: uses an isolated iframe to ensure A4 multi-page with full colors and no UI clipping.
 */
export function printWordDocument(element: HTMLElement | null, documentTitle: string) {
  if (typeof window === 'undefined' || !element) return;

  // 1. Android App: Use native Android PrintManager
  const androidApp = (window as any).AndroidApp;
  if (androidApp && typeof androidApp.printDocument === 'function') {
    androidApp.printDocument(documentTitle);
    return;
  }

  // 2. Desktop & Standard Web Browser: Print via dedicated iframe for pure A4 portrait layout without UI artifacts
  try {
    const existingIframe = document.getElementById('ourem-word-print-iframe');
    if (existingIframe) {
      existingIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'ourem-word-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = '1000px';
    iframe.style.height = '1400px';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) {
      window.print();
      return;
    }

    // Collect all stylesheets from parent document
    let stylesHtml = '';
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
      stylesHtml += node.outerHTML;
    });

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="utf-8" />
          <title>${documentTitle}</title>
          ${stylesHtml}
          <style>
            @page {
              size: A4 portrait !important;
              margin: 10mm 12mm !important;
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
              min-height: 0 !important;
              max-width: none !important;
              max-height: none !important;
              overflow: visible !important;
              position: static !important;
              font-family: Arial, Helvetica, sans-serif !important;
            }
            body * {
              visibility: visible !important;
            }
            .word-print-wrapper {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
            }
            .printable-word-doc {
              position: static !important;
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              max-width: 100% !important;
              width: 100% !important;
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
              visibility: visible !important;
            }
            .printable-word-doc * {
              visibility: visible !important;
            }
            .word-preview-page-1 {
              min-height: 0 !important;
              height: auto !important;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              overflow: visible !important;
            }
            .word-receipts-page {
              min-height: 0 !important;
              height: auto !important;
              page-break-before: always !important;
              break-before: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              overflow: visible !important;
              padding-top: 0 !important;
              margin-top: 0 !important;
              border-top: none !important;
            }
            @media print {
              @page {
                size: A4 portrait !important;
                margin: 10mm 12mm !important;
              }
              html, body {
                width: 100% !important;
                height: auto !important;
                min-height: 0 !important;
                max-width: none !important;
                max-height: none !important;
                overflow: visible !important;
                background: #ffffff !important;
                color: #000000 !important;
                position: static !important;
              }
              body * {
                visibility: visible !important;
              }
              .printable-word-doc {
                position: static !important;
                height: auto !important;
                overflow: visible !important;
                padding: 0 !important;
                margin: 0 !important;
                box-shadow: none !important;
              }
              .word-preview-page-1 {
                min-height: 0 !important;
                height: auto !important;
                page-break-after: always !important;
                break-after: page !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .word-receipts-page {
                min-height: 0 !important;
                height: auto !important;
                page-break-before: always !important;
                break-before: page !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                padding-top: 0 !important;
                margin-top: 0 !important;
                border-top: none !important;
              }
              .no-print {
                display: none !important;
              }
            }
          </style>
        </head>
        <body class="has-word-modal-open word-print-body">
          <div class="word-print-wrapper">
            ${element.outerHTML}
          </div>
        </body>
      </html>
    `);
    iframeDoc.close();

    const doPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Iframe print error, falling back to window.print():', err);
        window.print();
      } finally {
        setTimeout(() => {
          iframe.remove();
        }, 3000);
      }
    };

    const images = Array.from(iframeDoc.images);
    if (images.length === 0) {
      setTimeout(doPrint, 250);
    } else {
      let loaded = 0;
      let isPrinted = false;
      const total = images.length;

      const onImageLoaded = () => {
        loaded++;
        if (loaded >= total && !isPrinted) {
          isPrinted = true;
          setTimeout(doPrint, 250);
        }
      };

      images.forEach((img) => {
        if (img.complete) {
          onImageLoaded();
        } else {
          img.onload = onImageLoaded;
          img.onerror = onImageLoaded;
        }
      });

      // Timeout fallback in case image load event is delayed
      setTimeout(() => {
        if (!isPrinted) {
          isPrinted = true;
          doPrint();
        }
      }, 1500);
    }
  } catch (err) {
    console.error('printWordDocument caught error, falling back to window.print():', err);
    window.print();
  }
}

/**
 * Download element as A5 Landscape PDF.
 * - On Android app: saves directly to Download folder and opens PDF viewer.
 * - On Desktop/Web: triggers browser file download.
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

    // Check if running inside Android App:
    const androidApp = (window as any).AndroidApp;
    if (androidApp && typeof androidApp.savePdf === 'function') {
      const base64Pdf = pdf.output('datauristring');
      androidApp.savePdf(base64Pdf, fileName);
    } else {
      // Standard Desktop browser download
      pdf.save(fileName);
    }
  } catch (error) {
    console.error('Gagal generate PDF dengan toPng:', error);
    printVoucherDocument(element, fileName.replace('.pdf', ''));
  } finally {
    if (setLoading) setLoading(false);
  }
}
