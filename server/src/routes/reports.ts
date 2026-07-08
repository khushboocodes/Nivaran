/**
 * Reports (tasks 3.5, 3.6).
 *
 *   GET /api/reports?type=...&days=...&format=json|csv|pdf
 *
 * type ∈ {category, priority, status, department}
 * days ∈ {7, 30, 90, 365} (capped server-side)
 *
 * Officers/admins only. Citizens are forbidden — the dataset is global
 * and they shouldn't see other users' complaints.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { prisma } from '../db';
import { getUser } from '../auth/middleware';

const reports = new Hono();

const Query = z.object({
  type: z.enum(['category', 'priority', 'status', 'department']).default('category'),
  days: z.coerce.number().int().positive().max(3650).default(30),
  format: z.enum(['json', 'csv', 'pdf']).default('json'),
});

interface ReportRow {
  key: string;
  count: number;
}

async function buildReport(
  type: 'category' | 'priority' | 'status' | 'department',
  days: number,
): Promise<{
  rows: ReportRow[];
  totals: { total: number; resolved: number; resolutionRate: number };
}> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where = { submittedAt: { gte: cutoff } };

  let rows: ReportRow[];
  if (type === 'department') {
    // GroupBy on FK; resolve names in a follow-up query so the response is
    // human-readable.
    const grouped = await prisma.complaint.groupBy({
      by: ['departmentId'],
      where,
      _count: { _all: true },
    });
    const departments = await prisma.department.findMany({
      where: { id: { in: grouped.map((g) => g.departmentId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(departments.map((d) => [d.id, d.name] as const));
    rows = grouped.map((g) => ({
      key: nameById.get(g.departmentId) ?? g.departmentId,
      count: g._count._all,
    }));
  } else {
    const grouped = await prisma.complaint.groupBy({
      by: [type],
      where,
      _count: { _all: true },
    });
    rows = grouped.map((g) => ({
      key: String((g as Record<string, unknown>)[type]),
      count: g._count._all,
    }));
  }

  rows.sort((a, b) => b.count - a.count);

  const total = rows.reduce((acc, r) => acc + r.count, 0);
  const resolved = await prisma.complaint.count({
    where: { ...where, status: 'Resolved' },
  });
  const resolutionRate = total > 0 ? resolved / total : 0;

  return { rows, totals: { total, resolved, resolutionRate } };
}

reports.get('/', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);
  if (user.role === 'citizen') return c.json({ code: 'forbidden' }, 403);

  const parsed = Query.safeParse(
    Object.fromEntries(new URL(c.req.url).searchParams),
  );
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }
  const { type, days, format } = parsed.data;

  const { rows, totals } = await buildReport(type, days);

  if (format === 'json') {
    return c.json({ type, days, ...totals, rows });
  }

  if (format === 'csv') {
    const escape = (v: string | number) => {
      const s = String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const header = `# Nivaran report (${type}, last ${days} days)\nKey,Count\n`;
    const body = rows.map((r) => `${escape(r.key)},${escape(r.count)}`).join('\n');
    const totalsLine = `\n,Total: ${totals.total}\n,Resolved: ${totals.resolved}\n,Resolution rate: ${(totals.resolutionRate * 100).toFixed(1)}%\n`;
    const filename = `nivaran-${type}-${days}d.csv`;
    return new Response(header + body + totalsLine, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  // PDF
  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title block
    doc.fontSize(20).fillColor('#0F172A').text('Nivaran Report', { align: 'left' });
    doc.moveDown(0.3);
    doc
      .fontSize(11)
      .fillColor('#64748B')
      .text(
        `Group by: ${type}    Window: last ${days} days    Generated: ${new Date().toISOString()}`,
      );
    doc.moveDown(1.2);

    // Totals strip
    doc.fontSize(11).fillColor('#0F172A');
    doc.text(`Total complaints: ${totals.total}`);
    doc.text(`Resolved: ${totals.resolved}`);
    doc.text(`Resolution rate: ${(totals.resolutionRate * 100).toFixed(1)}%`);
    doc.moveDown(1);

    // Table header
    doc.fillColor('#0F172A').fontSize(12).text('Breakdown', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);

    if (rows.length === 0) {
      doc.fillColor('#64748B').text('No complaints in this window.');
    } else {
      const maxCount = Math.max(1, ...rows.map((r) => r.count));
      for (const row of rows) {
        const ratio = row.count / maxCount;
        const y = doc.y;
        doc.fillColor('#0F172A').text(`${row.key}`, 48, y, { width: 280 });
        doc.fillColor('#64748B').text(String(row.count), 340, y, { width: 50, align: 'right' });
        // Bar
        const barX = 400;
        const barW = 140;
        const barY = y + 4;
        doc.lineWidth(8).strokeColor('#E5EAF3').moveTo(barX, barY).lineTo(barX + barW, barY).stroke();
        doc
          .lineWidth(8)
          .strokeColor('#2F5BFF')
          .moveTo(barX, barY)
          .lineTo(barX + Math.max(1, barW * ratio), barY)
          .stroke();
        doc.moveDown(0.7);
      }
    }

    doc.end();
  });

  const filename = `nivaran-${type}-${days}d.pdf`;
  // pdfkit returns a Node Buffer; coerce its underlying ArrayBuffer for the
  // Web `Response` body. The slice keeps just the populated bytes.
  const ab = pdfBuffer.buffer.slice(
    pdfBuffer.byteOffset,
    pdfBuffer.byteOffset + pdfBuffer.byteLength,
  ) as ArrayBuffer;
  return new Response(ab, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});

export default reports;
