import { OvertimeData } from '@/types/database';

export interface CustomerDescriptionEntry {
  account?: string;
  customer: string;
  description: string;
  amount?: number;
  receipt_date?: string;
}

export interface AccountBlockData {
  account: string;
  amount: number;
  receipt_url?: string;
  entries: Array<{
    customer: string;
    description: string;
    receipt_date?: string;
  }>;
}

export interface RequestMetadataPayload {
  reimbursement_type?: string;
  rf_number?: string | null;
  department?: string;
  account?: string;
  customer?: string;
  signature_url?: string;
  blocks?: AccountBlockData[];
  entries?: CustomerDescriptionEntry[];
  overtime_data?: OvertimeData;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  employee_id?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_holder?: string | null;
}

/**
 * Format account blocks into a combined description string containing JSON metadata
 * and human-readable text for fallback display.
 */
export function formatAccountBlocksToDescription(
  blocks: AccountBlockData[],
  meta?: Omit<RequestMetadataPayload, 'blocks' | 'entries'>
): string {
  if (blocks.length === 0) return '';

  const payload: RequestMetadataPayload = {
    ...(meta || {}),
    account: blocks[0]?.account,
    customer: blocks
      .flatMap((b) => b.entries.map((e) => e.customer.trim()))
      .filter(Boolean)
      .join(', '),
    blocks,
  };

  const jsonHeader = `__ITEMS_JSON__:${JSON.stringify(payload)}__END_ITEMS_JSON__\n`;
  const humanReadable = blocks
    .map((b) => {
      const lines = b.entries
        .map((e) => {
          const custPrefix = e.customer.trim() ? `[${e.customer.trim()}] ` : '';
          return `${custPrefix}${getCleanDescription(e.description)}`;
        })
        .join('\n');
      return lines;
    })
    .filter(Boolean)
    .join('\n');

  return jsonHeader + humanReadable;
}

/**
 * Format customer entries into a combined description string containing JSON metadata
 * and human-readable text for fallback display (backward compatibility).
 */
export function formatCustomerEntriesToDescription(
  entries: CustomerDescriptionEntry[],
  meta?: RequestMetadataPayload
): string {
  if (entries.length === 0) return '';

  const payload: RequestMetadataPayload = {
    ...(meta || {}),
    entries,
  };

  const jsonHeader = `__ITEMS_JSON__:${JSON.stringify(payload)}__END_ITEMS_JSON__\n`;
  const humanReadable = entries
    .map((e) => {
      const custPrefix = e.customer.trim() ? `[${e.customer.trim()}] ` : '';
      return `${custPrefix}${getCleanDescription(e.description)}`;
    })
    .join('\n');

  return jsonHeader + humanReadable;
}

/**
 * Extract extra request metadata (type, department, account, signature, blocks, etc.) from description
 */
export function extractMetadataFromDescription(description?: string | null): RequestMetadataPayload {
  if (!description) return {};
  const match = description.match(/__ITEMS_JSON__:([\s\S]*?)__END_ITEMS_JSON__/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && !Array.isArray(parsed) && typeof parsed === 'object') {
        return {
          reimbursement_type: parsed.reimbursement_type,
          rf_number: parsed.rf_number,
          department: parsed.department,
          account: parsed.account,
          customer: parsed.customer,
          signature_url: parsed.signature_url,
          blocks: parsed.blocks,
          entries: parsed.entries,
          overtime_data: parsed.overtime_data,
          full_name: parsed.full_name,
          email: parsed.email,
          phone: parsed.phone,
          employee_id: parsed.employee_id,
          bank_name: parsed.bank_name,
          bank_account_number: parsed.bank_account_number,
          bank_account_holder: parsed.bank_account_holder,
        };
      }
    } catch {
      // ignore
    }
  }
  return {};
}

/**
 * Format overtime data into description string containing JSON metadata and human-readable text
 */
export function formatOvertimeToDescription(
  data: OvertimeData,
  meta?: { department?: string; signature_url?: string }
): string {
  const payload: RequestMetadataPayload = {
    reimbursement_type: 'Lembur',
    department: meta?.department || 'Staff OPS',
    signature_url: meta?.signature_url,
    overtime_data: data,
  };

  const jsonHeader = `__ITEMS_JSON__:${JSON.stringify(payload)}__END_ITEMS_JSON__\n`;
  const dayTypeLabel = data.tipe_hari === 'hari libur' ? 'Hari Libur' : 'Hari Kerja';
  const humanReadable = `[Form Lembur - ${dayTypeLabel}] ${data.perusahaan} - ${data.nama_pekerjaan} (${data.jam_lembur})\nLokasi: ${data.lokasi_lembur}\n${data.uraian_pekerjaan}`;

  return jsonHeader + humanReadable;
}

/**
 * Extract overtime data from description string
 */
export function extractOvertimeFromDescription(description?: string | null): OvertimeData | null {
  if (!description) return null;
  const match = description.match(/__ITEMS_JSON__:([\s\S]*?)__END_ITEMS_JSON__/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && parsed.overtime_data) {
        return parsed.overtime_data as OvertimeData;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Parse structured account blocks from description string, with fallbacks for legacy records.
 */
export function parseAccountBlocksFromDescription(
  description?: string | null,
  fallbackAccount?: string | null,
  fallbackAmount?: number | null,
  fallbackCustomer?: string | null,
  fallbackReceiptUrl?: string | null
): AccountBlockData[] {
  if (!description) {
    return [
      {
        account: fallbackAccount || 'Bensin',
        amount: Number(fallbackAmount) || 0,
        receipt_url: fallbackReceiptUrl || undefined,
        entries: [{ customer: fallbackCustomer || '', description: '' }],
      },
    ];
  }

  const match = description.match(/__ITEMS_JSON__:([\s\S]*?)__END_ITEMS_JSON__/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      // Case 1: Structured blocks
      if (parsed && Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
        return parsed.blocks.map((b: any) => ({
          account: b.account || fallbackAccount || 'Bensin',
          amount: Number(b.amount) || 0,
          receipt_url: b.receipt_url || fallbackReceiptUrl || undefined,
          entries:
            Array.isArray(b.entries) && b.entries.length > 0
              ? b.entries.map((e: any) => ({
                  customer: e.customer || '',
                  description: getCleanDescription(e.description) || '',
                  receipt_date: e.receipt_date || undefined,
                }))
              : [{ customer: '', description: '', receipt_date: undefined }],
        }));
      }

      // Case 2: Object with entries array
      if (parsed && Array.isArray(parsed.entries) && parsed.entries.length > 0) {
        const groupMap = new Map<string, Array<{ customer: string; description: string; receipt_date?: string }>>();
        parsed.entries.forEach((e: any) => {
          const acc = e.account || parsed.account || fallbackAccount || 'Bensin';
          if (!groupMap.has(acc)) groupMap.set(acc, []);
          groupMap.get(acc)!.push({
            customer: e.customer || '',
            description: getCleanDescription(e.description) || '',
            receipt_date: e.receipt_date || undefined,
          });
        });

        const blocks: AccountBlockData[] = [];
        groupMap.forEach((ents, acc) => {
          blocks.push({
            account: acc,
            amount: Number(fallbackAmount) || 0,
            receipt_url: fallbackReceiptUrl || undefined,
            entries: ents,
          });
        });
        if (blocks.length > 0) return blocks;
      }

      // Case 3: Direct array
      if (Array.isArray(parsed) && parsed.length > 0) {
        const groupMap = new Map<string, Array<{ customer: string; description: string; receipt_date?: string }>>();
        parsed.forEach((e: any) => {
          const acc = e.account || fallbackAccount || 'Bensin';
          if (!groupMap.has(acc)) groupMap.set(acc, []);
          groupMap.get(acc)!.push({
            customer: e.customer || '',
            description: getCleanDescription(e.description) || '',
            receipt_date: e.receipt_date || undefined,
          });
        });

        const blocks: AccountBlockData[] = [];
        groupMap.forEach((ents, acc) => {
          blocks.push({
            account: acc,
            amount: Number(fallbackAmount) || 0,
            receipt_url: fallbackReceiptUrl || undefined,
            entries: ents,
          });
        });
        if (blocks.length > 0) return blocks;
      }
    } catch {}
  }

  return [
    {
      account: fallbackAccount || 'Bensin',
      amount: Number(fallbackAmount) || 0,
      receipt_url: fallbackReceiptUrl || undefined,
      entries: [
        {
          customer: fallbackCustomer || '',
          description: getCleanDescription(description),
          receipt_date: undefined,
        },
      ],
    },
  ];
}

/**
 * Parse customer entries from a description string for table & PDF presentation.
 */
export function parseCustomerEntries(
  description?: string | null,
  fallbackCustomer?: string | null,
  fallbackAccount?: string | null
): CustomerDescriptionEntry[] {
  if (!description) {
    return [{ account: fallbackAccount || '', customer: fallbackCustomer || '', description: '' }];
  }

  const match = description.match(/__ITEMS_JSON__:([\s\S]*?)__END_ITEMS_JSON__/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);

      // Case 1: Structured blocks (new layout)
      if (parsed && Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
        const flattened: CustomerDescriptionEntry[] = [];
        parsed.blocks.forEach((block: any) => {
          const blockAcc = block.account || fallbackAccount || '';
          const blockEntries = Array.isArray(block.entries) ? block.entries : [];
          if (blockEntries.length === 0) {
            flattened.push({
              account: blockAcc,
              customer: fallbackCustomer || '',
              description: '',
              amount: Number(block.amount) || 0,
              receipt_date: undefined,
            });
          } else {
            blockEntries.forEach((e: any, idx: number) => {
              flattened.push({
                account: blockAcc,
                customer: e.customer || '',
                description: getCleanDescription(e.description) || '',
                amount: idx === 0 ? Number(block.amount) || 0 : 0,
                receipt_date: e.receipt_date || undefined,
              });
            });
          }
        });
        if (flattened.length > 0) return flattened;
      }

      // Case 2: Legacy format (array directly)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any) => ({
          account: item.account || fallbackAccount || '',
          customer: item.customer || '',
          description: getCleanDescription(item.description) || '',
          receipt_date: item.receipt_date || undefined,
        }));
      }

      // Case 3: Object with entries array
      if (parsed && Array.isArray(parsed.entries) && parsed.entries.length > 0) {
        return parsed.entries.map((item: any) => ({
          account: item.account || parsed.account || fallbackAccount || '',
          customer: item.customer || '',
          description: getCleanDescription(item.description) || '',
          receipt_date: item.receipt_date || undefined,
        }));
      }
    } catch {
      // Fallback to manual parsing
    }
  }

  const clean = getCleanDescription(description);
  return [{ account: fallbackAccount || '', customer: fallbackCustomer || '', description: clean || '' }];
}

/**
 * Get human-readable description by stripping __ITEMS_JSON__ metadata and any bullet points.
 */
export function getCleanDescription(description?: string | null): string {
  if (!description) return '';
  const stripped = description.replace(/__ITEMS_JSON__:[\s\S]*?__END_ITEMS_JSON__\s*/, '').trim();
  // Strip bullet symbols (•, -, *, ●, ○, ▪, ▫, etc) from start of lines
  return stripped.replace(/^[\s•\-\*●○▪▫]+\s*/gm, '').trim();
}

/**
 * Format description for detail modal and card views: removes (account) in parentheses
 * and arranges each customer & description vertically line-by-line.
 */
export function formatDetailKeterangan(raw?: string | null): string {
  if (!raw) return '';

  const jsonMatch = raw.match(/__ITEMS_JSON__:([\s\S]*?)__END_ITEMS_JSON__/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed && parsed.overtime_data) {
        const ov = parsed.overtime_data;
        const dayLabel = ov.tipe_hari === 'hari libur' ? 'Hari Libur' : 'Hari Kerja';
        return `[Form Lembur - ${dayLabel}] ${ov.perusahaan} - ${ov.nama_pekerjaan} (${ov.jam_lembur})\nLokasi: ${ov.lokasi_lembur}\n${ov.uraian_pekerjaan}`;
      }

      const entries: Array<{ customer?: string; description?: string }> = [];
      if (Array.isArray(parsed.blocks)) {
        parsed.blocks.forEach((b: any) => {
          if (Array.isArray(b.entries)) {
            b.entries.forEach((e: any) => entries.push(e));
          }
        });
      } else if (Array.isArray(parsed.entries)) {
        parsed.entries.forEach((e: any) => entries.push(e));
      }
      if (entries.length > 0) {
        return entries
          .map((e) => {
            const cust = (e.customer || '').trim();
            const desc = (e.description || '').replace(/^[\s•\-\*●○▪▫]+\s*/gm, '').trim();
            return cust ? `[${cust}] ${desc}` : desc;
          })
          .filter(Boolean)
          .join('\n');
      }
    } catch {
      // Fallback to text parsing
    }
  }

  const cleanRaw = raw.replace(/__ITEMS_JSON__:[\s\S]*?__END_ITEMS_JSON__\s*/, '').trim();
  const matches = [...cleanRaw.matchAll(/(?:\(([^)]*)\)\s*)?\[([^\]]*)\]\s*([^(\[]+)/g)];
  if (matches.length > 0) {
    return matches
      .map((m) => {
        const cust = m[2].trim();
        const desc = m[3].replace(/^[\s•\-\*●○▪▫]+\s*/gm, '').trim();
        return cust ? `[${cust}] ${desc}` : desc;
      })
      .filter(Boolean)
      .join('\n');
  }

  // Fallback: strip (account) and bullets
  return cleanRaw.replace(/\([^)]*\)\s*/g, '').replace(/^[\s•\-\*●○▪▫]+\s*/gm, '').trim();
}

/**
 * Normalize account name so generic parent category ("Transport", "Operasional", "account")
 * is correctly shown as "Bensin" for Petty Cash or "Material" for Voucher.
 */
export function normalizeAccount(
  acc?: string | null,
  type?: string | null
): string {
  const clean = (acc || '').trim().toLowerCase();
  if (
    !clean ||
    clean === 'transport' ||
    clean === 'operasional' ||
    clean === 'operasional lainnya' ||
    clean === 'account' ||
    clean === 'pilih account' ||
    clean === 'kategori' ||
    clean === 'lainnya'
  ) {
    return type === 'Voucher' ? 'Material' : 'Bensin';
  }
  return acc!.trim();
}