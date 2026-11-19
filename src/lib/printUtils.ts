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
