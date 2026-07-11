import JSZip from 'jszip';

/**
 * Parses the committee's monthly prayer timetable documents (.docx or .pdf)
 * into prayer_times rows. Logic verified against the real July 2026 DOCX and
 * June 2026 PDF (31 + 30 days, zero warnings).
 *
 * Document conventions handled:
 * - Columns: day, hijri, Fajr start/jamat, sunrise, Dhuhr start/jamat,
 *   Asr start/jamat, Maghrib (single), Isha start/jamat
 * - EMPTY jamat cells mean "unchanged from the previous day" (carried forward)
 * - Maghrib iqamah equals Maghrib begins at WCM
 * - PDFs fragment text into character runs; cells are re-stitched by x-gap
 */

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

export interface ParsedDay {
  date: string;
  fajr_begins: string;
  fajr_iqamah: string;
  sunrise: string;
  zuhr_begins: string;
  zuhr_iqamah: string;
  asr_begins: string;
  asr_iqamah: string;
  maghrib_begins: string;
  maghrib_iqamah: string;
  isha_begins: string;
  isha_iqamah: string;
}

export interface ImportResult {
  month: string | null;
  days: ParsedDay[];
  warnings: string[];
}

function to24h(t: string): string | null {
  const m = String(t).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = Number(m[1]);
  if (/pm/i.test(m[3]!) && h !== 12) h += 12;
  if (/am/i.test(m[3]!) && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

/** whitespace-proof: PDFs fragment words ("Ju ne 20 26") */
function detectMonth(text: string): string | null {
  const flat = text.toLowerCase().replace(/\s+/g, '');
  const m = flat.match(new RegExp(`prayertimetablefor(${MONTHS.join('|')})(\\d{4})?`));
  if (!m) return null;
  const idx = MONTHS.indexOf(m[1]!);
  let year = m[2] ? Number(m[2]) : null;
  if (year == null) {
    // no year in document: pick the occurrence nearest to now (± 6 months)
    const now = new Date();
    year = now.getFullYear();
    const diff = idx - now.getMonth();
    if (diff < -6) year += 1;
    if (diff > 6) year -= 1;
  }
  return `${year}-${String(idx + 1).padStart(2, '0')}`;
}

const DOW = /^(\d{1,2})\s*(MON|TUE|WED|THR|THU|FRI|SAT|SUN)/i;

interface RawRow {
  day: number;
  /** [fajr_b, fajr_i, sunrise, zuhr_b, zuhr_i, asr_b, asr_i, maghrib, isha_b, isha_i] */
  cells: (string | null)[];
}

async function parseDocx(buf: ArrayBuffer): Promise<{ month: string | null; rows: RawRow[] }> {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml')!.async('string');
  // join text runs with NO separator: Word splits times across runs ("2:4"+"9 AM")
  const month = detectMonth(xml.replace(/<[^>]+>/g, ''));
  const rows: RawRow[] = [];
  for (const tr of xml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []) {
    const cells = (tr.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) ?? []).map((tc) =>
      (tc.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [])
        .map((t) => t.replace(/<[^>]+>/g, ''))
        .join('')
        .trim(),
    );
    const di = cells.findIndex((c) => DOW.test(c));
    if (di === -1 || cells.length < di + 12) continue;
    const day = Number(cells[di]!.match(/^(\d{1,2})/)![1]);
    rows.push({ day, cells: cells.slice(di + 2, di + 12).map((c) => (c ? to24h(c) : null)) });
  }
  return { month, rows };
}

async function parsePdf(buf: ArrayBuffer): Promise<{ month: string | null; rows: RawRow[] }> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  let fullText = '';
  const lineMap = new Map<number, { x: number; w: number; str: string }[]>();
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    for (const item of content.items) {
      const it = item as { str: string; width?: number; transform: number[] };
      if (!it.str?.trim()) continue;
      fullText += it.str + ' ';
      const y = Math.round(it.transform[5]!);
      let bucket: number | null = null;
      for (const k of lineMap.keys()) if (Math.abs(k - y) <= 2) { bucket = k; break; }
      if (bucket == null) { bucket = y; lineMap.set(y, []); }
      lineMap.get(bucket)!.push({ x: it.transform[4]!, w: it.width ?? 0, str: it.str });
    }
  }
  const month = detectMonth(fullText);
  const dayRows: { day: number; times: { x: number; t: string }[] }[] = [];
  for (const items of lineMap.values()) {
    items.sort((a, b) => a.x - b.x);
    // stitch character fragments into cells: horizontal gap < 6pt = same cell
    const cells: { x: number; end: number; text: string }[] = [];
    let cur: { x: number; end: number; text: string } | null = null;
    for (const it of items) {
      if (cur && it.x - cur.end < 6) {
        cur.text += it.str;
        cur.end = it.x + it.w;
      } else {
        cur = { x: it.x, end: it.x + it.w, text: it.str };
        cells.push(cur);
      }
    }
    const first = cells[0]?.text ?? '';
    const second = cells[1]?.text ?? '';
    const m =
      DOW.exec(first) ??
      (/^\s*\d{1,2}\s*$/.test(first) && /^(MON|TUE|WED|THR|THU|FRI|SAT|SUN)/i.test(second)
        ? [first, first.trim()]
        : null);
    if (!m) continue;
    const day = Number(m[1]);
    const times = cells
      .map((c) => ({ x: c.x, t: to24h(c.text) }))
      .filter((c): c is { x: number; t: string } => c.t != null);
    dayRows.push({ day, times });
  }
  if (dayRows.length === 0) return { month, rows: [] };
  // column centres from the fullest row (day 1 lists all 10 columns)
  const ref = dayRows.reduce((b, r) => (r.times.length > b.times.length ? r : b), dayRows[0]!);
  if (ref.times.length !== 10) {
    throw new Error(`Could not find a complete 10-column row in the PDF (best had ${ref.times.length}).`);
  }
  const centres = ref.times.map((t) => t.x);
  const rows = dayRows.map((r) => {
    const cells: (string | null)[] = Array(10).fill(null);
    for (const t of r.times) {
      let ci = 0;
      for (let i = 1; i < 10; i++) {
        if (Math.abs(t.x - centres[i]!) < Math.abs(t.x - centres[ci]!)) ci = i;
      }
      cells[ci] = t.t;
    }
    return { day: r.day, cells };
  });
  return { month, rows };
}

function assemble(month: string, rows: RawRow[]): { days: ParsedDay[]; warnings: string[] } {
  const warnings: string[] = [];
  const byDay = new Map<number, RawRow>();
  for (const r of rows) if (!byDay.has(r.day)) byDay.set(r.day, r);
  const days: ParsedDay[] = [];
  let prev: ParsedDay | null = null;
  for (const day of [...byDay.keys()].sort((a, b) => a - b)) {
    const [fb, fi, sr, zb, zi, ab, ai, mg, ib, ii] = byDay.get(day)!.cells;
    const row: Record<string, string | null> = {
      date: `${month}-${String(day).padStart(2, '0')}`,
      fajr_begins: fb ?? null,
      sunrise: sr ?? null,
      zuhr_begins: zb ?? null,
      asr_begins: ab ?? null,
      maghrib_begins: mg ?? null,
      maghrib_iqamah: mg ?? null,
      isha_begins: ib ?? null,
      // empty jamat cells = unchanged from previous day
      fajr_iqamah: fi ?? prev?.fajr_iqamah ?? null,
      zuhr_iqamah: zi ?? prev?.zuhr_iqamah ?? null,
      asr_iqamah: ai ?? prev?.asr_iqamah ?? null,
      isha_iqamah: ii ?? prev?.isha_iqamah ?? null,
    };
    for (const [k, v] of Object.entries(row)) {
      if (v == null) warnings.push(`${row.date}: could not read ${k.replace('_', ' ')}`);
    }
    const parsed = row as unknown as ParsedDay;
    days.push(parsed);
    prev = parsed;
  }
  return { days, warnings };
}

export async function parseTimetableDocument(file: File): Promise<ImportResult> {
  const buf = await file.arrayBuffer();
  const name = file.name.toLowerCase();
  const { month, rows } = name.endsWith('.docx')
    ? await parseDocx(buf)
    : name.endsWith('.pdf')
      ? await parsePdf(buf)
      : (() => { throw new Error('Please choose a .docx or .pdf file.'); })();
  if (rows.length === 0) throw new Error('No timetable rows found in the document.');
  const resolvedMonth = month ?? detectMonth(file.name) ?? null;
  if (!resolvedMonth) {
    return { month: null, days: [], warnings: ['Could not detect the month — pick it below and re-import.'] };
  }
  const { days, warnings } = assemble(resolvedMonth, rows);
  return { month: resolvedMonth, days, warnings };
}
