import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { StorageService } from './storage.service';
import { Customer } from '../models/customer.model';
import { Order } from '../models/order.model';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Injectable({ providedIn: 'root' })
export class PdfService {

  constructor(private storage: StorageService) {}

  async saveOrderPdf(order: Order, customer: Customer | undefined): Promise<void> {
    const doc = await this.htmlToJsPdf(this.buildOrderHtml(order, customer));
    await this.savePdf(doc, `Order_${order.orderNo || order.id}.pdf`);
  }

  async shareOrderPdfOnWhatsApp(order: Order, customer: Customer | undefined): Promise<void> {
    const doc = await this.htmlToJsPdf(this.buildOrderHtml(order, customer));
    await this.shareViaWhatsApp(doc, `Order_${order.orderNo || order.id}.pdf`);
  }

  async saveCustomerPdf(customer: Customer, orders: Order[]): Promise<void> {
    const doc = await this.htmlToJsPdf(this.buildCustomerHtml(customer, orders));
    await this.savePdf(doc, `${customer.name.replace(/\s+/g, '_')}_orders.pdf`);
  }

  async shareCustomerPdfOnWhatsApp(customer: Customer, orders: Order[]): Promise<void> {
    const doc = await this.htmlToJsPdf(this.buildCustomerHtml(customer, orders));
    await this.shareViaWhatsApp(doc, `${customer.name.replace(/\s+/g, '_')}_orders.pdf`);
  }

  // ── HTML → jsPDF ────────────────────────────────────────────────

  private async htmlToJsPdf(html: string): Promise<jsPDF> {
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;overflow:hidden;';
    container.innerHTML = html;
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 794,
        windowWidth: 794,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdfW    = 210;
      const pdfH    = (canvas.height * pdfW) / canvas.width;
      const doc     = new jsPDF({ unit: 'mm', format: [pdfW, pdfH] });
      doc.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
      return doc;
    } finally {
      document.body.removeChild(container);
    }
  }

  // ── Order HTML ──────────────────────────────────────────────────

  private buildOrderHtml(order: Order, customer: Customer | undefined): string {
    const info    = this.storage.getTailorInfo();
    const o: any  = order;
    const sc      = this.statusColorHex(order.status);
    const scLight = this.statusColorLight(order.status);
    const items: any[] = o.dressItems?.length
      ? o.dressItems
      : [{ dressType: order.dressType, measurements: order.measurements }];

    const dressBlocks = items.map((item: any) => {
      const mEntries = Object.entries(item.measurements as Record<string, string>).filter(([, v]) => v);
      const chips = mEntries.map(([k, v]) => `
        <div style="display:flex;flex-direction:column;align-items:center;background:#f5f7fc;
          border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;min-width:70px;">
          <span style="font-size:16px;font-weight:800;color:#6c63ff;line-height:1.2">${v}"</span>
          <span style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-top:2px">${k}</span>
        </div>`).join('');

      const thumb = item.imageUrl
        ? `<img src="${item.imageUrl}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;flex-shrink:0"/>`
        : '';

      return `
        <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
            ${thumb}
            <div>
              <span style="display:inline-block;background:linear-gradient(135deg,#6c63ff,#a78bfa);
                color:#fff;font-size:11px;font-weight:800;padding:3px 12px;border-radius:20px">${item.dressType}</span>
              <div style="font-size:10px;color:#94a3b8;margin-top:3px">${mEntries.length} measurements</div>
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;padding:12px 14px;">
            ${chips || '<span style="font-size:11px;color:#94a3b8;font-style:italic">No measurements recorded</span>'}
          </div>
        </div>`;
    }).join('');

    const notesBlock = order.notes ? `
      <div style="background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;
        border-radius:10px;padding:12px 16px;margin-top:4px;">
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:4px">Notes</div>
        <div style="font-size:12px;color:#92400e">${order.notes}</div>
      </div>` : '';

    return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;background:#eef2f7;padding:24px;color:#1e293b">
    <div style="max-width:750px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.12)">

      <!-- HEADER -->
      <div style="background:#ffffff;border-bottom:2px solid #1e293b;padding:28px 32px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:24px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;line-height:1.1">${info.name || 'MyTailorBook'}</div>
          ${info.tagline ? `<div style="font-size:10px;color:#64748b;margin-top:4px">${info.tagline}</div>` : ''}
          <div style="font-size:9px;color:#94a3b8;margin-top:6px">
            ${[info.contact, info.email, info.address].filter(Boolean).join('  |  ')}
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Order No</div>
          <div style="font-size:36px;font-weight:900;color:#0f172a;line-height:1;margin-top:2px">#${o.orderNo || ''}</div>
          <div style="font-size:9px;color:#94a3b8;margin-top:4px">${new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <!-- STATUS BAR -->
      <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:10px 32px;display:flex;align-items:center;gap:10px">
        <span style="font-size:11px;font-weight:700;color:#1e293b">Status:</span>
        <span style="background:#e2e8f0;color:#1e293b;font-size:10px;font-weight:700;padding:4px 12px;border-radius:20px">${order.status}</span>
        <div style="margin-left:auto;font-size:10px;color:#64748b;display:flex;gap:16px">
          ${o.orderedDate ? `<span>Order: ${o.orderedDate}</span>` : ''}
          ${order.dueDate ? `<span>Due: ${order.dueDate}</span>` : ''}
        </div>
      </div>

      <!-- BODY -->
      <div style="padding:24px 32px">

        <!-- INFO CARDS -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;border-top:3px solid ${sc}">
            <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:10px">Customer</div>
            <div style="font-size:16px;font-weight:800;color:#0f172a;margin-bottom:4px">${customer?.name || o.customerName || '—'}</div>
            ${customer?.phone ? `<div style="font-size:11px;color:#64748b;margin-top:3px">📞 ${customer.phone}</div>` : ''}
            ${(customer as any)?.address ? `<div style="font-size:11px;color:#64748b;margin-top:3px">📍 ${(customer as any).address}</div>` : ''}
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;border-top:3px solid ${sc}">
            <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:10px">Order Info</div>
            ${([
              ['Quantity', `${order.quantity} pcs`],
              order.price ? ['Price', `Rs. ${order.price}`] : null,
              ['Dress Items', `${items.length}`],
            ].filter(Boolean) as [string, string][]).map(([k, v]) => `
              <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f1f5f9">
                <span style="font-size:11px;color:#94a3b8">${k}</span>
                <span style="font-size:11px;font-weight:700;color:#1e293b">${v}</span>
              </div>`).join('')}
          </div>
        </div>

        <!-- DRESS ITEMS -->
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:10px">Dress Items & Measurements</div>
        ${dressBlocks}
        ${notesBlock}

      </div>

      <!-- FOOTER -->
      <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 32px;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:10px;color:#94a3b8">${info.name || 'MyTailorBook'} · ${new Date().toLocaleDateString()}</div>
        ${order.price ? `<div style="font-size:18px;font-weight:900;color:#10b981">Rs. ${order.price}<div style="font-size:9px;font-weight:500;color:#94a3b8;text-align:right">Total</div></div>` : ''}
      </div>

    </div>
    </div>`;
  }

  // ── Customer Orders HTML ────────────────────────────────────────

  private buildCustomerHtml(customer: Customer, orders: Order[]): string {
    const info = this.storage.getTailorInfo();

    const orderCards = orders.map((order, idx) => {
      const sc = this.statusColorHex(order.status);
      const mEntries = Object.entries(order.measurements).filter(([, v]) => v);
      const chips = mEntries.map(([k, v]) => `
        <div style="display:flex;flex-direction:column;align-items:center;background:#f5f7fc;
          border:1px solid #e2e8f0;border-radius:8px;padding:6px 10px;min-width:60px">
          <span style="font-size:13px;font-weight:800;color:#6c63ff">${v}"</span>
          <span style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:.4px;margin-top:1px">${k}</span>
        </div>`).join('');

      return `
        <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:12px;border-left:4px solid ${sc}">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:28px;height:28px;border-radius:8px;background:${sc};color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center">${idx + 1}</div>
              <span style="font-size:14px;font-weight:800;color:#1e293b">${order.dressType}</span>
            </div>
            <span style="background:${sc};color:#fff;font-size:9px;font-weight:800;padding:3px 10px;border-radius:20px">${order.status}</span>
          </div>
          <div style="padding:10px 14px">
            <div style="font-size:10px;color:#94a3b8;margin-bottom:8px">
              ${(order as any).orderedDate ? `Order: ${(order as any).orderedDate}` : ''}
              ${order.dueDate ? `  ·  Due: ${order.dueDate}` : ''}
              ${order.price ? `  ·  Rs. ${order.price}` : ''}
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">${chips || '<span style="font-size:10px;color:#94a3b8;font-style:italic">No measurements</span>'}</div>
            ${order.notes ? `<div style="font-size:10px;color:#92400e;background:#fffbeb;border-radius:6px;padding:6px 10px;margin-top:8px">📝 ${order.notes}</div>` : ''}
          </div>
        </div>`;
    }).join('');

    return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;background:#eef2f7;padding:24px;color:#1e293b">
    <div style="max-width:750px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.12)">

      <div style="background:#ffffff;border-bottom:2px solid #1e293b;padding:28px 32px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:24px;font-weight:900;color:#0f172a;letter-spacing:-0.5px">${info.name || 'MyTailorBook'}</div>
          ${info.tagline ? `<div style="font-size:10px;color:#64748b;margin-top:4px">${info.tagline}</div>` : ''}
          <div style="font-size:9px;color:#94a3b8;margin-top:6px">${[info.contact, info.email].filter(Boolean).join('  |  ')}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Customer Orders</div>
          <div style="font-size:18px;font-weight:900;color:#0f172a;margin-top:4px">${customer.name}</div>
          ${customer.phone ? `<div style="font-size:10px;color:#94a3b8;margin-top:3px">${customer.phone}</div>` : ''}
        </div>
      </div>

      <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:8px 32px;font-size:10px;color:#64748b">
        ${orders.length} order${orders.length !== 1 ? 's' : ''}  ·  Generated ${new Date().toLocaleDateString()}
      </div>

      <div style="padding:24px 32px">
        ${orders.length ? orderCards : '<p style="color:#94a3b8;text-align:center;padding:32px 0">No orders found.</p>'}
      </div>

      <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 32px;font-size:10px;color:#94a3b8">
        ${info.name || 'MyTailorBook'} · ${new Date().toLocaleDateString()}
      </div>

    </div>
    </div>`;
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private statusColorHex(status: string): string {
    const map: Record<string, string> = {
      'Pending':     '#f59e0b',
      'In Progress': '#6c63ff',
      'Ready':       '#10b981',
      'Delivered':   '#94a3b8',
    };
    return map[status] || '#6c63ff';
  }

  private statusColorLight(status: string): string {
    const map: Record<string, string> = {
      'Pending':     '#fef3c7',
      'In Progress': '#ede9fe',
      'Ready':       '#d1fae5',
      'Delivered':   '#f1f5f9',
    };
    return map[status] || '#ede9fe';
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
}
