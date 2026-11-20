'use client';

import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeightRule,
  PageBreak,
  Packer,
  ImageRun,
} from 'docx';
import { ReimbursementRequest, ReimbursementType } from '@/types/database';
import { parseAccountBlocksFromDescription, normalizeAccount, getCleanDescription, extractMetadataFromDescription } from './formatters';

export interface DocxApprover {
  name: string;
  signature?: string | null;
}

export interface GenerateDocxOptions {
  request: ReimbursementRequest;
  sameDateRequests?: ReimbursementRequest[];
  financeApprover?: DocxApprover;
  directorApprover?: DocxApprover;
}

export interface LoadedImageData {
  data: Uint8Array;
  type: 'png' | 'jpg' | 'gif';
  width: number;
  height: number;
}

// Border definitions
const thinGrayBorder = {
  top: { style: BorderStyle.SINGLE, size: 4, color: 'B0B0B0' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'B0B0B0' },
  left: { style: BorderStyle.SINGLE, size: 4, color: 'B0B0B0' },
  right: { style: BorderStyle.SINGLE, size: 4, color: 'B0B0B0' },
};

const tableNoBorder = {
  top: { style: BorderStyle.NONE },
  bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE },
  right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.NONE },
  insideVertical: { style: BorderStyle.NONE },
};

const cellNoBorder = {
  top: { style: BorderStyle.NONE },
  bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE },
  right: { style: BorderStyle.NONE },
};

const orangeFrameBorder = {
  top: { style: BorderStyle.SINGLE, size: 14, color: 'ED7D31' },
  bottom: { style: BorderStyle.SINGLE, size: 14, color: 'ED7D31' },
  left: { style: BorderStyle.SINGLE, size: 14, color: 'ED7D31' },
  right: { style: BorderStyle.SINGLE, size: 14, color: 'ED7D31' },
};

/**
 * Format currency number to Indonesian standard "1.105.000,00"
 */
export function formatCurrencyNumber(num: number): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format YYYY-MM-DD to DD/MM/YYYY
 */
export function formatDateSlash(dateStr?: string | null): string {
  if (!dateStr) {
    const today = new Date();
    const d = String(today.getDate()).padStart(2, '0');
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const y = today.getFullYear();
    return `${d}/${m}/${y}`;
  }
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Format RF Number (e.g. RF-06112026/085)
 */
export function formatRfNumber(dateStr?: string | null, id?: string): string {
  const slashDate = formatDateSlash(dateStr);
  const cleanDate = slashDate.replace(/\//g, '');
  const seq = id ? id.slice(-3).toUpperCase() : '085';
  return `RF-${cleanDate}/${seq}`;
}

/**
 * Fetch image and determine dimensions and format
 */
export async function fetchImageBuffer(url: string): Promise<LoadedImageData | null> {
  if (!url || typeof window === 'undefined') return null;

  try {
    let res: Response;
    try {
      res = await fetch(url, { mode: 'cors' });
      if (!res.ok) {
        throw new Error('Direct fetch failed');
      }
    } catch {
      // Fallback via Next.js proxy
      res = await fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`);
    }

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';
    let type: 'png' | 'jpg' | 'gif' = 'jpg';
    if (contentType.includes('png') || url.toLowerCase().includes('.png')) {
      type = 'png';
    } else if (contentType.includes('gif') || url.toLowerCase().includes('.gif')) {
      type = 'gif';
    }

    const arrayBuffer = await res.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Get dimensions via browser Image object
    const dims = await new Promise<{ width: number; height: number }>((resolve) => {
      try {
        const blob = new Blob([arrayBuffer], { type: contentType || 'image/jpeg' });
        const objUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const w = img.naturalWidth || 400;
          const h = img.naturalHeight || 500;
          URL.revokeObjectURL(objUrl);
          resolve({ width: w, height: h });
        };
        img.onerror = () => {
          URL.revokeObjectURL(objUrl);
          resolve({ width: 400, height: 500 });
        };
        img.src = objUrl;
      } catch {
        resolve({ width: 400, height: 500 });
      }
    });

    return {
      data: uint8,
      type,
      width: dims.width,
      height: dims.height,
    };
  } catch (err) {
    console.warn('Gagal memuat gambar struk untuk Word:', url, err);
    return null;
  }
}

/**
 * Fit image inside bounding box while preserving aspect ratio
 */
export function fitImageDimensions(
  origW: number,
  origH: number,
  maxW: number = 195,
  maxH: number = 290
): { width: number; height: number } {
  if (!origW || !origH) return { width: maxW, height: maxH };
  const ratio = Math.min(maxW / origW, maxH / origH, 1);
  return {
    width: Math.max(30, Math.round(origW * ratio)),
    height: Math.max(30, Math.round(origH * ratio)),
  };
}

/**
 * Generate MS Word (.docx) document matching user template
 */
export async function generateReimbursementDocx(
  options: GenerateDocxOptions
): Promise<Blob> {
  const { request, sameDateRequests, financeApprover, directorApprover } = options;

  const targetRequests =
    sameDateRequests && sameDateRequests.length > 0 ? sameDateRequests : [request];
  const determinedType: ReimbursementType = request.reimbursement_type || 'Petty Cash';

  // 1. Gather all itemized entries
  const itemizedList: Array<{
    itemNum: number;
    date: string;
    description: string;
    receipt: string;
    cost: number;
  }> = [];

  let runningItem = 1;
  targetRequests.forEach((reqItem) => {
    const blocks = parseAccountBlocksFromDescription(
      reqItem.description,
      reqItem.account || reqItem.category,
      Number(reqItem.amount) || 0,
      reqItem.customer,
      reqItem.receipt_url
    );

    blocks.forEach((block) => {
      const blockAcc = normalizeAccount(
        block.account || reqItem.account || reqItem.category,
        determinedType
      );
      const blockAmount = Number(block.amount) || 0;
      const entries =
        block.entries && block.entries.length > 0
          ? block.entries
          : [{ customer: reqItem.customer || '', description: reqItem.title }];

      entries.forEach((entry, eIdx) => {
        const cleanDesc = getCleanDescription(entry.description);
        const itemDesc =
          cleanDesc && cleanDesc.trim()
            ? cleanDesc.trim()
            : reqItem.title && !reqItem.title.startsWith('Form Lembur')
            ? reqItem.title.trim()
            : '';

        itemizedList.push({
          itemNum: runningItem++,
          date: formatDateSlash(entry.receipt_date || reqItem.request_date),
          description: itemDesc,
          receipt: 'Attached',
          cost: eIdx === 0 ? blockAmount : 0,
        });
      });
    });
  });

  const totalAmount = targetRequests.reduce(
    (sum, r) => sum + (Number(r.amount) || 0),
    0
  );

  // 2. Collect all unique receipt photos
  const receiptUrlSet = new Set<string>();
  targetRequests.forEach((r) => {
    if (r.receipt_url) receiptUrlSet.add(r.receipt_url);
    const blocks = parseAccountBlocksFromDescription(
      r.description,
      r.account || r.category,
      Number(r.amount) || 0,
      r.customer,
      r.receipt_url
    );
    blocks.forEach((b) => {
      if (b.receipt_url) receiptUrlSet.add(b.receipt_url);
    });
  });
  const allReceiptUrls = Array.from(receiptUrlSet).filter(Boolean);

  // Fetch all receipt images concurrently
  const loadedReceiptImages = await Promise.all(
    allReceiptUrls.map((url) => fetchImageBuffer(url))
  );
  const validReceiptImages = loadedReceiptImages.filter(
    (img): img is LoadedImageData => img !== null
  );

  const meta = extractMetadataFromDescription(request.description);

  // Requester details: Based on employee profile / metadata (not role/jabatan)
  const rawRequesterName =
    request.profiles?.full_name ||
    (request as any).nama_karyawan ||
    meta.full_name ||
    (request.profiles?.email ? request.profiles.email.split('@')[0] : 'Employee');

  const rawRequesterEmail =
    request.profiles?.email ||
    meta.email ||
    '';

  const nameLower = (rawRequesterName || '').toLowerCase();
  const emailLower = (rawRequesterEmail || '').toLowerCase();

  let directoryPhone = '';
  let directoryId = '';
  if (nameLower.includes('miskadi') || emailLower.includes('miskadi')) {
    directoryPhone = '085710002923';
    directoryId = 'CSK-007';
  } else if (nameLower.includes('bryan') || emailLower.includes('bryan')) {
    directoryPhone = '0882 3991 9129';
    directoryId = 'CSK-003';
  } else if (nameLower.includes('staff') || emailLower.includes('karyawan')) {
    directoryPhone = '0882 3991 9129';
    directoryId = 'CSK-002';
  }

  const requesterName = rawRequesterName;

  const requesterPhone =
    request.profiles?.phone ||
    (request.profiles as any)?.phone ||
    meta.phone ||
    directoryPhone ||
    '';

  const requesterEmail = rawRequesterEmail;

  let requesterId =
    request.profiles?.employee_id ||
    (request.profiles as any)?.employee_id ||
    meta.employee_id ||
    directoryId ||
    `CSK-${(request.user_id || '001').slice(-3).toUpperCase()}`;

  if (requesterId.startsWith('CSK-4') && directoryId) {
    requesterId = directoryId;
  }

  const requesterJabatan =
    request.department ||
    request.profiles?.department ||
    meta.department ||
    'Staff OPS';

  const bankName =
    request.profiles?.bank_name ||
    meta.bank_name ||
    'BCA';

  const bankAccount =
    request.profiles?.bank_account_number ||
    meta.bank_account_number ||
    '';

  const bankHolder =
    request.profiles?.bank_account_holder ||
    meta.bank_account_holder ||
    requesterName;

  const memoText = bankName ? `Pembayaran ke Rekening ${bankName}` : 'Pembayaran ke Rekening BCA';
  const purposeText =
    request.title || getCleanDescription(request.description) || 'Reimburst Operasional';

  const requestDateFormatted = formatDateSlash(request.request_date);
  const rfNumberFormatted =
    request.rf_number || meta.rf_number || formatRfNumber(request.request_date, request.id);

  // Approver names
  const finName = financeApprover?.name || 'Dwi N';
  const dirName = directorApprover?.name || 'Adrian Nugroho';
  const isPaid = request.payment_status === 'Paid';
  const paymentDate = request.payment_action_at
    ? formatDateSlash(request.payment_action_at)
    : isPaid
    ? requestDateFormatted
    : '';

  // -------------------------------------------------------------
  // BUILD PAGE 1: REIMBURSEMENT FORM
  // -------------------------------------------------------------
  const page1Children: any[] = [];

  // Top Title
  page1Children.push(
    new Paragraph({
      spacing: { after: 30 },
      children: [
        new TextRun({
          text: 'Reimbursement Form',
          bold: true,
          size: 38,
          color: 'E65100',
          font: 'Arial',
        }),
      ],
    })
  );

  page1Children.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: 'PT. CITRA SARI KENCANA (Ouffice.co.id)',
          bold: true,
          size: 22,
          color: '595959',
          font: 'Arial',
        }),
      ],
    })
  );

  // Top Section: Left (Requester Info) + Right (Request Date & RF Number)
  const topLayoutTable = new Table({
    width: { size: 10000, type: WidthType.DXA },
    borders: tableNoBorder,
    rows: [
      new TableRow({
        children: [
          // Left: Requester Info
          new TableCell({
            width: { size: 6200, type: WidthType.DXA },
            borders: cellNoBorder,
            children: [
              new Table({
                width: { size: 6000, type: WidthType.DXA },
                borders: tableNoBorder,
                rows: [
                  new TableRow({
                    height: { value: 340, rule: HeightRule.ATLEAST },
                    children: [
                      new TableCell({
                        width: { size: 1700, type: WidthType.DXA },
                        borders: cellNoBorder,
                        margins: { top: 30, bottom: 30, left: 0, right: 10 },
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: 'Requester Name',
                                size: 22,
                                font: 'Arial',
                              }),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        width: { size: 200, type: WidthType.DXA },
                        borders: cellNoBorder,
                        margins: { top: 30, bottom: 30, left: 0, right: 30 },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                              new TextRun({
                                text: ':',
                                size: 22,
                                font: 'Arial',
                              }),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        width: { size: 4100, type: WidthType.DXA },
                        borders: thinGrayBorder,
                        margins: { top: 30, bottom: 30, left: 100, right: 100 },
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: requesterName,
                                bold: true,
                                size: 22,
                                font: 'Arial',
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableRow({
                    height: { value: 340, rule: HeightRule.ATLEAST },
                    children: [
                      new TableCell({
                        width: { size: 1700, type: WidthType.DXA },
                        borders: cellNoBorder,
                        margins: { top: 30, bottom: 30, left: 0, right: 10 },
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({ text: 'Phone', size: 22, font: 'Arial' }),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        width: { size: 200, type: WidthType.DXA },
                        borders: cellNoBorder,
                        margins: { top: 30, bottom: 30, left: 0, right: 30 },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                              new TextRun({ text: ':', size: 22, font: 'Arial' }),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        width: { size: 4100, type: WidthType.DXA },
                        borders: thinGrayBorder,
                        margins: { top: 30, bottom: 30, left: 100, right: 100 },
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: requesterPhone,
                                size: 22,
                                font: 'Arial',
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableRow({
                    height: { value: 340, rule: HeightRule.ATLEAST },
                    children: [
                      new TableCell({
                        width: { size: 1700, type: WidthType.DXA },
                        borders: cellNoBorder,
                        margins: { top: 30, bottom: 30, left: 0, right: 10 },
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({ text: 'Email', size: 22, font: 'Arial' }),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        width: { size: 200, type: WidthType.DXA },
                        borders: cellNoBorder,
                        margins: { top: 30, bottom: 30, left: 0, right: 30 },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                              new TextRun({ text: ':', size: 22, font: 'Arial' }),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        width: { size: 4100, type: WidthType.DXA },
                        borders: thinGrayBorder,
                        margins: { top: 30, bottom: 30, left: 100, right: 100 },
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: requesterEmail,
                                size: 22,
                                color: '0563C1',
                                underline: {},
                                font: 'Arial',
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // Right: Request Date & RF Number mini table
          new TableCell({
            width: { size: 3800, type: WidthType.DXA },
            borders: cellNoBorder,
            children: [
              new Table({
                width: { size: 3600, type: WidthType.DXA },
                alignment: AlignmentType.RIGHT,
                borders: tableNoBorder,
                rows: [
                  new TableRow({
                    height: { value: 280, rule: HeightRule.ATLEAST },
                    children: [
                      new TableCell({
                        width: { size: 3600, type: WidthType.DXA },
                        shading: { fill: 'ED7D31' },
                        borders: thinGrayBorder,
                        margins: { top: 30, bottom: 30, left: 60, right: 60 },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({
                                text: 'Request Date',
                                bold: true,
                                color: 'FFFFFF',
                                size: 22,
                                font: 'Arial',
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableRow({
                    height: { value: 320, rule: HeightRule.ATLEAST },
                    children: [
                      new TableCell({
                        width: { size: 3600, type: WidthType.DXA },
                        borders: thinGrayBorder,
                        margins: { top: 30, bottom: 30, left: 60, right: 60 },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({
                                text: requestDateFormatted,
                                size: 22,
                                font: 'Arial',
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableRow({
                    height: { value: 280, rule: HeightRule.ATLEAST },
                    children: [
                      new TableCell({
                        width: { size: 3600, type: WidthType.DXA },
                        shading: { fill: 'ED7D31' },
                        borders: thinGrayBorder,
                        margins: { top: 30, bottom: 30, left: 60, right: 60 },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({
                                text: 'RF Number',
                                bold: true,
                                color: 'FFFFFF',
                                size: 22,
                                font: 'Arial',
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableRow({
                    height: { value: 320, rule: HeightRule.ATLEAST },
                    children: [
                      new TableCell({
                        width: { size: 3600, type: WidthType.DXA },
                        borders: thinGrayBorder,
                        margins: { top: 30, bottom: 30, left: 60, right: 60 },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({
                                text: rfNumberFormatted,
                                size: 22,
                                font: 'Arial',
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
  page1Children.push(topLayoutTable);

  // Section: Make Check Payable To
  page1Children.push(
    new Paragraph({
      spacing: { before: 140, after: 60 },
      children: [
        new TextRun({
          text: 'Make Check Payable To',
          bold: true,
          size: 22,
          font: 'Arial',
        }),
      ],
    })
  );

  const checkPayableTable = new Table({
    width: { size: 10000, type: WidthType.DXA },
    borders: tableNoBorder,
    rows: [
      new TableRow({
        children: [
          // Left: Name, ID, Jabatan, Memo
          new TableCell({
            width: { size: 6200, type: WidthType.DXA },
            borders: cellNoBorder,
            children: [
              new Table({
                width: { size: 6000, type: WidthType.DXA },
                borders: tableNoBorder,
                rows: [
                  ['Name', requesterName, true],
                  ['ID', requesterId, false],
                  ['Jabatan', requesterJabatan, false],
                  ['Memo', memoText, false],
                ].map(([label, val, isBold]) => {
                  return new TableRow({
                    height: { value: 320, rule: HeightRule.ATLEAST },
                    children: [
                      new TableCell({
                        width: { size: 1400, type: WidthType.DXA },
                        borders: cellNoBorder,
                        margins: { top: 30, bottom: 30, left: 0, right: 10 },
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: label as string,
                                size: 22,
                                font: 'Arial',
                              }),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        width: { size: 200, type: WidthType.DXA },
                        borders: cellNoBorder,
                        margins: { top: 30, bottom: 30, left: 0, right: 30 },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                              new TextRun({
                                text: ':',
                                size: 22,
                                font: 'Arial',
                              }),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        width: { size: 4400, type: WidthType.DXA },
                        borders: thinGrayBorder,
                        margins: { top: 30, bottom: 30, left: 100, right: 100 },
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: val as string,
                                bold: Boolean(isBold),
                                size: 22,
                                font: 'Arial',
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  });
                }),
              }),
            ],
          }),

          // Right: Bank Account Details Box
          new TableCell({
            width: { size: 3800, type: WidthType.DXA },
            borders: cellNoBorder,
            children: [
              new Table({
                width: { size: 3600, type: WidthType.DXA },
                alignment: AlignmentType.RIGHT,
                borders: thinGrayBorder,
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: 3600, type: WidthType.DXA },
                        borders: thinGrayBorder,
                        margins: { top: 70, bottom: 70, left: 120, right: 120 },
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: `BANK ${bankName.toUpperCase()}`,
                                bold: true,
                                size: 22,
                                font: 'Arial',
                              }),
                            ],
                          }),
                          new Paragraph({
                            spacing: { before: 30 },
                            children: [
                              new TextRun({
                                text: `A/C : ${bankAccount}`,
                                bold: true,
                                size: 22,
                                font: 'Arial',
                              }),
                            ],
                          }),
                          new Paragraph({
                            spacing: { before: 30 },
                            children: [
                              new TextRun({
                                text: `AN. : ${bankHolder.toUpperCase()}`,
                                bold: true,
                                size: 22,
                                font: 'Arial',
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
  page1Children.push(checkPayableTable);

  // Section: Describe Purpose
  page1Children.push(
    new Paragraph({
      spacing: { before: 140, after: 60 },
      children: [
        new TextRun({
          text: 'Describe Purpose',
          bold: true,
          size: 22,
          font: 'Arial',
        }),
      ],
    })
  );

  page1Children.push(
    new Table({
      width: { size: 10000, type: WidthType.DXA },
      borders: thinGrayBorder,
      rows: [
        new TableRow({
          height: { value: 340, rule: HeightRule.ATLEAST },
          children: [
            new TableCell({
              width: { size: 10000, type: WidthType.DXA },
              borders: thinGrayBorder,
              margins: { top: 50, bottom: 50, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: purposeText,
                      size: 22,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  // Section: Itemized Expenses
  page1Children.push(
    new Paragraph({
      spacing: { before: 150, after: 60 },
      children: [
        new TextRun({
          text: 'Itemized Expenses',
          bold: true,
          size: 22,
          color: 'E65100',
          font: 'Arial',
        }),
      ],
    })
  );

  const itemizedRows: TableRow[] = [];

  // 1. Header row
  itemizedRows.push(
    new TableRow({
      height: { value: 320, rule: HeightRule.ATLEAST },
      children: [
        { label: 'ITEM', width: 700, align: AlignmentType.CENTER },
        { label: 'DATE', width: 1400, align: AlignmentType.CENTER },
        { label: 'DESCRIPTION', width: 4700, align: AlignmentType.LEFT },
        { label: 'RECEIPT', width: 1400, align: AlignmentType.CENTER },
        { label: 'COST', width: 1800, align: AlignmentType.RIGHT },
      ].map((col) => {
        return new TableCell({
          width: { size: col.width, type: WidthType.DXA },
          shading: { fill: 'ED7D31' },
          borders: thinGrayBorder,
          margins: { top: 40, bottom: 40, left: 80, right: 80 },
          children: [
            new Paragraph({
              alignment: col.align,
              children: [
                new TextRun({
                  text: col.label,
                  bold: true,
                  color: 'FFFFFF',
                  size: 22,
                  font: 'Arial',
                }),
              ],
            }),
          ],
        });
      }),
    })
  );

  // 2. Data rows (padded to at least 10 rows)
  const minRows = 10;
  const totalItemCount = Math.max(minRows, itemizedList.length);

  for (let i = 0; i < totalItemCount; i++) {
    const item = itemizedList[i];
    itemizedRows.push(
      new TableRow({
        height: { value: 300, rule: HeightRule.ATLEAST },
        children: [
          // Col 1: ITEM
          new TableCell({
            width: { size: 700, type: WidthType.DXA },
            borders: thinGrayBorder,
            margins: { top: 30, bottom: 30, left: 60, right: 60 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: String(i + 1),
                    size: 22,
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
          // Col 2: DATE
          new TableCell({
            width: { size: 1400, type: WidthType.DXA },
            borders: thinGrayBorder,
            margins: { top: 30, bottom: 30, left: 60, right: 60 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: item ? item.date : '',
                    size: 22,
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
          // Col 3: DESCRIPTION
          new TableCell({
            width: { size: 4700, type: WidthType.DXA },
            borders: thinGrayBorder,
            margins: { top: 30, bottom: 30, left: 80, right: 80 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: item ? item.description : '',
                    size: 22,
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
          // Col 4: RECEIPT
          new TableCell({
            width: { size: 1400, type: WidthType.DXA },
            borders: thinGrayBorder,
            margins: { top: 30, bottom: 30, left: 60, right: 60 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: item ? item.receipt : '',
                    size: 22,
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
          // Col 5: COST
          new TableCell({
            width: { size: 1800, type: WidthType.DXA },
            borders: thinGrayBorder,
            margins: { top: 30, bottom: 30, left: 60, right: 60 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: item && item.cost > 0 ? formatCurrencyNumber(item.cost) : '',
                    size: 22,
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  }

  // 3. Total Row (TOTAL | IDR | Amount with peach background)
  itemizedRows.push(
    new TableRow({
      height: { value: 340, rule: HeightRule.ATLEAST },
      children: [
        new TableCell({
          width: { size: 6800, type: WidthType.DXA },
          borders: cellNoBorder,
          margins: { top: 30, bottom: 30, left: 80, right: 120 },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: 'TOTAL',
                  bold: true,
                  size: 22,
                  font: 'Arial',
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 1400, type: WidthType.DXA },
          shading: { fill: 'F8CBAD' },
          borders: thinGrayBorder,
          margins: { top: 30, bottom: 30, left: 60, right: 60 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: 'IDR',
                  bold: true,
                  size: 22,
                  font: 'Arial',
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 1800, type: WidthType.DXA },
          shading: { fill: 'F8CBAD' },
          borders: thinGrayBorder,
          margins: { top: 30, bottom: 30, left: 60, right: 60 },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: formatCurrencyNumber(totalAmount),
                  bold: true,
                  size: 22,
                  font: 'Arial',
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  page1Children.push(
    new Table({
      width: { size: 10000, type: WidthType.DXA },
      rows: itemizedRows,
    })
  );

  // Subtext under Itemized Expenses table
  page1Children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 30, after: 80 },
      children: [
        new TextRun({
          text: "Don't forget to include receipts!",
          italics: true,
          size: 22,
          font: 'Arial',
        }),
      ],
    })
  );

  // Section: Approval
  page1Children.push(
    new Paragraph({
      spacing: { before: 40, after: 40 },
      children: [
        new TextRun({
          text: 'Approval',
          bold: true,
          size: 22,
          font: 'Arial',
        }),
      ],
    })
  );

  page1Children.push(
    new Table({
      width: { size: 10000, type: WidthType.DXA },
      borders: tableNoBorder,
      rows: [
        // Row 1: Names (Dwi N / Adrian Nugroho) & Positions (Finance / Direktur)
        new TableRow({
          height: { value: 340, rule: HeightRule.ATLEAST },
          children: [
            new TableCell({
              width: { size: 6000, type: WidthType.DXA },
              borders: thinGrayBorder,
              margins: { top: 40, bottom: 40, left: 80, right: 80 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: finName, size: 22, font: 'Arial' }),
                    new TextRun({
                      text: `                                                    ${dirName}`,
                      size: 22,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 4000, type: WidthType.DXA },
              borders: thinGrayBorder,
              margins: { top: 40, bottom: 40, left: 80, right: 80 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Finance', size: 22, font: 'Arial' }),
                    new TextRun({
                      text: '                                Direktur',
                      size: 22,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),

        // Row 2: Sub-labels: "Approved By (Name)" and "Position"
        new TableRow({
          children: [
            new TableCell({
              width: { size: 6000, type: WidthType.DXA },
              borders: cellNoBorder,
              margins: { top: 15, bottom: 30, left: 10, right: 10 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Approved By (Name)',
                      size: 22,
                      color: '595959',
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 4000, type: WidthType.DXA },
              borders: cellNoBorder,
              margins: { top: 15, bottom: 30, left: 10, right: 10 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Position',
                      size: 22,
                      color: '595959',
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),

        // Row 3: Signature Box and Date Box
        new TableRow({
          height: { value: 500, rule: HeightRule.ATLEAST },
          children: [
            new TableCell({
              width: { size: 6000, type: WidthType.DXA },
              borders: thinGrayBorder,
              margins: { top: 30, bottom: 30, left: 80, right: 80 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: '', font: 'Arial', size: 22 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 4000, type: WidthType.DXA },
              borders: thinGrayBorder,
              margins: { top: 30, bottom: 30, left: 80, right: 80 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: paymentDate,
                      size: 22,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),

        // Row 4: Sub-labels: "Signature" and "Date"
        new TableRow({
          children: [
            new TableCell({
              width: { size: 6000, type: WidthType.DXA },
              borders: cellNoBorder,
              margins: { top: 15, bottom: 0, left: 10, right: 10 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Signature',
                      size: 22,
                      color: '595959',
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 4000, type: WidthType.DXA },
              borders: cellNoBorder,
              margins: { top: 15, bottom: 0, left: 10, right: 10 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Date',
                      size: 22,
                      color: '595959',
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  // -------------------------------------------------------------
  // BUILD PAGE 2+: RECEIPTS (Max 6 photos per page in 3x2 grid)
  // Dynamic: Only render the exact number of frames corresponding to uploaded photos!
  // -------------------------------------------------------------
  const receiptsPerPage = 6;
  const numReceiptPages =
    validReceiptImages.length > 0
      ? Math.ceil(validReceiptImages.length / receiptsPerPage)
      : 0;

  const makeFrameCell = (imgData: LoadedImageData) => {
    const fit = fitImageDimensions(imgData.width, imgData.height, 195, 290);
    return new TableCell({
      width: { size: 3100, type: WidthType.DXA },
      borders: orangeFrameBorder,
      margins: { top: 80, bottom: 80, left: 60, right: 60 },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: imgData.data,
              transformation: fit,
              type: imgData.type,
            }),
          ],
        }),
      ],
    });
  };

  const makeSpacerCell = (w: number) => {
    return new TableCell({
      width: { size: w, type: WidthType.DXA },
      borders: cellNoBorder,
      children: [new Paragraph({ text: '' })],
    });
  };

  for (let p = 0; p < numReceiptPages; p++) {
    // Page break before each receipts page
    page1Children.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    );

    // Receipts Title
    page1Children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: p === 0 ? 'Receipts' : `Receipts (Hal. ${p + 1})`,
            bold: true,
            size: 38,
            color: 'E65100',
            font: 'Arial',
          }),
        ],
      })
    );

    const startIndex = p * receiptsPerPage;
    const pImgs = validReceiptImages.slice(startIndex, startIndex + receiptsPerPage);
    const photoCount = pImgs.length;

    // Top row (up to 3 photos)
    const topCount = Math.min(photoCount, 3);
    const topRowCells: TableCell[] = [];
    for (let c = 0; c < 3; c++) {
      if (c < topCount) {
        topRowCells.push(makeFrameCell(pImgs[c]));
      } else {
        // Borderless spacer so the grid stays aligned without extra empty frames!
        topRowCells.push(makeSpacerCell(3100));
      }
      if (c < 2) {
        topRowCells.push(makeSpacerCell(350));
      }
    }

    const gridRows: TableRow[] = [
      new TableRow({
        height: { value: 4600, rule: HeightRule.ATLEAST },
        children: topRowCells,
      }),
    ];

    // Bottom row (only if photoCount > 3)
    if (photoCount > 3) {
      gridRows.push(
        new TableRow({
          height: { value: 240, rule: HeightRule.EXACT },
          children: [
            makeSpacerCell(3100),
            makeSpacerCell(350),
            makeSpacerCell(3100),
            makeSpacerCell(350),
            makeSpacerCell(3100),
          ],
        })
      );

      const botCount = photoCount - 3;
      const botRowCells: TableCell[] = [];
      for (let c = 0; c < 3; c++) {
        if (c < botCount) {
          botRowCells.push(makeFrameCell(pImgs[3 + c]));
        } else {
          // Borderless spacer
          botRowCells.push(makeSpacerCell(3100));
        }
        if (c < 2) {
          botRowCells.push(makeSpacerCell(350));
        }
      }

      gridRows.push(
        new TableRow({
          height: { value: 4600, rule: HeightRule.ATLEAST },
          children: botRowCells,
        })
      );
    }

    page1Children.push(
      new Table({
        width: { size: 10000, type: WidthType.DXA },
        borders: tableNoBorder,
        rows: gridRows,
      })
    );
  }

  // Final Document Creation
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Arial',
            size: 22,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 650,
              bottom: 650,
              left: 750,
              right: 750,
            },
          },
        },
        children: page1Children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Trigger download of generated docx file.
 * Handles both Android App JavaScriptInterface and Desktop Web download.
 */
export async function downloadDocxFile(blob: Blob, fileName: string): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Check if running inside custom Android WebView
  const androidApp = (window as any).AndroidApp;
  if (androidApp && typeof androidApp.saveDocx === 'function') {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      androidApp.saveDocx(base64data, fileName);
    };
    reader.readAsDataURL(blob);
    return;
  }

  // 2. Standard Web/Desktop browser download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
