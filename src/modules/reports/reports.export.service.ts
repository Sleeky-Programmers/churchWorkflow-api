import { Parser } from 'json2csv';

import { BadRequestException, Injectable } from '@nestjs/common';

import { ReportBundle } from './reports.service';
import { ReportMetric, SectionResult } from './reports.types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ExcelJS = require('exceljs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');

const INK = '#1f2933';
const MUTED = '#6b7280';
const BRAND = '#0C5FB3';
const BRAND_SOFT = '#dbeafe';
const RULE = '#e5e7eb';

export function formatValue(
  value: number,
  format: ReportMetric['format'],
  currency?: string,
): string {
  if (format === 'percent') {
    return `${(Math.round(value * 10) / 10).toLocaleString('en-US')}%`;
  }
  if (format === 'currency') {
    if (currency) {
      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
        }).format(value);
      } catch {
        return `${currency} ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
      }
    }
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

function changeText(m: ReportMetric): string {
  if (m.previous === undefined) {
    return '';
  }
  if (m.changePct === null || m.changePct === undefined) {
    return m.value > 0 ? 'New' : '-';
  }
  return `${m.changePct > 0 ? '+' : ''}${m.changePct}%`;
}

@Injectable()
export class ReportsExportService {
  fileName(bundle: ReportBundle, ext: string): string {
    const safe = (s: string) => {
      return s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    };
    return `${safe(bundle.churchName)}-report-${bundle.range.startStr}-to-${bundle.range.endStr}.${ext}`;
  }

  // ------------------------------------------------------------------
  // Excel
  // ------------------------------------------------------------------

  async toXlsx(bundle: ReportBundle): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Church Workflow';
    workbook.created = bundle.generatedAt;

    const summary = workbook.addWorksheet('Summary');
    summary.columns = [
      { width: 26 },
      { width: 40 },
      { width: 18 },
      { width: 18 },
      { width: 14 },
    ];
    summary.addRow([bundle.churchName]).font = { bold: true, size: 16 };
    summary.addRow([bundle.title]).font = { bold: true, size: 12 };
    summary.addRow([`Branches: ${bundle.scopeLabel}`]);
    summary.addRow([`Compared with: ${bundle.previousRange.label}`]);
    summary.addRow([`Generated: ${bundle.generatedAt.toUTCString()}`]);
    summary.addRow([]);

    const header = summary.addRow([
      'Section',
      'Measure',
      'This period',
      'Previous',
      'Change',
    ]);
    this.styleHeader(header);

    for (const section of bundle.sections) {
      for (const m of section.metrics) {
        const row = summary.addRow([
          section.title,
          m.label,
          m.value,
          m.previous ?? '',
          changeText(m),
        ]);
        const fmt = this.numFmt(m);
        row.getCell(3).numFmt = fmt;
        row.getCell(4).numFmt = fmt;
        row.getCell(5).alignment = { horizontal: 'right' };
      }
    }

    for (const section of bundle.sections) {
      const sheet = workbook.addWorksheet(section.title.slice(0, 31));
      sheet.columns = [
        { width: 34 },
        { width: 18 },
        { width: 18 },
        { width: 14 },
      ];
      sheet.addRow([section.title]).font = { bold: true, size: 14 };
      sheet.addRow([bundle.range.label]);
      sheet.addRow([]);

      this.styleHeader(
        sheet.addRow(['Measure', 'This period', 'Previous', 'Change']),
      );
      for (const m of section.metrics) {
        const row = sheet.addRow([
          m.label,
          m.value,
          m.previous ?? '',
          changeText(m),
        ]);
        const fmt = this.numFmt(m);
        row.getCell(2).numFmt = fmt;
        row.getCell(3).numFmt = fmt;
        row.getCell(4).alignment = { horizontal: 'right' };
      }

      for (const b of section.breakdowns) {
        sheet.addRow([]);
        this.styleHeader(sheet.addRow([b.label, 'Amount']));
        for (const item of b.items) {
          const row = sheet.addRow([item.label, item.value]);
          row.getCell(2).numFmt = this.numFmt({
            format: b.format,
          } as ReportMetric);
        }
      }

      if (section.series.length) {
        sheet.addRow([]);
        this.styleHeader(
          sheet.addRow([
            'Date',
            ...section.series.map((s) => {
              return s.label;
            }),
          ]),
        );
        const days = section.series[0].points.map((p) => {
          return p.label;
        });
        days.forEach((day, i) => {
          sheet.addRow([
            day,
            ...section.series.map((s) => {
              return s.points[i]?.value ?? 0;
            }),
          ]);
        });
        sheet.columns.forEach((_c: unknown, idx: number) => {
          if (idx > 0) {
            sheet.getColumn(idx + 1).width = 22;
          }
        });
      }

      for (const note of section.notes) {
        sheet.addRow([]);
        sheet.addRow([note]).font = {
          italic: true,
          color: { argb: 'FF6B7280' },
        };
      }
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private styleHeader(row: any) {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.eachCell((cell: any) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0C5FB3' },
      };
    });
  }

  private numFmt(m: Pick<ReportMetric, 'format'>): string {
    if (m.format === 'currency') {
      return '#,##0.00';
    }
    if (m.format === 'percent') {
      return '0.0"%"';
    }
    return '#,##0.##';
  }

  // ------------------------------------------------------------------
  // CSV (one section at a time)
  // ------------------------------------------------------------------

  toCsv(bundle: ReportBundle, sectionKey?: string): string {
    const section = sectionKey
      ? bundle.sections.find((s) => {
          return s.key === sectionKey;
        })
      : bundle.sections.length === 1
        ? bundle.sections[0]
        : undefined;

    if (!section) {
      throw new BadRequestException(
        'CSV exports one section at a time. Choose a single section, or use Excel or PDF for the full report.',
      );
    }

    const rows = section.metrics.map((m) => {
      return {
        Measure: m.label,
        'This period': m.value,
        Previous: m.previous ?? '',
        Change: changeText(m),
      };
    });
    return new Parser({
      fields: ['Measure', 'This period', 'Previous', 'Change'],
    }).parse(rows);
  }

  // ------------------------------------------------------------------
  // PDF
  // ------------------------------------------------------------------

  toPdf(bundle: ReportBundle): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 48,
        bufferPages: true,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => {
        return chunks.push(c);
      });
      doc.on('end', () => {
        return resolve(Buffer.concat(chunks));
      });
      doc.on('error', reject);

      const left = doc.page.margins.left;
      const width = doc.page.width - left - doc.page.margins.right;

      // Cover band
      doc.rect(0, 0, doc.page.width, 110).fill(BRAND);
      doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold');
      doc.text(bundle.churchName, left, 34, { width });
      doc.fontSize(12).font('Helvetica');
      doc.text(bundle.title, left, 62, { width });
      doc
        .fontSize(9)
        .text(
          `${bundle.scopeLabel}  |  Compared with ${bundle.previousRange.label}`,
          left,
          84,
          { width },
        );
      doc.y = 130;

      for (const section of bundle.sections) {
        this.pdfSection(doc, section, left, width);
      }

      // Footer on every page
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.fontSize(8).fillColor(MUTED).font('Helvetica');
        doc.text(
          `Church Workflow  |  Generated ${bundle.generatedAt.toUTCString()}  |  Page ${i + 1} of ${range.count}`,
          left,
          doc.page.height - 34,
          { width, align: 'center', lineBreak: false },
        );
      }

      doc.end();
    });
  }

  private ensureSpace(doc: any, needed: number) {
    if (doc.y + needed > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      doc.y = doc.page.margins.top;
    }
  }

  private pdfSection(
    doc: any,
    section: SectionResult,
    left: number,
    width: number,
  ) {
    this.ensureSpace(doc, 120);

    doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(14);
    doc.text(section.title, left, doc.y, { width });
    doc
      .moveTo(left, doc.y + 2)
      .lineTo(left + width, doc.y + 2)
      .strokeColor(RULE)
      .stroke();
    doc.y += 10;

    // Metric table
    const colValue = left + width * 0.55;
    const colPrev = left + width * 0.72;
    const colChange = left + width * 0.88;
    doc.fontSize(8).fillColor(MUTED).font('Helvetica-Bold');
    const headY = doc.y;
    doc.text('MEASURE', left, headY, { lineBreak: false });
    doc.text('THIS PERIOD', colValue, headY, { lineBreak: false });
    doc.text('PREVIOUS', colPrev, headY, { lineBreak: false });
    doc.text('CHANGE', colChange, headY, { lineBreak: false });
    doc.y = headY + 14;

    for (const m of section.metrics) {
      this.ensureSpace(doc, 20);
      const y = doc.y;
      doc.fontSize(10).fillColor(INK).font('Helvetica');
      doc.text(m.label, left, y, { width: width * 0.5, lineBreak: false });
      doc
        .font('Helvetica-Bold')
        .text(formatValue(m.value, m.format, m.currency), colValue, y, {
          lineBreak: false,
        });
      doc.font('Helvetica').fillColor(MUTED);
      doc.text(
        m.previous === undefined
          ? ''
          : formatValue(m.previous, m.format, m.currency),
        colPrev,
        y,
        { lineBreak: false },
      );
      const change = changeText(m);
      const up = (m.changePct ?? 0) > 0;
      const down = (m.changePct ?? 0) < 0;
      doc
        .fillColor(up ? '#15803d' : down ? '#b91c1c' : MUTED)
        .text(change, colChange, y, { lineBreak: false });
      doc.y = y + 17;
    }

    // Trend chart for the first series with any activity
    const series = section.series.find((s) => {
      return s.points.some((p) => {
        return p.value > 0;
      });
    });
    if (series) {
      this.ensureSpace(doc, 130);
      doc.y += 6;
      doc
        .fontSize(9)
        .fillColor(INK)
        .font('Helvetica-Bold')
        .text(series.label, left, doc.y, { width });
      doc.y += 4;
      this.drawBars(doc, series.points, left, doc.y, width, 90);
      doc.y += 100;
    }

    // First breakdown as horizontal bars
    const bd = section.breakdowns.find((b) => {
      return b.items.some((i) => {
        return i.value > 0;
      });
    });
    if (bd) {
      const rows = bd.items.slice(0, 6);
      this.ensureSpace(doc, 24 + rows.length * 16);
      doc.y += 4;
      doc
        .fontSize(9)
        .fillColor(INK)
        .font('Helvetica-Bold')
        .text(bd.label, left, doc.y, { width });
      doc.y += 4;
      this.drawHBars(doc, rows, bd, left, doc.y, width);
    }

    for (const note of section.notes) {
      this.ensureSpace(doc, 16);
      doc
        .fontSize(8)
        .fillColor(MUTED)
        .font('Helvetica-Oblique')
        .text(note, left, doc.y + 2, { width });
    }

    doc.y += 22;
  }

  private drawBars(
    doc: any,
    points: { label: string; value: number }[],
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const max = Math.max(
      ...points.map((p) => {
        return p.value;
      }),
      1,
    );
    const gap = points.length > 14 ? 1 : 4;
    const barW = Math.max((w - gap * (points.length - 1)) / points.length, 1);

    doc
      .moveTo(x, y + h)
      .lineTo(x + w, y + h)
      .strokeColor(RULE)
      .stroke();
    points.forEach((p, i) => {
      const bh = (p.value / max) * (h - 12);
      doc.rect(x + i * (barW + gap), y + h - bh, barW, bh).fill(BRAND);
    });

    // Axis labels: first, middle and last date
    doc.fontSize(7).fillColor(MUTED).font('Helvetica');
    const labelAt = (i: number, align: 'left' | 'center' | 'right') => {
      const p = points[i];
      if (!p) {
        return;
      }
      const text = p.label.slice(5);
      const tx = x + i * (barW + gap);
      doc.text(
        text,
        align === 'left' ? x : align === 'right' ? x + w - 40 : tx - 10,
        y + h + 3,
        { width: 40, align, lineBreak: false },
      );
    };
    labelAt(0, 'left');
    if (points.length > 2) {
      labelAt(Math.floor(points.length / 2), 'center');
    }
    labelAt(points.length - 1, 'right');
    doc
      .fontSize(7)
      .fillColor(MUTED)
      .text(`Peak ${max.toLocaleString('en-US')}`, x + w - 80, y - 8, {
        width: 80,
        align: 'right',
        lineBreak: false,
      });
  }

  private drawHBars(
    doc: any,
    rows: { label: string; value: number }[],
    bd: { format: ReportMetric['format']; currency?: string },
    x: number,
    y: number,
    w: number,
  ) {
    const max = Math.max(
      ...rows.map((r) => {
        return r.value;
      }),
      1,
    );
    const labelW = w * 0.3;
    const valueW = w * 0.2;
    const barMax = w - labelW - valueW - 8;

    rows.forEach((r, i) => {
      const ry = y + i * 16;
      doc.fontSize(9).fillColor(INK).font('Helvetica');
      doc.text(String(r.label).slice(0, 28), x, ry + 2, {
        width: labelW,
        lineBreak: false,
      });
      doc.rect(x + labelW, ry + 2, barMax, 9).fill(BRAND_SOFT);
      doc
        .rect(x + labelW, ry + 2, Math.max((r.value / max) * barMax, 1), 9)
        .fill(BRAND);
      doc
        .fillColor(INK)
        .text(
          formatValue(r.value, bd.format, bd.currency),
          x + labelW + barMax + 8,
          ry + 2,
          { width: valueW, align: 'right', lineBreak: false },
        );
    });
    doc.y = y + rows.length * 16;
  }
}
