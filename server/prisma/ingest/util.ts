/**
 * Shared helpers for dataset ingest scripts.
 *
 * Two jobs: fetch-and-cache a remote dataset to a local gitignored folder, and
 * parse CSV without pulling in a dependency.
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Where downloaded source data lives. Gitignored on purpose: some upstream
 * mirrors carry no licence, so redistributing their files inside this repo
 * would not be permissible. See ATTRIBUTIONS.md.
 */
export const DATA_DIR = join(here, 'data');

/**
 * Return a local path for `fileName`, downloading from `url` on first use.
 *
 * After the first run the ingest works entirely offline, which matters for a
 * live demo on untrusted conference wifi.
 */
export async function cachedDownload(url: string, fileName: string): Promise<string> {
  mkdirSync(DATA_DIR, { recursive: true });
  const target = join(DATA_DIR, fileName);

  if (existsSync(target) && statSync(target).size > 0) {
    console.log(`[ingest] using cached ${fileName} (${(statSync(target).size / 1024).toFixed(0)} KB)`);
    return target;
  }

  console.log(`[ingest] downloading ${fileName} from ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `[ingest] download failed (${res.status} ${res.statusText}) for ${url}\n` +
        `Place the file manually at: ${target}`,
    );
  }
  if (!res.body) throw new Error(`[ingest] empty response body for ${url}`);

  // Stream to disk rather than buffering: keeps memory flat for large files.
  await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(target));

  const size = statSync(target).size;
  if (size === 0) throw new Error(`[ingest] wrote a 0-byte file for ${fileName}`);
  console.log(`[ingest] saved ${fileName} (${(size / 1024).toFixed(0)} KB)`);
  return target;
}

/**
 * Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped double
 * quotes, and CRLF. Returns rows of raw strings.
 *
 * The Census file we read has no quoted fields today, but a naive `split(',')`
 * would corrupt silently the moment a district name contains a comma, and a
 * silent data corruption is far worse than twenty lines of parser.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      // Skip blank trailing lines.
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else if (ch !== '\r') {
      field += ch;
    }
  }

  // Flush a final line with no trailing newline.
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }

  return rows;
}

/** Read and parse a local CSV file. */
export function readCsv(path: string): string[][] {
  return parseCsv(readFileSync(path, 'utf8'));
}

/**
 * Build a column-name to index map from a header row, so downstream code refers
 * to columns by name. Index-based access breaks invisibly if the upstream file
 * ever reorders or inserts a column.
 */
export function headerIndex(header: string[]): Map<string, number> {
  const map = new Map<string, number>();
  header.forEach((name, i) => map.set(name.trim(), i));
  return map;
}

/** Parse an integer, returning null for blank or non-numeric input. */
export function int(raw: string | undefined): number | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * A share of a whole, expressed 0..100 and clamped.
 *
 * Returns null when the denominator is missing or zero, so "unknown" never
 * silently becomes 0% and gets ranked as though it were perfect coverage.
 */
export function pct(part: number | null, whole: number | null): number | null {
  if (part == null || whole == null || whole <= 0) return null;
  return Math.min(100, Math.max(0, (part / whole) * 100));
}

/** The complement of `pct`: the share *lacking* something. */
export function deprivationPct(have: number | null, whole: number | null): number | null {
  const p = pct(have, whole);
  return p == null ? null : 100 - p;
}

/** Title-case a SHOUTED state name: "JAMMU AND KASHMIR" -> "Jammu And Kashmir". */
export function titleCase(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}
