import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { StorageService } from './storage.service';
import { Customer } from '../models/customer.model';
import { Order } from '../models/order.model';
import jsPDF from 'jspdf';

@Injectable({ providedIn: 'root' })
export class PdfService {

  constructor(private storage: StorageService) {}

  // ── Public API ──────────────────────────────────────────────────

  async saveCustomerPdf(customer: Customer, orders: Order[]): Promise<void> {
    const doc = this.buildDoc(customer, orders);
    await this.savePdf(doc, this.fileName(customer));
  }

  async shareCustomerPdfOnWhatsApp(customer: Customer, orders: Order[]): Promise<void> {
    const doc = this.buildDoc(customer, orders);
    await this.shareViaWhatsApp(doc, this.fileName(customer));
  }

  async saveOrderPdf(order: Order, customer: Customer | undefined): Promise<void> {
    const doc = this.buildOrderDoc(order, customer);
    await this.savePdf(doc, `Order_${order.orderNo || order.id}.pdf`);
  }

  async shareOrderPdfOnWhatsApp(order: Order, customer: Customer | undefined): Promise<void> {
    const doc = this.buildOrderDoc(order, customer);
    await this.shareViaWhatsApp(doc, `Order_${order.orderNo || order.id}.pdf`);
  }

  // ── Single Order PDF ────────────────────────────────────────────

  private buildOrderDoc(order: Order, customer: Customer | undefined): jsPDF {
    const info   = this.storage.getTailorInfo();
    const doc    = new jsPDF({ unit: 'mm', format: 'a4' });
    const W      = 210;
    const PL     = 14;   // padding left
    const PR     = W - 14; // padding right
    const sc     = this.statusColor(order.status);
    const o: any = order;

    // ══════════════════════════════════════════════════════════════
    // HEADER
    // ══════════════════════════════════════════════════════════════
    const HDR_H = 52;

    // 1. Base layer — rich dark charcoal
    doc.setFillColor(22, 27, 48);
    doc.rect(0, 0, W, HDR_H, 'F');

    // 2. Diagonal accent band (top-right triangle effect using polygon)
    //    Simulate with overlapping rects at angle using a wide right block
    doc.setFillColor(sc[0], sc[1], sc[2]);
    // Right decorative block — tapered feel
    doc.rect(W - 52, 0, 52, HDR_H, 'F');
    // Diagonal cut: white triangle over it to create slant
    doc.setFillColor(22, 27, 48);
    // Draw a parallelogram mask using lines — approximate with filled triangle
    doc.triangle(W - 52, 0, W - 68, HDR_H, W - 52, HDR_H, 'F');

    // 3. Subtle horizontal rule inside accent block
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.15);
    doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
    doc.line(W - 50, 10, W - 4, 10);
    doc.line(W - 50, 42, W - 4, 42);
    doc.setGState(new (doc as any).GState({ opacity: 1 }));

    // 4. Shop initial circle — logo
    const initials = (info.name || 'M').charAt(0).toUpperCase();
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(255, 255, 255);
    doc.circle(PL + 10, HDR_H / 2, 9, 'F');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(sc[0], sc[1], sc[2]);
    doc.text(initials, PL + 10, HDR_H / 2 + 4.5, { align: 'center' });

    // 5. Shop name
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(info.name || 'MyTailorBook', PL + 24, HDR_H / 2 - 4);

    // 6. Tagline
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(sc[0] + 80 > 255 ? 255 : sc[0] + 80,
                     sc[1] + 80 > 255 ? 255 : sc[1] + 80,
                     sc[2] + 80 > 255 ? 255 : sc[2] + 80);
    if (info.tagline) doc.text(info.tagline.toUpperCase(), PL + 24, HDR_H / 2 + 3);

    // 7. Contact row
    doc.setFontSize(7);
    doc.setTextColor(160, 170, 195);
    const cp2: string[] = [];
    if (info.contact) cp2.push(info.contact);
    if (info.email)   cp2.push(info.email);
    if (cp2.length)   doc.text(cp2.join('   |   '), PL + 24, HDR_H / 2 + 10);

    // 8. Order number — inside accent block, right side
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.setGState(new (doc as any).GState({ opacity: 0.7 }));
    doc.text('ORDER NO', PR - 2, 14, { align: 'right' });
    doc.setGState(new (doc as any).GState({ opacity: 1 }));
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`#${o.orderNo || ''}`, PR - 2, 34, { align: 'right' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.setGState(new (doc as any).GState({ opacity: 0.6 }));
    doc.text(new Date().toLocaleDateString(), PR - 2, 44, { align: 'right' });
    doc.setGState(new (doc as any).GState({ opacity: 1 }));

    // 9. Bottom status bar
    doc.setFillColor(Math.max(0, sc[0] - 30), Math.max(0, sc[1] - 30), Math.max(0, sc[2] - 30));
    doc.rect(0, HDR_H, W, 11, 'F');

    // Status label
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(order.status.toUpperCase(), PL + 4, HDR_H + 7.5);

    // Vertical divider
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.2);
    doc.setGState(new (doc as any).GState({ opacity: 0.3 }));
    const divX = PL + 4 + doc.getTextWidth(order.status.toUpperCase()) + 6;
    doc.line(divX, HDR_H + 2, divX, HDR_H + 9);
    doc.setGState(new (doc as any).GState({ opacity: 1 }));

    // Dates
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.setGState(new (doc as any).GState({ opacity: 0.75 }));
    const dateParts: string[] = [];
    if (o.orderedDate) dateParts.push(`Order: ${o.orderedDate}`);
    if (order.dueDate) dateParts.push(`Due: ${order.dueDate}`);
    if (dateParts.length) doc.text(dateParts.join('    |    '), divX + 4, HDR_H + 7.5);
    doc.setGState(new (doc as any).GState({ opacity: 1 }));

    let y = HDR_H + 20;

    // ── Info cards row ────────────────────────────────────────────
    const cardH = 36;

    // Customer card
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(220, 228, 240);
    doc.setLineWidth(0.25);
    doc.roundedRect(PL, y, 88, cardH, 3, 3, 'FD');
    // card top accent
    doc.setFillColor(...sc);
    doc.roundedRect(PL, y, 88, 3, 1, 1, 'F');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(148, 163, 184);
    doc.text('CUSTOMER', PL + 5, y + 10);

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(customer?.name || o.customerName || '—', PL + 5, y + 19);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    let cy = y + 26;
    if (customer?.phone)            { doc.text(`Tel: ${customer.phone}`, PL + 5, cy); cy += 6; }
    if ((customer as any)?.address) { doc.text((customer as any).address, PL + 5, cy); }

    // Order info card
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(108, y, 88, cardH, 3, 3, 'FD');
    doc.setFillColor(...sc);
    doc.roundedRect(108, y, 88, 3, 1, 1, 'F');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(148, 163, 184);
    doc.text('ORDER INFO', 113, y + 10);

    const kvItems: [string, string][] = [
      ['Quantity',    `${order.quantity} pcs`],
      ...(order.price ? [['Price', `Rs. ${order.price}`] as [string, string]] : []),
      ['Dress Items', `${o.dressItems?.length || 1}`],
    ];
    kvItems.forEach(([k, v], i) => {
      const ky = y + 18 + i * 7;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(k, 113, ky);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(v, 194, ky, { align: 'right' });
    });

    y += cardH + 10;

    // ── Section heading ───────────────────────────────────────────
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(148, 163, 184);
    doc.text('DRESS ITEMS & MEASUREMENTS', PL, y);
    doc.setDrawColor(220, 228, 240);
    doc.setLineWidth(0.25);
    doc.line(PL, y + 2, PR, y + 2);
    y += 8;

    // ── Dress blocks ──────────────────────────────────────────────
    const items: any[] = o.dressItems?.length
      ? o.dressItems
      : [{ dressType: order.dressType, measurements: order.measurements }];

    items.forEach((item: any) => {
      if (y > 248) { doc.addPage(); y = 20; }

      const mEntries = Object.entries(item.measurements as Record<string, string>).filter(([, v]) => v);
      const mRows    = Math.ceil(mEntries.length / 4) || 1;
      const blockH   = 14 + mRows * 10 + 4;

      // card shadow effect (slightly larger darker rect behind)
      doc.setFillColor(210, 218, 230);
      doc.roundedRect(PL + 0.5, y + 0.5, W - 28, blockH, 3, 3, 'F');

      // card body
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(220, 228, 240);
      doc.setLineWidth(0.25);
      doc.roundedRect(PL, y, W - 28, blockH, 3, 3, 'FD');

      // left accent bar
      doc.setFillColor(...sc);
      doc.roundedRect(PL, y, 3, blockH, 1, 1, 'F');

      // header row
      doc.setDrawColor(235, 240, 248);
      doc.line(PL, y + 11, W - 14, y + 11);

      // dress type badge
      const badgeLabel = item.dressType;
      const badgeW = doc.getTextWidth(badgeLabel) * (8.5 / 10) + 12;
      doc.setFillColor(108, 99, 255);
      doc.roundedRect(PL + 6, y + 3, badgeW, 6.5, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text(badgeLabel, PL + 12, y + 8);

      // measurement count
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(`${mEntries.length} measurements`, PL + badgeW + 10, y + 8);

      // thumbnail
      if (item.imageUrl) {
        try { doc.addImage(item.imageUrl, 'JPEG', W - 26, y + 2, 10, 8); } catch {}
      }

      // measurement chips
      if (mEntries.length) {
        mEntries.forEach(([k, v], i) => {
          const col = i % 4;
          const row = Math.floor(i / 4);
          const cx  = PL + 6 + col * 46;
          const cy2 = y + 14 + row * 10;

          doc.setFillColor(245, 247, 252);
          doc.setDrawColor(220, 228, 240);
          doc.setLineWidth(0.2);
          doc.roundedRect(cx, cy2, 42, 8, 1.5, 1.5, 'FD');

          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(108, 99, 255);
          doc.text(`${v}"`, cx + 3, cy2 + 6);

          const lbl = k.toUpperCase();
          doc.setFontSize(6);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(148, 163, 184);
          doc.text(lbl, cx + 42 - doc.getTextWidth(lbl) - 2, cy2 + 6);
        });
      } else {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(148, 163, 184);
        doc.text('No measurements recorded', PL + 6, y + 19);
      }

      y += blockH + 6;
    });

    // ── Notes ─────────────────────────────────────────────────────
    if (order.notes) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFillColor(255, 251, 235);
      doc.setDrawColor(253, 230, 138);
      doc.setLineWidth(0.3);
      doc.roundedRect(PL, y, W - 28, 18, 3, 3, 'FD');
      doc.setFillColor(245, 158, 11);
      doc.roundedRect(PL, y, 3, 18, 1, 1, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(148, 163, 184);
      doc.text('NOTES', PL + 6, y + 6);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(146, 64, 14);
      doc.text(order.notes, PL + 6, y + 13);
      y += 22;
    }

    // ── Footer ────────────────────────────────────────────────────
    doc.setFillColor(10, 15, 40);
    doc.rect(0, 284, W, 13, 'F');
    doc.setFillColor(...sc);
    doc.rect(0, 284, W, 1, 'F');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(140, 155, 180);
    doc.text(`${info.name || 'MyTailorBook'}  ·  Generated ${new Date().toLocaleDateString()}`, PL, 292);

    if (order.price) {
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129);
      doc.text(`Rs. ${order.price}`, PR, 292, { align: 'right' });
    }

    return doc;
  }

  // ── Customer Orders PDF ─────────────────────────────────────────

  private buildDoc(customer: Customer, orders: Order[]): jsPDF {
    const info = this.storage.getTailorInfo();
    const doc  = new jsPDF({ unit: 'mm', format: 'a4' });
    const W    = 210;
    const PL   = 14;
    const PR   = W - 14;

    // Header
    doc.setFillColor(10, 15, 40);
    doc.rect(0, 0, W, 46, 'F');
    doc.setFillColor(108, 99, 255);
    doc.rect(0, 0, 4, 46, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22); doc.setFont('helvetica', 'bold');
    doc.text(info.name || 'MyTailorBook', PL + 6, 18);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 190, 210);
    if (info.tagline) doc.text(info.tagline, PL + 6, 25);
    doc.setFontSize(7.5); doc.setTextColor(140, 155, 180);
    const cp: string[] = [];
    if (info.contact) cp.push(info.contact);
    if (info.email)   cp.push(info.email);
    if (cp.length) doc.text(cp.join('  |  '), PL + 6, 32);

    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(140, 155, 180);
    doc.text('CUSTOMER ORDERS', PR, 16, { align: 'right' });
    doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text(customer.name, PR, 28, { align: 'right' });
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(140, 155, 180);
    if (customer.phone) doc.text(customer.phone, PR, 35, { align: 'right' });

    doc.setDrawColor(108, 99, 255); doc.setLineWidth(0.6); doc.line(0, 46, W, 46);

    // Sub-bar
    doc.setFillColor(18, 24, 52); doc.rect(0, 46, W, 10, 'F');
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(140, 155, 180);
    doc.text(`${orders.length} order${orders.length !== 1 ? 's' : ''}  ·  ${new Date().toLocaleDateString()}`, PL + 6, 52.5);

    let y = 66;

    if (orders.length === 0) {
      doc.setTextColor(100, 116, 139); doc.setFontSize(10);
      doc.text('No orders found.', PL, y);
      return doc;
    }

    orders.forEach((order, idx) => {
      if (y > 260) { doc.addPage(); y = 20; }
      const accent = this.statusColor(order.status);
      const h = this.orderCardHeight(order);

      doc.setFillColor(210, 218, 230);
      doc.roundedRect(PL + 0.5, y + 0.5, W - 28, h, 3, 3, 'F');
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(220, 228, 240); doc.setLineWidth(0.25);
      doc.roundedRect(PL, y, W - 28, h, 3, 3, 'FD');
      doc.setFillColor(...accent);
      doc.roundedRect(PL, y, 3, h, 1, 1, 'F');

      // title row
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
      doc.text(`${order.dressType}`, PL + 8, y + 7);

      // status pill
      const slabel = order.status;
      const sw = doc.getTextWidth(slabel) * (7 / 10) + 8;
      doc.setFillColor(...accent);
      doc.roundedRect(PR - sw - 2, y + 2, sw, 6, 2, 2, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.text(slabel, PR - sw / 2 - 2, y + 6.5, { align: 'center' });

      // meta
      y += 10;
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
      const meta: string[] = [];
      if ((order as any).orderedDate) meta.push(`Date: ${(order as any).orderedDate}`);
      if (order.dueDate)  meta.push(`Due: ${order.dueDate}`);
      if (order.price)    meta.push(`Rs. ${order.price}`);
      if (order.quantity) meta.push(`Qty: ${order.quantity}`);
      if (meta.length) { doc.text(meta.join('   ·   '), PL + 8, y); y += 6; }

      // measurements
      const mEntries = Object.entries(order.measurements).filter(([, v]) => v);
      if (mEntries.length) {
        mEntries.forEach(([k, v], i) => {
          const col = i % 4, row = Math.floor(i / 4);
          const mx = PL + 8 + col * 44, my = y + row * 8;
          doc.setFillColor(245, 247, 252); doc.setDrawColor(220, 228, 240); doc.setLineWidth(0.2);
          doc.roundedRect(mx, my - 4, 40, 7, 1.5, 1.5, 'FD');
          doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(108, 99, 255);
          doc.text(`${v}"`, mx + 3, my + 1);
          doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184);
          const lbl = k.toUpperCase();
          doc.text(lbl, mx + 40 - doc.getTextWidth(lbl) - 2, my + 1);
        });
        y += Math.ceil(mEntries.length / 4) * 8 + 2;
      }

      if (order.notes) {
        doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(100, 116, 139);
        doc.text(`Notes: ${order.notes}`, PL + 8, y); y += 5;
      }

      y += 8;
    });

    // Footer
    doc.setFillColor(10, 15, 40); doc.rect(0, 284, W, 13, 'F');
    doc.setFillColor(108, 99, 255); doc.rect(0, 284, W, 1, 'F');
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(140, 155, 180);
    doc.text(`${info.name || 'MyTailorBook'}  ·  Generated ${new Date().toLocaleDateString()}`, PL, 292);

    return doc;
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private orderCardHeight(order: Order): number {
    const mRows = Math.ceil(Object.values(order.measurements).filter(v => v).length / 4);
    return 16 + (mRows * 8 + 2) + (order.notes ? 6 : 0) + 6;
  }

  private statusColor(status: string): [number, number, number] {
    const map: Record<string, [number, number, number]> = {
      'Pending':     [245, 158, 11],
      'In Progress': [108, 99,  255],
      'Ready':       [16,  185, 129],
      'Delivered':   [148, 163, 184],
    };
    return map[status] || [108, 99, 255];
  }

  private async savePdf(doc: jsPDF, fileName: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      const base64 = doc.output('datauristring').split(',')[1];
      await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Documents, recursive: true });
      alert(`PDF saved to Documents/${fileName}`);
    } else {
      doc.save(fileName);
    }
  }

  private async shareViaWhatsApp(doc: jsPDF, fileName: string): Promise<void> {
    const base64 = doc.output('datauristring').split(',')[1];
    const result = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache, recursive: true });
    await Share.share({ title: fileName, url: result.uri, dialogTitle: 'Share via WhatsApp' });
  }

  private fileName(customer: Customer): string {
    return `${customer.name.replace(/\s+/g, '_')}_orders.pdf`;
  }
}
