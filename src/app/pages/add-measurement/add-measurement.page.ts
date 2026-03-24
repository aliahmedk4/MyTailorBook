import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { StorageService } from '../../services/storage.service';

const DRESS_TYPES = ['Shirt', 'Pant', 'Blouse', 'Suit', 'Kurta', 'Custom'];

@Component({
  selector: 'app-add-measurement',
  templateUrl: './add-measurement.page.html',
  styleUrls: ['./add-measurement.page.scss'],
  standalone: false,
})
export class AddMeasurementPage implements OnInit {
  form!: FormGroup;
  dressTypes = DRESS_TYPES;
  isEdit = false;
  customerId = '';
  measurementId = '';
  showCustomInput = false;

  measurementFields = [
    { key: 'chest', label: 'Chest' },
    { key: 'waist', label: 'Waist' },
    { key: 'hip', label: 'Hip' },
    { key: 'shoulder', label: 'Shoulder' },
    { key: 'sleeveLength', label: 'Sleeve Length' },
    { key: 'length', label: 'Length' },
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
    this.measurementId = this.route.snapshot.paramMap.get('measurementId') || 'new';
    this.isEdit = this.measurementId !== 'new';

    this.form = this.fb.group({
      dressType: ['Shirt'],
      customDressType: [''],
      chest: [''], waist: [''], hip: [''],
      shoulder: [''], sleeveLength: [''], length: [''],
      notes: ['']
    });

    if (this.isEdit) {
      const customer = this.storage.getCustomer(this.customerId);
      const m = customer?.measurements.find(x => x.id === this.measurementId);
      if (m) {
        const isCustom = !DRESS_TYPES.includes(m.dressType);
        this.showCustomInput = isCustom;
        this.form.patchValue({
          dressType: isCustom ? 'Custom' : m.dressType,
          customDressType: isCustom ? m.dressType : '',
          ...m.measurements,
          notes: m.notes || ''
        });
      }
    }
  }

  onDressTypeChange(event: any) {
    this.showCustomInput = event.detail.value === 'Custom';
  }

  async save() {
    const v = this.form.value;
    const dressType = v.dressType === 'Custom' ? (v.customDressType || 'Custom') : v.dressType;
    const measurements = { chest: v.chest, waist: v.waist, hip: v.hip, shoulder: v.shoulder, sleeveLength: v.sleeveLength, length: v.length };

    if (this.isEdit) {
      this.storage.updateMeasurement(this.customerId, { id: this.measurementId, dressType, measurements, notes: v.notes });
    } else {
      this.storage.addMeasurement(this.customerId, { dressType, measurements, notes: v.notes });
    }

    const toast = await this.toastCtrl.create({ message: this.isEdit ? 'Measurement updated!' : 'Measurement saved!', duration: 2000, position: 'bottom', color: 'dark' });
    await toast.present();
    this.router.navigateByUrl(`/customer-detail/${this.customerId}`);
  }
}
