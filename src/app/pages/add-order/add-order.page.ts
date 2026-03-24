import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { StorageService } from '../../services/storage.service';
import { Customer } from '../../models/customer.model';
import { OrderStatus } from '../../models/order.model';

const DRESS_TYPES = ['Shirt', 'Pant', 'Blouse', 'Suit', 'Kurta', 'Custom'];

@Component({
  selector: 'app-add-order',
  templateUrl: './add-order.page.html',
  styleUrls: ['./add-order.page.scss'],
  standalone: false,
})
export class AddOrderPage implements OnInit {
  form!: FormGroup;
  dressTypes = DRESS_TYPES;
  statuses: OrderStatus[] = ['Pending', 'In Progress', 'Ready', 'Delivered'];
  showCustomDress = false;
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

  measurementFields = [
    { key: 'chest', label: 'Chest' }, { key: 'waist', label: 'Waist' },
    { key: 'hip', label: 'Hip' }, { key: 'shoulder', label: 'Shoulder' },
    { key: 'sleeveLength', label: 'Sleeve' }, { key: 'length', label: 'Length' },
  ];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private storage: StorageService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.customerId = this.route.snapshot.paramMap.get('customerId') || '';
    this.orderId = this.route.snapshot.paramMap.get('orderId') || 'new';
    this.isEdit = this.orderId !== 'new';
    const pickingCustomer = this.customerId === 'pick';

    this.customers = this.storage.getCustomers();

    this.form = this.fb.group({
      customerId: [pickingCustomer ? '' : this.customerId, Validators.required],
      dressType: ['Shirt', Validators.required],
      customDressType: [''],
      quantity: [1, [Validators.required, Validators.min(1)]],
      price: [''],
      dueDate: [''],
      status: ['Pending', Validators.required],
      chest: [''], waist: [''], hip: [''],
      shoulder: [''], sleeveLength: [''], length: [''],
      notes: ['']
    });

    if (this.isEdit) {
      const order = this.storage.getOrder(this.orderId);
      if (order) {
        const isCustom = !DRESS_TYPES.includes(order.dressType);
        this.showCustomDress = isCustom;
        this.imagePreview = order.imageUrl || null;
        this.form.patchValue({
          customerId: order.customerId,
          dressType: isCustom ? 'Custom' : order.dressType,
          customDressType: isCustom ? order.dressType : '',
          quantity: order.quantity, price: order.price || '',
          dueDate: order.dueDate || '', status: order.status,
          ...order.measurements, notes: order.notes || ''
        });
        this.customerId = order.customerId;
      }
    }

    if (!pickingCustomer && this.customerId) {
      this.customer = this.storage.getCustomer(this.customerId);
    }
  }

  onCustomerChange(event: any) {
    this.customerId = event.detail.value;
    this.customer = this.storage.getCustomer(this.customerId);
    this.prefillFromMeasurements();
  }

  onDressTypeChange(event: any) {
    this.showCustomDress = event.detail.value === 'Custom';
    this.prefillFromMeasurements();
  }

  prefillFromMeasurements() {
    if (!this.customer) return;
    const match = this.customer.measurements.find(m => m.dressType === this.form.value.dressType);
    if (match) this.form.patchValue({ ...match.measurements });
  }

  onImagePicked(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreview = reader.result as string;
      this.showMeasurePrompt = true;
    };
    reader.readAsDataURL(file);
  }

  removeImage() { this.imagePreview = null; }

  dismissPrompt() { this.showMeasurePrompt = false; }

  applyEstimate() {
    const h = parseFloat(this.promptHeight);
    const w = parseFloat(this.promptWeight);
    if (!h || !w) { this.showMeasurePrompt = false; return; }

    // Standard body proportion formulas (inches)
    const isMale = this.promptGender === 'male';
    const bmi = w / ((h / 100) * (h / 100));
    const chest     = +(h * (isMale ? 0.305 : 0.295) + (bmi - 22) * 0.6).toFixed(1);
    const waist     = +(h * (isMale ? 0.245 : 0.235) + (bmi - 22) * 0.7).toFixed(1);
    const hip       = +(h * (isMale ? 0.300 : 0.320) + (bmi - 22) * 0.55).toFixed(1);
    const shoulder  = +(h * 0.238 + (isMale ? 1 : -0.5)).toFixed(1);
    const sleeve    = +(h * 0.345).toFixed(1);
    const length    = +(h * (isMale ? 0.445 : 0.420)).toFixed(1);

    this.form.patchValue({ chest, waist, hip, shoulder, sleeveLength: sleeve, length });
    this.showMeasurePrompt = false;
  }

  async save() {
    if (this.form.invalid) return;
    const v = this.form.value;
    const dressType = v.dressType === 'Custom' ? (v.customDressType || 'Custom') : v.dressType;
    const selectedCustomer = this.storage.getCustomer(v.customerId);

    const payload = {
      customerId: v.customerId,
      customerName: selectedCustomer?.name || '',
      dressType, quantity: v.quantity, price: v.price,
      dueDate: v.dueDate, status: v.status as OrderStatus,
      measurements: { chest: v.chest, waist: v.waist, hip: v.hip, shoulder: v.shoulder, sleeveLength: v.sleeveLength, length: v.length },
      notes: v.notes,
      imageUrl: this.imagePreview || undefined
    };

    if (this.isEdit) {
      this.storage.updateOrder({ ...this.storage.getOrder(this.orderId)!, ...payload });
    } else {
      this.storage.addOrder(payload);
    }

    const toast = await this.toastCtrl.create({
      message: this.isEdit ? 'Order updated!' : 'Order created!',
      duration: 2000, position: 'bottom', color: 'dark'
    });
    await toast.present();
    this.router.navigateByUrl('/orders');
  }
}
