import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ActionSheetController, ToastController } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { StorageService } from '../../services/storage.service';
import { Customer } from '../../models/customer.model';
import { OrderStatus } from '../../models/order.model';
import { DressConfig, MeasurementField } from '../../models/dress-config.model';

@Component({
  selector: 'app-add-order',
  templateUrl: './add-order.page.html',
  styleUrls: ['./add-order.page.scss'],
  standalone: false,
})
export class AddOrderPage implements OnInit {
  form!: FormGroup;
  dressConfigs: DressConfig[] = [];
  statuses: OrderStatus[] = ['Pending', 'In Progress', 'Ready', 'Delivered'];
  isEdit = false;
  customerId = '';
  orderId = '';
  customer: Customer | undefined;
  customers: Customer[] = [];
  imagePreview: string | null = null;
  showMeasurePrompt = false;
  promptHeight = '';
  promptWeight = '';
  promptGender: 'male' | 'female' = 'male';
  measurementFields: MeasurementField[] = [];

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

    const firstType = this.dressConfigs[0]?.name || '';
    this.measurementFields = this.dressConfigs[0]?.fields || [];

    this.form = this.fb.group({
      customerId: [pickingCustomer ? '' : this.customerId, Validators.required],
      dressType: [firstType, Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      price: [''],
      dueDate: [''],
      orderDate: [new Date().toISOString().split('T')[0]],
      status: ['Pending', Validators.required],
      notes: ['']
    });

    if (this.isEdit) {
      this.storage.getOrderWithImage(this.orderId).then(order => {
        if (!order) return;
        this.imagePreview = order.imageUrl || null;
        const config = this.dressConfigs.find(c => c.name === order.dressType);
        this.measurementFields = config?.fields || [];
        this.addMeasurementControls(this.measurementFields, order.measurements);
        this.form.patchValue({
          customerId: order.customerId,
          dressType: order.dressType,
          quantity: order.quantity, price: order.price || '',
          dueDate: order.dueDate || '', orderDate: order.orderDate || '', status: order.status,
          notes: order.notes || ''
        });
        this.customerId = order.customerId;
        if (this.customerId) this.customer = this.storage.getCustomer(this.customerId);
      });
    } else {
      this.addMeasurementControls(this.measurementFields, {});
    }
  }

  private addMeasurementControls(fields: MeasurementField[], values: Record<string, string>) {
    // Remove old measurement controls
    const keep = ['customerId', 'dressType', 'quantity', 'price', 'dueDate', 'status', 'notes'];
    Object.keys(this.form.controls).forEach(k => { if (!keep.includes(k)) this.form.removeControl(k); });
    fields.forEach(f => this.form.addControl(f.key, this.fb.control(values[f.key] || '')));
  }

  onCustomerChange(event: any) {
    this.customerId = event.detail.value;
    this.customer = this.storage.getCustomer(this.customerId);
    this.prefillFromMeasurements();
  }

  onDressTypeChange(event: any) {
    const config = this.dressConfigs.find(c => c.name === event.detail.value);
    this.measurementFields = config?.fields || [];
    this.addMeasurementControls(this.measurementFields, {});
    this.prefillFromMeasurements();
  }

  prefillFromMeasurements() {
    if (!this.customer) return;
    const match = this.customer.measurements.find(m => m.dressType === this.form.value.dressType);
    if (match) this.form.patchValue({ ...match.measurements });
  }

  async pickImage() {
    const sheet = await this.actionSheetCtrl.create({
      header: 'Add Photo',
      buttons: [
        { text: 'Take Photo', icon: 'camera-outline', handler: () => this.captureImage(CameraSource.Camera) },
        { text: 'Choose from Gallery', icon: 'image-outline', handler: () => this.captureImage(CameraSource.Photos) },
        { text: 'Cancel', role: 'cancel' }
      ]
    });
    await sheet.present();
  }

  private async captureImage(source: CameraSource) {
    try {
      const photo = await Camera.getPhoto({ resultType: CameraResultType.DataUrl, source, quality: 70, width: 1024 });
      this.imagePreview = await this.compressImage(photo.dataUrl!);
      this.showMeasurePrompt = true;
    } catch { /* user cancelled */ }
  }

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

  removeImage() { this.imagePreview = null; }
  dismissPrompt() { this.showMeasurePrompt = false; }

  applyEstimate() {
    const h = parseFloat(this.promptHeight);
    const w = parseFloat(this.promptWeight);
    if (!h || !w) { this.showMeasurePrompt = false; return; }
    const isMale = this.promptGender === 'male';
    const bmi = w / ((h / 100) * (h / 100));
    const estimates: Record<string, string> = {
      chest:         (h * (isMale ? 0.305 : 0.295) + (bmi - 22) * 0.6).toFixed(1),
      waist:         (h * (isMale ? 0.245 : 0.235) + (bmi - 22) * 0.7).toFixed(1),
      hip:           (h * (isMale ? 0.300 : 0.320) + (bmi - 22) * 0.55).toFixed(1),
      shoulder:      (h * 0.238 + (isMale ? 1 : -0.5)).toFixed(1),
      sleeveLength:  (h * 0.345).toFixed(1),
      length:        (h * (isMale ? 0.445 : 0.420)).toFixed(1),
    };
    // Only patch fields that exist in current form
    const patch: Record<string, string> = {};
    this.measurementFields.forEach(f => { if (estimates[f.key]) patch[f.key] = estimates[f.key]; });
    this.form.patchValue(patch);
    this.showMeasurePrompt = false;
  }

  async save() {
    if (this.form.invalid) return;
    const v = this.form.value;
    const selectedCustomer = this.storage.getCustomer(v.customerId);
    const measurements: Record<string, string> = {};
    this.measurementFields.forEach(f => { measurements[f.key] = v[f.key] || ''; });

    const payload = {
      customerId: v.customerId,
      customerName: selectedCustomer?.name || '',
      dressType: v.dressType,
      quantity: v.quantity, price: v.price,
      dueDate: v.dueDate, orderDate: v.orderDate, status: v.status as OrderStatus,
      measurements, notes: v.notes,
      imageUrl: this.imagePreview || undefined
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
}
