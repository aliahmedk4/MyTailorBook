import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { IdbService } from './idb.service';
import { Customer } from '../models/customer.model';
import { Order } from '../models/order.model';

@Injectable({ providedIn: 'root' })
export class PdfService {

  constructor(private storage: StorageService, private idb: IdbService) {}

  // Called async after order save — pre-builds and caches PDF HTML in IDB
  async cacheOrderPdf(order: Order, customer: Customer | undefined): Promise<void> {
    try {
      const html = this.buildOrderHtml(order, customer);
      await this.idb.savePdfHtml(order.id, html);
    } catch { /* silent — cache is best-effort */ }
  }

  async saveOrderPdf(order: Order, customer: Customer | undefined): Promise<void> {
    const html     = await this.idb.getPdfHtml(order.id) || this.buildOrderHtml(order, customer);
    const filename = this.pdfFileName(order, customer);
    const final    = html.replace(/<title>[^<]*<\/title>/, `<title>${filename}</title>`);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(final);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  }

  shareOrderPdfOnWhatsApp(order: Order, customer: Customer | undefined): void {
    const phone = customer?.phone?.replace(/[^0-9]/g, '') || '';
    const text = this.buildOrderText(order, customer);
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  saveCustomerPdf(customer: Customer, orders: Order[]): void {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(this.buildCustomerHtml(customer, orders));
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  }

  shareCustomerPdfOnWhatsApp(customer: Customer, orders: Order[]): void {
    const phone = customer.phone?.replace(/[^0-9]/g, '') || '';
    const lines = [
      `🧵 *${customer.name} — Order Summary*`,
      customer.phone ? `📞 ${customer.phone}` : null,
      `📦 ${orders.length} order${orders.length !== 1 ? 's' : ''}`,
      '',
      ...orders.map((o, i) => {
        const o2 = o as any;
        const mList = Object.entries(o.measurements)
          .filter(([, v]) => v)
          .map(([k, v]) => `  • ${k}: *${v}*"`)
          .join('\n');
        return [
          `*${i + 1}. ${o.dressType}* — ${o.status}`,
          o2.orderedDate ? `📅 ${o2.orderedDate}` : null,
          o.dueDate ? `⏰ Due: ${o.dueDate}` : null,
          o.price ? `💰 ₨ ${o.price}` : null,
          mList || null,
        ].filter(Boolean).join('\n');
      })
    ].filter(l => l !== null).join('\n');

    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(lines)}`
      : `https://wa.me/?text=${encodeURIComponent(lines)}`;
    window.open(url, '_blank');
  }

  // ── Order HTML ──────────────────────────────────────────────────

  private buildOrderHtml(order: Order, customer: Customer | undefined): string {
    const info   = this.storage.getTailorInfo();
    const o: any = order;
    const sc     = this.statusColor(order.status);
    const hs     = this.storage.getPdfHeaderStyle();
    const items: any[] = o.dressItems?.length
      ? o.dressItems
      : [{ dressType: order.dressType, measurements: order.measurements }];

    const dressBlocks = items.map((item: any) => {
      const mEntries = Object.entries(item.measurements as Record<string, string>).filter(([, v]) => v);
      const chips = mEntries.map(([k, v]) => `
        <div class="m-chip">
          <span class="m-val">${v}&quot;</span>
          <span class="m-lbl">${k}</span>
        </div>`).join('');
      const thumb = item.imageUrl
        ? `<img src="${item.imageUrl}" class="dress-thumb"/>`
        : '<div class="dress-thumb-empty"></div>';
      const fullImg = item.imageUrl
        ? `<div class="dress-img-wrap"><img src="${item.imageUrl}" class="dress-full-img" alt="${item.dressType}"/></div>`
        : '';
      return `
        <div class="dress-block">
          <div class="db-header">
            ${thumb}
            <div class="db-meta">
              <div class="db-badge">${item.dressType}</div>
              <div class="db-count">${mEntries.length} measurements</div>
            </div>
          </div>
          ${fullImg}
          ${chips ? `<div class="m-chips">${chips}</div>` : '<div class="m-empty">No measurements recorded</div>'}
        </div>`;
    }).join('');

    const advanceAmt  = o.advance  ? `&#8360; ${o.advance}`  : '—';
    const balanceAmt  = (order.price && o.advance)
      ? `&#8360; ${parseFloat(order.price) - parseFloat(o.advance)}`
      : (order.price ? `&#8360; ${order.price}` : '—');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Order #${o.orderNo || ''}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#eef2f7;padding:20px;color:#1e293b;font-size:13px}
  .page{max-width:680px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 40px rgba(0,0,0,0.13)}

  /* header */
  .hdr{background:${hs.bgColor};padding:22px 28px;display:flex;justify-content:space-between;align-items:flex-start}
  .hdr-left .brand{font-size:${hs.brandSize}px;font-weight:900;color:${hs.brandColor};letter-spacing:-0.3px}
  .hdr-left .tagline{font-size:${hs.taglineSize}px;color:${hs.taglineColor};letter-spacing:1.2px;text-transform:uppercase;margin-top:3px}
  .hdr-left .hdr-contact{margin-top:8px;display:flex;flex-direction:column;gap:2px}
  .hdr-left .hdr-contact span{font-size:${hs.contactSize}px;color:${hs.contactColor};display:flex;align-items:center;gap:4px}
  .hdr-right{text-align:right}
  .hdr-right .ord-no{font-size:26px;font-weight:900;color:${hs.brandColor};line-height:1}
  .hdr-right .ord-lbl{font-size:9px;color:${hs.taglineColor};text-transform:uppercase;letter-spacing:1px}
  .hdr-right .ord-date{font-size:${hs.contactSize}px;color:${hs.contactColor};margin-top:6px}

  /* status strip */
  .strip{background:${sc}15;border-left:4px solid ${sc};padding:8px 28px;display:flex;align-items:center;gap:8px}
  .strip-dot{width:8px;height:8px;border-radius:50%;background:${sc};flex-shrink:0}
  .strip-status{font-size:11px;font-weight:800;color:${sc};text-transform:uppercase;letter-spacing:.8px}
  .strip-dates{margin-left:auto;font-size:11px;color:#64748b;display:flex;gap:14px}

  /* body */
  .body{padding:20px 28px}
  .info-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
  .card{background:#f8fafc;border:1px solid #e8edf3;border-radius:10px;padding:12px 14px}
  .card-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px}
  .cust-name{font-size:15px;font-weight:900;color:#0f172a;margin-bottom:3px}
  .cust-sub{font-size:11px;color:#64748b;margin-top:3px;display:flex;align-items:center;gap:4px}
  .kv{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9}
  .kv:last-child{border:none}
  .kv-k{font-size:11px;color:#94a3b8}
  .kv-v{font-size:11px;font-weight:700;color:#1e293b}
  .sec{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin:16px 0 8px}

  /* dress blocks */
  .dress-block{border:1px solid #e8edf3;border-radius:10px;overflow:hidden;margin-bottom:10px}
  .db-header{display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e8edf3}
  .dress-thumb{width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;flex-shrink:0}
  .dress-thumb-empty{width:40px;height:40px;border-radius:6px;background:#f1f5f9;flex-shrink:0}
  .db-meta{flex:1}
  .db-badge{display:inline-block;background:linear-gradient(135deg,#6c63ff,#818cf8);color:#fff;font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px}
  .db-count{font-size:10px;color:#94a3b8;margin-top:2px}
  .dress-img-wrap{border-bottom:1px solid #e8edf3}
  .dress-full-img{width:100%;max-height:280px;object-fit:cover;display:block}
  .m-chips{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px}
  .m-chip{display:flex;flex-direction:column;align-items:center;background:#f8fafc;border:1px solid #e8edf3;border-radius:8px;padding:5px 10px;min-width:60px}
  .m-val{font-size:13px;font-weight:800;color:#6c63ff;line-height:1.2}
  .m-lbl{font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.4px;margin-top:1px;white-space:nowrap}
  .m-empty{padding:10px 12px;font-size:11px;color:#94a3b8;font-style:italic}
  .notes-box{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 14px;margin-top:12px}
  .notes-box p{font-size:12px;color:#92400e;line-height:1.5}

  /* amount summary */
  .amount-section{margin-top:20px;border:1px solid #e8edf3;border-radius:12px;overflow:hidden}
  .amount-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e8edf3}
  .amount-rows{padding:4px 14px 8px}
  .amount-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #f1f5f9}
  .amount-row:last-child{border:none}
  .amount-row.total-row{padding-top:10px;margin-top:4px;border-top:2px solid #e8edf3;border-bottom:none}
  .ar-label{font-size:12px;color:#64748b}
  .ar-value{font-size:12px;font-weight:700;color:#1e293b}
  .ar-value.total-val{font-size:16px;font-weight:900;color:#10b981}

  /* signature row */
  .sig-row{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px;padding:0 4px}
  .sig-box{display:flex;flex-direction:column;gap:6px}
  .sig-line{height:1px;background:#cbd5e1;margin-bottom:4px}
  .sig-label{font-size:10px;color:#94a3b8;text-align:center}

  /* terms */
  .terms{margin-top:20px;background:#f8fafc;border:1px solid #e8edf3;border-radius:10px;padding:12px 14px}
  .terms-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px}
  .terms ol{padding-left:16px;display:flex;flex-direction:column;gap:4px}
  .terms li{font-size:10px;color:#64748b;line-height:1.5}

  /* footer */
  .ftr{background:${hs.bgColor};padding:12px 28px;display:flex;justify-content:space-between;align-items:center;margin-top:20px}
  .ftr-brand{font-size:${hs.contactSize}px;color:${hs.contactColor}}
  .ftr-generated{font-size:${hs.contactSize}px;color:${hs.taglineColor}}

  @media print{body{background:#fff;padding:0}.page{box-shadow:none;border-radius:0}}
</style></head><body>
<div class="page">

  <div class="hdr">
    <div class="hdr-left">
      <div class="brand">${info.name || 'MyTailorBook'}</div>
      ${info.tagline ? `<div class="tagline">${info.tagline}</div>` : ''}
      <div class="hdr-contact">
        ${info.contact ? `<span>&#128222; ${info.contact}</span>` : ''}
        ${info.email   ? `<span>&#9993; ${info.email}</span>` : ''}
        ${info.address ? `<span>&#128205; ${info.address}</span>` : ''}
      </div>
    </div>
    <div class="hdr-right">
      <div class="ord-lbl">Order No</div>
      <div class="ord-no">#${o.orderNo || ''}</div>
      ${o.orderedDate ? `<div class="ord-date">&#128197; ${o.orderedDate}</div>` : ''}
    </div>
  </div>

  <div class="strip">
    <div class="strip-dot"></div>
    <div class="strip-status">${order.status}</div>
    <div class="strip-dates">
      ${order.dueDate ? `<span>&#9200; Due: ${order.dueDate}</span>` : ''}
    </div>
  </div>

  <div class="body">
    <div class="info-row">
      <div class="card">
        <div class="card-title">Customer</div>
        <div class="cust-name">${customer?.name || o.customerName || '—'}</div>
        ${customer?.phone     ? `<div class="cust-sub">&#128222; ${customer.phone}</div>` : ''}
        ${(customer as any)?.altPhone ? `<div class="cust-sub">&#128222; ${(customer as any).altPhone} <span style="font-size:9px;color:#94a3b8">(alt)</span></div>` : ''}
        ${(customer as any)?.address  ? `<div class="cust-sub">&#128205; ${(customer as any).address}</div>` : ''}
      </div>
      <div class="card">
        <div class="card-title">Order Info</div>
        <div class="kv"><span class="kv-k">Quantity</span><span class="kv-v">${order.quantity} pcs</span></div>
        <div class="kv"><span class="kv-k">Dress Items</span><span class="kv-v">${items.length}</span></div>
        ${order.price ? `<div class="kv"><span class="kv-k">Total Amount</span><span class="kv-v" style="color:#10b981">&#8360; ${order.price}</span></div>` : ''}
      </div>
    </div>

    <div class="sec">Dress Items &amp; Measurements</div>
    ${dressBlocks}
    ${order.notes ? `<div class="notes-box"><div class="sec" style="margin:0 0 4px">Notes</div><p>${order.notes}</p></div>` : ''}

    <!-- Amount Summary -->
    ${order.price ? `
    <div class="amount-section">
      <div class="amount-title">Payment Summary</div>
      <div class="amount-rows">
        <div class="amount-row">
          <span class="ar-label">Order Amount</span>
          <span class="ar-value">&#8360; ${order.price}</span>
        </div>
        <div class="amount-row">
          <span class="ar-label">Advance Paid</span>
          <span class="ar-value">${advanceAmt}</span>
        </div>
        <div class="amount-row total-row">
          <span class="ar-label" style="font-weight:800;color:#1e293b">Balance Due</span>
          <span class="ar-value total-val">${balanceAmt}</span>
        </div>
      </div>
    </div>` : ''}

    <!-- Signature -->
    <div class="sig-row">
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">Customer Signature</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">Tailor / Authorized Signature</div>
      </div>
    </div>

    <!-- Terms -->
    <div class="terms">
      <div class="terms-title">Terms &amp; Conditions</div>
      <ol>
        ${this.storage.getTerms().map(t => `<li>${t}</li>`).join('')}
      </ol>
    </div>

  </div>

  <div class="ftr">
    <div class="ftr-brand">${info.name || 'MyTailorBook'}${info.contact ? ' &nbsp;|&nbsp; ' + info.contact : ''}</div>
    <div class="ftr-generated">Generated ${new Date().toLocaleDateString()}</div>
  </div>

</div>
</body></html>`;
  }

  // ── Customer HTML ───────────────────────────────────────────────

  private buildCustomerHtml(customer: Customer, orders: Order[]): string {
    const info = this.storage.getTailorInfo();
    const hs   = this.storage.getPdfHeaderStyle();

    const orderCards = orders.map((order, idx) => {
      const sc = this.statusColor(order.status);
      const mEntries = Object.entries(order.measurements).filter(([, v]) => v);
      const chips = mEntries.map(([k, v]) => `
        <div class="m-chip">
          <span class="m-val">${v}&quot;</span>
          <span class="m-lbl">${k}</span>
        </div>`).join('');
      return `
        <div class="dress-block" style="border-left:4px solid ${sc}">
          <div class="db-header">
            <div style="width:28px;height:28px;border-radius:8px;background:${sc};color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0">${idx + 1}</div>
            <div class="db-meta">
              <div class="db-badge">${order.dressType}</div>
              <div class="db-count">${order.status}${(order as any).orderedDate ? ' · ' + (order as any).orderedDate : ''}${order.price ? ' · ₨ ' + order.price : ''}</div>
            </div>
          </div>
          ${chips ? `<div class="m-chips">${chips}</div>` : '<div class="m-empty">No measurements</div>'}
          ${order.notes ? `<div style="padding:6px 12px 10px;font-size:11px;color:#92400e">📝 ${order.notes}</div>` : ''}
        </div>`;
    }).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${customer.name} — Orders</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#eef2f7;padding:20px;color:#1e293b;font-size:13px}
  .page{max-width:680px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 40px rgba(0,0,0,0.13)}
  .hdr{background:${hs.bgColor};padding:22px 28px;display:flex;justify-content:space-between;align-items:center}
  .hdr-left .brand{font-size:${hs.brandSize}px;font-weight:900;color:${hs.brandColor}}
  .hdr-left .tagline{font-size:${hs.taglineSize}px;color:${hs.taglineColor};letter-spacing:1.2px;text-transform:uppercase;margin-top:2px}
  .hdr-right{text-align:right}
  .hdr-right .cust-name{font-size:18px;font-weight:900;color:${hs.brandColor}}
  .hdr-right .cust-phone{font-size:10px;color:${hs.contactColor};margin-top:3px}
  .sub-bar{background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:8px 28px;font-size:10px;color:#64748b}
  .body{padding:20px 28px}
  .dress-block{border:1px solid #e8edf3;border-radius:10px;overflow:hidden;margin-bottom:10px}
  .db-header{display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e8edf3}
  .db-meta{flex:1}
  .db-badge{display:inline-block;background:linear-gradient(135deg,#6c63ff,#818cf8);color:#fff;font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px}
  .db-count{font-size:10px;color:#94a3b8;margin-top:2px}
  .m-chips{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px}
  .m-chip{display:flex;flex-direction:column;align-items:center;background:#f8fafc;border:1px solid #e8edf3;border-radius:8px;padding:5px 10px;min-width:60px}
  .m-val{font-size:13px;font-weight:800;color:#6c63ff;line-height:1.2}
  .m-lbl{font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.4px;margin-top:1px;white-space:nowrap}
  .m-empty{padding:10px 12px;font-size:11px;color:#94a3b8;font-style:italic}
  .ftr{background:#f8fafc;border-top:1px solid #e8edf3;padding:12px 28px;font-size:10px;color:#94a3b8}
  @media print{body{background:#fff;padding:0}.page{box-shadow:none;border-radius:0}}
</style></head><body>
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <div class="brand">${info.name || 'MyTailorBook'}</div>
      ${info.tagline ? `<div class="tagline">${info.tagline}</div>` : ''}
    </div>
    <div class="hdr-right">
      <div class="cust-name">${customer.name}</div>
      ${customer.phone ? `<div class="cust-phone">${customer.phone}</div>` : ''}
    </div>
  </div>
  <div class="sub-bar">${orders.length} order${orders.length !== 1 ? 's' : ''} &middot; Generated ${new Date().toLocaleDateString()}</div>
  <div class="body">
    ${orders.length ? orderCards : '<p style="color:#94a3b8;text-align:center;padding:32px 0">No orders found.</p>'}
  </div>
  <div class="ftr">${info.name || 'MyTailorBook'} &middot; ${new Date().toLocaleDateString()}</div>
</div>
</body></html>`;
  }

  // ── WhatsApp text for single order ─────────────────────────────

  private buildOrderText(order: Order, customer: Customer | undefined): string {
    const o: any = order;
    const items: any[] = o.dressItems?.length
      ? o.dressItems
      : [{ dressType: order.dressType, measurements: order.measurements }];

    const itemLines = items.map(item => {
      const mList = Object.entries(item.measurements as Record<string, string>)
        .filter(([, v]) => v)
        .map(([k, v]) => `  • ${k}: *${v}*"`)
        .join('\n');
      return `*${item.dressType}*\n${mList || '  (no measurements)'}`;
    }).join('\n\n');

    return [
      `🧵 *Order #${o.orderNo || ''} — MyTailorBook*`,
      `👤 ${customer?.name || o.customerName || ''}`,
      customer?.phone ? `📞 ${customer.phone}` : null,
      '',
      o.orderedDate ? `📅 Order Date: ${o.orderedDate}` : null,
      order.dueDate  ? `⏰ Due Date: ${order.dueDate}` : null,
      `🏷️ Status: ${order.status}`,
      order.price    ? `💰 Price: ₨ ${order.price}` : null,
      '',
      `📐 *Measurements:*`,
      itemLines,
      order.notes    ? `\n📝 Notes: ${order.notes}` : null,
    ].filter(l => l !== null).join('\n');
  }

  private statusColor(status: string): string {
    const map: Record<string, string> = {
      'Pending': '#f59e0b', 'In Progress': '#6c63ff',
      'Ready': '#10b981', 'Delivered': '#94a3b8',
    };
    return map[status] || '#6c63ff';
  }

  private pdfFileName(order: Order, customer: Customer | undefined): string {
    const name  = (customer?.name || (order as any).customerName || 'Order')
                    .replace(/[^a-zA-Z0-9\u0080-\uFFFF]+/g, '_').replace(/^_+|_+$/g, '');
    const phone = (customer?.phone || '').replace(/[^0-9]/g, '');
    const orderId = (order as any).orderNo || order.id;
    return [name, phone, orderId].filter(Boolean).join('_') + '.pdf';
  }
}
