import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ActionSheetController, ToastController } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { StorageService } from '../../services/storage.service';
import { Customer } from '../../models/customer.model';
import { OrderDressItem, OrderStatus } from '../../models/order.model';
import { DressConfig, MeasurementField } from '../../models/dress-config.model';

export interface DressEntry {
  dressType: string;
  fields: MeasurementField[];
  measurements: Record<string, string>;
  imagePreview: string | null;
}

@Component({
  selector: 'app-add-order',
  templateUrl: './add-order.page.html',
  styleUrls: ['./add-order.page.scss'],
  standalone: false,
})
export class AddOrderPage implements OnInit {
  form!: FormGroup;
  dressConfigs: DressConfig[] = [];
  statuses: OrderStatus[] = [];
  isEdit = false;
  customerId = '';
  orderId = '';
  customer: Customer | undefined;
  customers: Customer[] = [];
  showMeasurePrompt = false;
  promptHeight = '';
  promptWeight = '';
  promptGender: 'male' | 'female' = 'male';
  promptTargetIndex = 0;
  previewOrderNo = parseInt(localStorage.getItem('tailor_order_seq') || '0', 10) + 1;
  dressEntries: DressEntry[] = [];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private storage: StorageService,
    private toastCtrl: ToastController,
    private actionSheetCtrl: ActionSheetController
  ) {}

  ngOnInit() {
    this.customerId = this.route.snapshot.paramMap.get('customerId') || '';
    this.orderId = this.route.snapshot.paramMap.get('orderId') || 'new';
    this.isEdit = this.orderId !== 'new';
    const pickingCustomer = this.customerId === 'pick';

    this.customers = this.storage.getCustomers();
    this.dressConfigs = this.storage.getDressConfigs();
    this.statuses = this.storage.getStatuses();

    // pre-load customer if already known
    if (this.customerId && this.customerId !== 'pick') {
      this.customer = this.storage.getCustomer(this.customerId);
    }

    this.form = this.fb.group({
      customerId: [pickingCustomer ? '' : this.customerId, Validators.required],
      quantity:   [1, [Validators.required, Validators.min(1)]],
      price:      [''],
      orderedDate:[new Date().toISOString().split('T')[0]],
      dueDate:    [''],
      status:     [this.storage.getDefaultStatus(), Validators.required],
      notes:      ['']
    });

    if (this.isEdit) {
      this.storage.getOrder(this.orderId).then(async order => {
        if (!order) return;
        this.previewOrderNo = order.orderNo ?? 0;

        if (order.dressItems && order.dressItems.length > 0) {
          for (const item of order.dressItems) {
            const config = this.dressConfigs.find(c => c.name === item.dressType);
            this.dressEntries.push({
              dressType: item.dressType,
              fields: config?.fields || [],
              measurements: { ...item.measurements },
              imagePreview: item.imageUrl || null
            });
          }
        } else {
          const config = this.dressConfigs.find(c => c.name === order.dressType);
          const withImg = await this.storage.getOrderWithImage(order.id);
          this.dressEntries.push({
            dressType: order.dressType,
            fields: config?.fields || [],
            measurements: { ...order.measurements },
            imagePreview: withImg?.imageUrl || null
          });
        }

        this.form.patchValue({
          customerId: order.customerId,
          quantity: order.quantity, price: order.price || '',
          orderedDate: order.orderedDate || new Date().toISOString().split('T')[0],
          dueDate: order.dueDate || '', status: order.status,
          notes: order.notes || ''
        });
        this.customerId = order.customerId;
        if (this.customerId) this.customer = this.storage.getCustomer(this.customerId);
      });
    } else {
      this.addDressEntry();
      // prefill first entry if customer already known
      if (this.customer) this.prefillEntry(0);
    }
  }

  // ── Dress Entries ──────────────────────────────────────────────

  addDressEntry() {
    const first = this.dressConfigs[0];
    this.dressEntries.push({ dressType: first?.name || '', fields: first?.fields || [], measurements: {}, imagePreview: null });
  }

  removeDressEntry(index: number) {
    if (this.dressEntries.length === 1) return;
    this.dressEntries.splice(index, 1);
  }

  onEntryDressTypeChange(index: number, event: any) {
    const config = this.dressConfigs.find(c => c.name === event.detail.value);
    const entry = this.dressEntries[index];
    entry.dressType = event.detail.value;
    entry.fields = config?.fields || [];
    entry.measurements = {};
    this.prefillEntry(index);
  }

  prefillEntry(index: number) {
    if (!this.customer) return;
    const entry = this.dressEntries[index];
    const match = this.customer.measurements.find(m => m.dressType === entry.dressType);
    if (match) entry.measurements = { ...match.measurements };
  }

  onCustomerChange(event: any) {
    this.customerId = event.detail.value;
    this.customer = this.storage.getCustomer(this.customerId);
    this.dressEntries.forEach((_, i) => this.prefillEntry(i));
  }

  // ── Image per entry ────────────────────────────────────────────

  async pickImageForEntry(index: number) {
    const sheet = await this.actionSheetCtrl.create({
      header: 'Add Photo',
      buttons: [
        { text: 'Take Photo',          icon: 'camera-outline', handler: () => this.captureForEntry(index, CameraSource.Camera) },
        { text: 'Choose from Gallery', icon: 'image-outline',  handler: () => this.captureForEntry(index, CameraSource.Photos) },
        { text: 'Cancel', role: 'cancel' }
      ]
    });
    await sheet.present();
  }

  private async captureForEntry(index: number, source: CameraSource) {
    try {
      const photo = await Camera.getPhoto({ resultType: CameraResultType.DataUrl, source, quality: 70, width: 1024 });
      this.dressEntries[index].imagePreview = await this.compressImage(photo.dataUrl!);
      this.promptTargetIndex = index;
      this.showMeasurePrompt = true;
    } catch { /* cancelled */ }
  }

  removeImageForEntry(index: number) { this.dressEntries[index].imagePreview = null; }

  // ── Measure estimate prompt ────────────────────────────────────

  dismissPrompt() { this.showMeasurePrompt = false; }

  applyEstimate() {
    const h = parseFloat(this.promptHeight);
    const w = parseFloat(this.promptWeight);
    if (!h || !w) { this.showMeasurePrompt = false; return; }
    const isMale = this.promptGender === 'male';
    const bmi = w / ((h / 100) * (h / 100));
    const estimates: Record<string, string> = {
      chest:        (h * (isMale ? 0.305 : 0.295) + (bmi - 22) * 0.6).toFixed(1),
      waist:        (h * (isMale ? 0.245 : 0.235) + (bmi - 22) * 0.7).toFixed(1),
      hip:          (h * (isMale ? 0.300 : 0.320) + (bmi - 22) * 0.55).toFixed(1),
      shoulder:     (h * 0.238 + (isMale ? 1 : -0.5)).toFixed(1),
      sleeveLength: (h * 0.345).toFixed(1),
      length:       (h * (isMale ? 0.445 : 0.420)).toFixed(1),
    };
    const entry = this.dressEntries[this.promptTargetIndex];
    entry.fields.forEach(f => { if (estimates[f.key]) entry.measurements[f.key] = estimates[f.key]; });
    this.showMeasurePrompt = false;
  }

  // ── Save ───────────────────────────────────────────────────────

  async save() {
    if (this.form.invalid) return;
    const v = this.form.value;
    const selectedCustomer = this.storage.getCustomer(v.customerId);

    const dressItems: OrderDressItem[] = this.dressEntries.map(e => ({
      dressType: e.dressType,
      measurements: { ...e.measurements },
      imageUrl: e.imagePreview || undefined
    }));

    const payload = {
      customerId:   v.customerId,
      customerName: selectedCustomer?.name || '',
      dressType:    dressItems[0]?.dressType || '',
      quantity:     v.quantity, price: v.price,
      orderedDate:  v.orderedDate,
      dueDate:      v.dueDate, status: v.status as OrderStatus,
      measurements: dressItems[0]?.measurements || {},
      dressItems,
      notes:        v.notes,
      imageUrl:     dressItems[0]?.imageUrl
    };

    if (this.isEdit) {
      const existing = await this.storage.getOrder(this.orderId);
      if (existing) await this.storage.updateOrder({ ...existing, ...payload });
    } else {
      await this.storage.addOrder(payload);
    }

    const toast = await this.toastCtrl.create({
      message: this.isEdit ? 'Order updated!' : 'Order created!',
      duration: 2000, position: 'bottom', color: 'dark'
    });
    await toast.present();
    this.router.navigateByUrl('/orders');
  }

  // ── Share Sheet ────────────────────────────────────────────────

  async showShareSheet() {
    const sheet = await this.actionSheetCtrl.create({
      header: 'Order Actions',
      buttons: [
        { text: 'Print / Save PDF',  icon: 'print-outline',   handler: () => this.printPdf() },
        { text: 'Send via WhatsApp', icon: 'logo-whatsapp',   handler: () => this.sendWhatsApp() },
        { text: 'Cancel', role: 'cancel', icon: 'close-outline' }
      ]
    });
    await sheet.present();
  }

  printPdf() {
    const win = window.open('', '_blank', 'width=820,height=960');
    if (!win) return;
    win.document.write(this.buildOrderHtml());
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  }

  sendWhatsApp() {
    const v = this.form.value;
    const c = this.customer;
    const phone = c?.phone?.replace(/[^0-9]/g, '') || '';

    const items = this.dressEntries.map(e => {
      const mList = e.fields
        .filter(f => e.measurements[f.key])
        .map(f => `  • ${f.label}: *${e.measurements[f.key]}*"`)
        .join('\n');
      return `*${e.dressType}*\n${mList || '  (no measurements)'}`;
    }).join('\n\n');

    const lines = [
      `🧵 *Order #${this.previewOrderNo} — MyTailorBook*`,
      `👤 ${c?.name || ''}`,
      c?.phone ? `📞 ${c.phone}` : null,
      ``,
      `📅 Order Date: ${v.orderedDate || '—'}`,
      v.dueDate ? `⏰ Due Date: ${v.dueDate}` : null,
      `🏷️ Status: ${v.status}`,
      v.price ? `💰 Price: ₨ ${v.price}` : null,
      ``,
      `📐 *Measurements:*`,
      items,
      v.notes ? `\n📝 Notes: ${v.notes}` : null
    ].filter(l => l !== null).join('\n');

    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(lines)}`
      : `https://wa.me/?text=${encodeURIComponent(lines)}`;

    window.open(url, '_blank');
  }

  // ── PDF HTML builder ───────────────────────────────────────────

  private buildOrderHtml(): string {
    const v = this.form.value;
    const c = this.customer;
    const statusColors: Record<string, string> = {
      'Pending': '#f59e0b', 'In Progress': '#0ea5e9', 'Ready': '#10b981', 'Delivered': '#94a3b8'
    };
    const sColor = statusColors[v.status] || '#6c63ff';

    const dressBlocks = this.dressEntries.map((entry, i) => {
      const thumbHtml = entry.imagePreview
        ? `<img src="${entry.imagePreview}" class="dress-thumb" alt=""/>`
        : '<div class="dress-thumb-empty"></div>';

      const chips = entry.fields
        .map(f => `<div class="m-chip"><span class="m-val">${entry.measurements[f.key] || '—'}&quot;</span><span class="m-lbl">${f.label}</span></div>`)
        .join('');

      return `
      <div class="dress-block">
        <div class="db-header">
          ${thumbHtml}
          <div class="db-meta">
            <div class="db-badge">${entry.dressType}</div>
            <div class="db-count">${entry.fields.length} measurements</div>
          </div>
        </div>
        ${chips ? `<div class="m-chips">${chips}</div>` : '<div class="m-empty">No measurements recorded</div>'}
      </div>`;
    }).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Order #${this.previewOrderNo}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#eef2f7;padding:20px;color:#1e293b;font-size:13px}
  .page{max-width:680px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 40px rgba(0,0,0,0.13)}

  /* ── Header ── */
  .hdr{background:linear-gradient(120deg,#0f172a 0%,#1d4ed8 55%,#0ea5e9 100%);padding:22px 28px;display:flex;justify-content:space-between;align-items:center}
  .hdr-left .brand{font-size:20px;font-weight:900;color:#fff;letter-spacing:-0.3px}
  .hdr-left .tagline{font-size:10px;color:rgba(255,255,255,0.55);letter-spacing:1.2px;text-transform:uppercase;margin-top:2px}
  .hdr-right{text-align:right}
  .hdr-right .ord-no{font-size:26px;font-weight:900;color:#fff;line-height:1}
  .hdr-right .ord-lbl{font-size:9px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px}

  /* ── Status strip ── */
  .strip{background:${sColor}15;border-left:4px solid ${sColor};padding:8px 28px;display:flex;align-items:center;gap:8px}
  .strip-dot{width:8px;height:8px;border-radius:50%;background:${sColor};flex-shrink:0}
  .strip-status{font-size:11px;font-weight:800;color:${sColor};text-transform:uppercase;letter-spacing:.8px}
  .strip-dates{margin-left:auto;font-size:11px;color:#64748b;display:flex;gap:14px}

  /* ── Body ── */
  .body{padding:20px 28px}

  /* ── Info row ── */
  .info-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
  .card{background:#f8fafc;border:1px solid #e8edf3;border-radius:10px;padding:12px 14px}
  .card-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px}
  .cust-name{font-size:15px;font-weight:900;color:#0f172a;margin-bottom:3px}
  .cust-sub{font-size:11px;color:#64748b;margin-top:2px}
  .kv{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9}
  .kv:last-child{border:none}
  .kv-k{font-size:11px;color:#94a3b8}
  .kv-v{font-size:11px;font-weight:700;color:#1e293b}

  /* ── Section title ── */
  .sec{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin:16px 0 8px}

  /* ── Dress block ── */
  .dress-block{border:1px solid #e8edf3;border-radius:10px;overflow:hidden;margin-bottom:10px}
  .db-header{display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e8edf3}
  .dress-thumb{width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;flex-shrink:0}
  .dress-thumb-empty{width:40px;height:40px;border-radius:6px;background:#f1f5f9;flex-shrink:0}
  .db-meta{flex:1}
  .db-badge{display:inline-block;background:linear-gradient(135deg,#6c63ff,#818cf8);color:#fff;font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px;letter-spacing:.2px}
  .db-count{font-size:10px;color:#94a3b8;margin-top:2px}

  /* ── Measurement chips ── */
  .m-chips{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px}
  .m-chip{display:flex;flex-direction:column;align-items:center;background:#f8fafc;border:1px solid #e8edf3;border-radius:8px;padding:5px 10px;min-width:60px}
  .m-val{font-size:13px;font-weight:800;color:#6c63ff;line-height:1.2}
  .m-lbl{font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.4px;margin-top:1px;white-space:nowrap}
  .m-empty{padding:10px 12px;font-size:11px;color:#94a3b8;font-style:italic}

  /* ── Notes ── */
  .notes{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 14px;margin-top:12px}
  .notes p{font-size:12px;color:#92400e;line-height:1.5}

  /* ── Footer ── */
  .ftr{background:#f8fafc;border-top:1px solid #e8edf3;padding:12px 28px;display:flex;justify-content:space-between;align-items:center}
  .ftr-brand{font-size:10px;color:#94a3b8}
  .ftr-price{font-size:18px;font-weight:900;color:#10b981;text-align:right}
  .ftr-price small{display:block;font-size:10px;font-weight:500;color:#94a3b8}

  @media print{body{background:#fff;padding:0}.page{box-shadow:none;border-radius:0}}
</style></head><body>
<div class="page">

  <div class="hdr">
    <div class="hdr-left">
      <div class="brand">MyTailorBook</div>
      <div class="tagline">Professional Tailoring</div>
    </div>
    <div class="hdr-right">
      <div class="ord-lbl">Order No</div>
      <div class="ord-no">#${this.previewOrderNo}</div>
    </div>
  </div>

  <div class="strip">
    <div class="strip-dot"></div>
    <div class="strip-status">${v.status}</div>
    <div class="strip-dates">
      ${v.orderedDate ? `<span>&#128197; ${v.orderedDate}</span>` : ''}
      ${v.dueDate     ? `<span>&#9200; Due ${v.dueDate}</span>` : ''}
    </div>
  </div>

  <div class="body">

    <div class="info-row">
      <div class="card">
        <div class="card-title">Customer</div>
        <div class="cust-name">${c?.name || v.customerId}</div>
        ${c?.phone   ? `<div class="cust-sub">&#128222; ${c.phone}</div>` : ''}
        ${c?.address ? `<div class="cust-sub">&#128205; ${c.address}</div>` : ''}
      </div>
      <div class="card">
        <div class="card-title">Order Info</div>
        <div class="kv"><span class="kv-k">Quantity</span><span class="kv-v">${v.quantity} pcs</span></div>
        ${v.price ? `<div class="kv"><span class="kv-k">Price</span><span class="kv-v">&#8360; ${v.price}</span></div>` : ''}
        <div class="kv"><span class="kv-k">Dress Types</span><span class="kv-v">${this.dressEntries.length}</span></div>
      </div>
    </div>

    <div class="sec">Dress Items &amp; Measurements</div>
    ${dressBlocks}

    ${v.notes ? `<div class="notes"><div class="sec" style="margin:0 0 4px">Notes</div><p>${v.notes}</p></div>` : ''}

  </div>

  <div class="ftr">
    <div class="ftr-brand">MyTailorBook &middot; ${new Date().toLocaleDateString()}</div>
    ${v.price ? `<div class="ftr-price">&#8360; ${v.price}<small>Total Price</small></div>` : ''}
  </div>

</div>
</body></html>`;
  }

  // ── Image compress ─────────────────────────────────────────────

  private compressImage(dataUrl: string): Promise<string> {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const MAX = 1200;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.round(width * ratio); height = Math.round(height * ratio);
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        let quality = 0.7;
        let result = canvas.toDataURL('image/jpeg', quality);
        while (result.length > 300 * 1024 * 1.37 && quality > 0.1) {
          quality -= 0.1;
          result = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(result);
      };
      img.src = dataUrl;
    });
  }
}
