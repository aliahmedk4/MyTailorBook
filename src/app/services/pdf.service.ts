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
    const blob = await this.generatePdfBlob(this.buildOrderHtml(order, customer));
    await this.saveToDevice(blob, `Order_${order.orderNo || order.id}.pdf`);
  }

  async shareOrderPdfOnWhatsApp(order: Order, customer: Customer | undefined): Promise<void> {
    const blob = await this.generatePdfBlob(this.buildOrderHtml(order, customer));
    await this.shareFile(blob, `Order_${order.orderNo || order.id}.pdf`);
  }

  async saveCustomerPdf(customer: Customer, orders: Order[]): Promise<void> {
    const blob = await this.generatePdfBlob(this.buildCustomerHtml(customer, orders));
    await this.saveToDevice(blob, `${customer.name.replace(/\s+/g, '_')}_orders.pdf`);
  }

  async shareCustomerPdfOnWhatsApp(customer: Customer, orders: Order[]): Promise<void> {
    const blob = await this.generatePdfBlob(this.buildCustomerHtml(customer, orders));
    await this.shareFile(blob, `${customer.name.replace(/\s+/g, '_')}_orders.pdf`);
  }

  // â”€â”€ Core â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async generatePdfBlob(html: string): Promise<Blob> {
    const W = 1794; // A4 at 72dpi â€” fits any screen

    const container = document.createElement('div');
    container.style.cssText = `position:fixed;left:-9999px;top:0;width:${W}px;background:#fff;`;
    container.innerHTML = html.replace(/width:1794px/g, `width:${W}px`)
                              .replace(/width:1794px/g, `width:${W}px`);
    document.body.appendChild(container);

    await new Promise(r => setTimeout(r, 300));

    try {
      const canvas = await html2canvas(container, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 1);
      const pdfW    = 210;
      const pdfH    = (canvas.height * pdfW) / canvas.width;
      const doc     = new jsPDF({ unit: 'mm', format: [pdfW, pdfH], orientation: 'portrait' });
      doc.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
      return doc.output('blob');
    } finally {
      document.body.removeChild(container);
    }
  }

  // â”€â”€ Save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async saveToDevice(blob: Blob, fileName: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      const base64 = await this.blobToBase64(blob);
      await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Documents, recursive: true });
      alert(`PDF saved to Documents/${fileName}`);
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
    }
  }

  private async shareFile(blob: Blob, fileName: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      const base64 = await this.blobToBase64(blob);
      await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache, recursive: true });
      const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
      await Share.share({ title: fileName, url: uri, dialogTitle: 'Share PDF' });
    } else {
      await this.saveToDevice(blob, fileName);
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // â”€â”€ Order HTML (table-based, no flexbox) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private buildOrderHtml(order: Order, customer: Customer | undefined): string {
    const W      = 595;
    const info   = this.storage.getTailorInfo();
    const o: any = order;
    const sc     = this.statusColor(order.status);

    const items: any[] = o.dressItems?.length
      ? o.dressItems
      : [{ dressType: order.dressType, measurements: order.measurements }];

    const dressBlocks = items.map((item: any) => {
      const mEntries = Object.entries(item.measurements as Record<string, string>).filter(([, v]) => v);

      const chipCells = mEntries.map(([k, v]) =>
        `<td style="padding:4px;">
          <div style="background:#f5f7fc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 10px;text-align:center;min-width:60px;">
            <div style="font-size:14px;font-weight:800;color:#6c63ff">${v}"</div>
            <div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:.4px;margin-top:2px">${k}</div>
          </div>
        </td>`).join('');

      const thumb = item.imageUrl
        ? `<img src="${item.imageUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;vertical-align:middle;margin-right:10px;"/>`
        : '';

      return `
        <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:10px;">
          <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:10px 14px;">
            ${thumb}
            <span style="background:#6c63ff;color:#fff;font-size:11px;font-weight:800;padding:3px 12px;border-radius:20px;display:inline-block;vertical-align:middle">${item.dressType}</span>
            <span style="font-size:10px;color:#94a3b8;margin-left:8px;vertical-align:middle">${mEntries.length} measurements</span>
          </div>
          <div style="padding:10px 14px;">
            ${mEntries.length
              ? `<table style="border-collapse:collapse;"><tr>${chipCells}</tr></table>`
              : '<span style="font-size:11px;color:#94a3b8;font-style:italic">No measurements recorded</span>'
            }
          </div>
        </div>`;
    }).join('');

    const notesBlock = order.notes ? `
      <div style="background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:8px;padding:10px 14px;margin-top:8px;">
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94a3b8;margin-bottom:4px">Notes</div>
        <div style="font-size:12px;color:#92400e">${order.notes}</div>
      </div>` : '';

    const kvRows = ([
      ['Quantity', `${order.quantity} pcs`],
      order.price ? ['Price', `Rs. ${order.price}`] : null,
      ['Dress Items', `${items.length}`],
    ].filter(Boolean) as [string, string][]).map(([k, v]) =>
      `<tr>
        <td style="font-size:11px;color:#94a3b8;padding:4px 0;border-bottom:1px solid #f1f5f9">${k}</td>
        <td style="font-size:11px;font-weight:700;color:#1e293b;padding:4px 0;border-bottom:1px solid #f1f5f9;text-align:right">${v}</td>
      </tr>`).join('');

    return `<div style="font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;width:${W}px;background:#fff;">

      <!-- HEADER -->
      <table style="width:${W}px;border-collapse:collapse;border-bottom:2px solid #1e293b;">
        <tr>
          <td style="padding:20px 24px;vertical-align:top;width:60%;">
            <div style="font-size:24px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;line-height:1.1">${info.name || 'MyTailorBook'}</div>
            ${info.tagline ? `<div style="font-size:10px;color:#64748b;margin-top:4px">${info.tagline}</div>` : ''}
            <div style="font-size:9px;color:#94a3b8;margin-top:5px">${[info.contact, info.email, info.address].filter(Boolean).join(' | ')}</div>
          </td>
          <td style="padding:20px 24px;vertical-align:top;text-align:right;width:40%;">
            <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Order No</div>
            <div style="font-size:32px;font-weight:900;color:#0f172a;line-height:1;margin-top:2px">#${o.orderNo || ''}</div>
            <div style="font-size:9px;color:#94a3b8;margin-top:4px">${new Date().toLocaleDateString()}</div>
          </td>
        </tr>
      </table>

      <!-- STATUS BAR -->
      <table style="width:${W}px;border-collapse:collapse;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
        <tr>
          <td style="padding:9px 24px;vertical-align:middle;">
            <span style="background:${sc};color:#fff;font-size:10px;font-weight:800;padding:4px 14px;border-radius:20px;display:inline-block">${order.status}</span>
          </td>
          <td style="padding:9px 24px;text-align:right;vertical-align:middle;font-size:10px;color:#64748b;">
            ${o.orderedDate ? `Order: ${o.orderedDate}` : ''}
            ${o.orderedDate && order.dueDate ? '&nbsp;&nbsp;|&nbsp;&nbsp;' : ''}
            ${order.dueDate ? `Due: ${order.dueDate}` : ''}
          </td>
        </tr>
      </table>

      <!-- BODY -->
      <div style="padding:16px 24px;">

        <!-- INFO CARDS -->
        <table style="width:100%;border-collapse:separate;border-spacing:12px;margin-bottom:6px;">
          <tr>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:3px solid ${sc};border-radius:10px;padding:14px;vertical-align:top;">
              <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px">Customer</div>
              <div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:4px">${customer?.name || o.customerName || 'â€”'}</div>
              ${customer?.phone ? `<div style="font-size:11px;color:#64748b;margin-top:3px">${customer.phone}</div>` : ''}
              ${(customer as any)?.address ? `<div style="font-size:11px;color:#64748b;margin-top:3px">${(customer as any).address}</div>` : ''}
            </td>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:3px solid ${sc};border-radius:10px;padding:14px;vertical-align:top;">
              <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px">Order Info</div>
              <table style="width:100%;border-collapse:collapse;">${kvRows}</table>
            </td>
          </tr>
        </table>

        <!-- DRESS ITEMS -->
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:10px;">Dress Items &amp; Measurements</div>
        ${dressBlocks}
        ${notesBlock}

      </div>

      <!-- FOOTER -->
      <table style="width:${W}px;border-collapse:collapse;background:#f8fafc;border-top:1px solid #e2e8f0;">
        <tr>
          <td style="padding:10px 24px;font-size:10px;color:#94a3b8;">${info.name || 'MyTailorBook'} &middot; ${new Date().toLocaleDateString()}</td>
          <td style="padding:10px 24px;text-align:right;font-size:15px;font-weight:900;color:#10b981;">${order.price ? `Rs. ${order.price}` : ''}</td>
        </tr>
      </table>

    </div>`;
  }

  // â”€â”€ Customer HTML (table-based) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private buildCustomerHtml(customer: Customer, orders: Order[]): string {
    const W    = 595;
    const info = this.storage.getTailorInfo();

    const orderCards = orders.map((order, idx) => {
      const sc = this.statusColor(order.status);
      const mEntries = Object.entries(order.measurements).filter(([, v]) => v);

      const chipCells = mEntries.map(([k, v]) =>
        `<td style="padding:3px;">
          <div style="background:#f5f7fc;border:1px solid #e2e8f0;border-radius:8px;padding:5px 8px;text-align:center;min-width:52px;">
            <div style="font-size:13px;font-weight:800;color:#6c63ff">${v}"</div>
            <div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:.4px;margin-top:1px">${k}</div>
          </div>
        </td>`).join('');

      return `
        <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:10px;border-left:4px solid ${sc};">
          <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
            <tr>
              <td style="padding:10px 14px;vertical-align:middle;">
                <span style="background:${sc};color:#fff;font-size:11px;font-weight:900;padding:3px 8px;border-radius:6px;display:inline-block;vertical-align:middle;margin-right:8px">${idx + 1}</span>
                <span style="font-size:13px;font-weight:800;color:#1e293b;vertical-align:middle">${order.dressType}</span>
              </td>
              <td style="padding:10px 14px;text-align:right;vertical-align:middle;">
                <span style="background:${sc};color:#fff;font-size:9px;font-weight:800;padding:3px 10px;border-radius:20px;display:inline-block">${order.status}</span>
              </td>
            </tr>
          </table>
          <div style="padding:10px 14px;">
            <div style="font-size:10px;color:#94a3b8;margin-bottom:6px;">
              ${(order as any).orderedDate ? `Order: ${(order as any).orderedDate}` : ''}
              ${order.dueDate ? ` &middot; Due: ${order.dueDate}` : ''}
              ${order.price  ? ` &middot; Rs. ${order.price}` : ''}
            </div>
            ${mEntries.length
              ? `<table style="border-collapse:collapse;"><tr>${chipCells}</tr></table>`
              : '<span style="font-size:10px;color:#94a3b8;font-style:italic">No measurements</span>'
            }
            ${order.notes ? `<div style="font-size:10px;color:#92400e;background:#fffbeb;border-radius:6px;padding:6px 10px;margin-top:8px">${order.notes}</div>` : ''}
          </div>
        </div>`;
    }).join('');

    return `<div style="font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;width:${W}px;background:#fff;">

      <table style="width:${W}px;border-collapse:collapse;border-bottom:2px solid #1e293b;">
        <tr>
          <td style="padding:20px 24px;vertical-align:top;width:60%;">
            <div style="font-size:24px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;line-height:1.1">${info.name || 'MyTailorBook'}</div>
            ${info.tagline ? `<div style="font-size:10px;color:#64748b;margin-top:4px">${info.tagline}</div>` : ''}
            <div style="font-size:9px;color:#94a3b8;margin-top:5px">${[info.contact, info.email].filter(Boolean).join(' | ')}</div>
          </td>
          <td style="padding:20px 24px;vertical-align:top;text-align:right;width:40%;">
            <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Customer Orders</div>
            <div style="font-size:20px;font-weight:900;color:#0f172a;margin-top:4px">${customer.name}</div>
            ${customer.phone ? `<div style="font-size:10px;color:#94a3b8;margin-top:3px">${customer.phone}</div>` : ''}
          </td>
        </tr>
      </table>

      <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:8px 24px;font-size:10px;color:#64748b;">
        ${orders.length} order${orders.length !== 1 ? 's' : ''} &middot; Generated ${new Date().toLocaleDateString()}
      </div>

      <div style="padding:16px 24px;">
        ${orders.length ? orderCards : '<p style="color:#94a3b8;text-align:center;padding:32px 0">No orders found.</p>'}
      </div>

      <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:10px 24px;font-size:10px;color:#94a3b8;">
        ${info.name || 'MyTailorBook'} &middot; ${new Date().toLocaleDateString()}
      </div>

    </div>`;
  }

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private statusColor(status: string): string {
    const map: Record<string, string> = {
      'Pending':     '#f59e0b',
      'In Progress': '#6c63ff',
      'Ready':       '#10b981',
      'Delivered':   '#94a3b8',
    };
    return map[status] || '#6c63ff';
  }
}

