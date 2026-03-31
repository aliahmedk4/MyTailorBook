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
        ? `<img src="${entry.imagePreview}" class="dress-thumb" alt="dress ${i + 1}"/>`
        : '';
      const cells = entry.fields.map(f =>
        `<div class="measure-cell"><strong>${entry.measurements[f.key] || '—'}</strong><span>${f.label}</span></div>`
      ).join('');
      return `
        <div class="dress-block">
          <div class="dress-block-header">
            <div class="dress-type-badge">${entry.dressType}</div>
            ${thumbHtml}
          </div>
          ${cells ? `<div class="measure-grid">${cells}</div>` : ''}
        </div>`;
    }).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Order #${this.previewOrderNo}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; background:#f0f4f8; padding:24px; color:#1e293b; }
  .page { max-width:740px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 32px rgba(0,0,0,0.12); }
  .header { background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#0ea5e9 100%); padding:28px 32px; display:flex; justify-content:space-between; align-items:flex-start; }
  .shop-name { font-size:24px; font-weight:900; color:#fff; letter-spacing:-0.5px; }
  .shop-sub  { font-size:11px; color:rgba(255,255,255,0.6); margin-top:4px; letter-spacing:1px; text-transform:uppercase; }
  .order-badge { background:rgba(255,255,255,0.15); border:1.5px solid rgba(255,255,255,0.3); border-radius:12px; padding:10px 18px; text-align:right; }
  .order-badge .no  { font-size:22px; font-weight:900; color:#fff; }
  .order-badge .lbl { font-size:10px; color:rgba(255,255,255,0.6); text-transform:uppercase; letter-spacing:1px; }
  .status-bar { background:${sColor}18; border-bottom:3px solid ${sColor}; padding:10px 32px; display:flex; align-items:center; gap:10px; }
  .status-dot  { width:10px; height:10px; border-radius:50%; background:${sColor}; flex-shrink:0; }
  .status-text { font-size:12px; font-weight:800; color:${sColor}; text-transform:uppercase; letter-spacing:1px; }
  .status-dates { margin-left:auto; font-size:12px; color:#64748b; display:flex; gap:16px; }
  .body { padding:24px 32px; }
  .section-title { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:1.2px; color:#94a3b8; margin-bottom:10px; }
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; }
  .info-card { background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; padding:14px; }
  .info-row { display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #f1f5f9; }
  .info-row:last-child { border-bottom:none; }
  .info-lbl { font-size:12px; color:#94a3b8; }
  .info-val { font-size:12px; color:#1e293b; font-weight:700; }
  .customer-name  { font-size:16px; font-weight:900; color:#1e293b; margin-bottom:4px; }
  .customer-phone { font-size:12px; color:#64748b; margin-top:3px; }
  .dress-block { margin-bottom:20px; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden; }
  .dress-block-header { background:#f8fafc; padding:10px 16px; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; gap:12px; }
  .dress-type-badge { background:linear-gradient(135deg,#6c63ff,#a78bfa); color:#fff; font-size:12px; font-weight:800; padding:4px 14px; border-radius:20px; flex-shrink:0; }
  .dress-thumb { width:48px; height:48px; object-fit:cover; border-radius:8px; border:1px solid #e2e8f0; margin-left:auto; flex-shrink:0; }
  .measure-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:#e2e8f0; }
  .measure-cell { background:#fff; padding:12px 8px; text-align:center; }
  .measure-cell strong { display:block; font-size:18px; font-weight:900; color:#6c63ff; }
  .measure-cell span   { font-size:10px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; font-weight:700; }
  .notes-box { background:#fffbeb; border:1px solid #fde68a; border-radius:12px; padding:14px 16px; margin-bottom:20px; }
  .notes-box p { font-size:13px; color:#92400e; line-height:1.6; }
  .footer { background:#f8fafc; border-top:1px solid #e2e8f0; padding:14px 32px; display:flex; justify-content:space-between; align-items:center; }
  .footer-brand { font-size:11px; color:#94a3b8; }
  .footer-price { font-size:20px; font-weight:900; color:#10b981; }
  .footer-price span { font-size:11px; font-weight:500; color:#94a3b8; display:block; text-align:right; }
  @media print { body { background:#fff; padding:0; } .page { box-shadow:none; border-radius:0; } }
</style></head><body>
<div class="page">
  <div class="header">
    <div>
      <div class="shop-name">MyTailorBook</div>
      <div class="shop-sub">Professional Tailoring</div>
    </div>
    <div class="order-badge">
      <div class="lbl">Order No</div>
      <div class="no">#${this.previewOrderNo}</div>
    </div>
  </div>
  <div class="status-bar">
    <div class="status-dot"></div>
    <div class="status-text">${v.status}</div>
    <div class="status-dates">
      ${v.orderedDate ? `<span>📅 Ordered: <strong>${v.orderedDate}</strong></span>` : ''}
      ${v.dueDate     ? `<span>⏰ Due: <strong>${v.dueDate}</strong></span>` : ''}
    </div>
  </div>
  <div class="body">
    <div class="two-col">
      <div>
        <div class="section-title">Customer</div>
        <div class="info-card">
          <div class="customer-name">${c?.name || v.customerId}</div>
          ${c?.phone   ? `<div class="customer-phone">📞 ${c.phone}</div>` : ''}
          ${c?.address ? `<div class="customer-phone">📍 ${c.address}</div>` : ''}
        </div>
      </div>
      <div>
        <div class="section-title">Order Info</div>
        <div class="info-card">
          <div class="info-row"><span class="info-lbl">Quantity</span><span class="info-val">${v.quantity} pcs</span></div>
          <div class="info-row"><span class="info-lbl">Dress Types</span><span class="info-val">${this.dressEntries.length}</span></div>
        </div>
      </div>
    </div>
    <div class="section-title">Dress Items & Measurements</div>
    ${dressBlocks}
    ${v.notes ? `<div class="notes-box"><div class="section-title" style="margin-bottom:6px">Notes</div><p>${v.notes}</p></div>` : ''}
  </div>
  <div class="footer">
    <div class="footer-brand">Generated by MyTailorBook · ${new Date().toLocaleDateString()}</div>
    ${v.price ? `<div class="footer-price">₨ ${v.price}<span>Total Price</span></div>` : ''}
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
