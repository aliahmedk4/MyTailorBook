import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { StorageService } from '../../services/storage.service';
import { DressConfig, MeasurementField } from '../../models/dress-config.model';

@Component({
  selector: 'app-add-measurement',
  templateUrl: './add-measurement.page.html',
  styleUrls: ['./add-measurement.page.scss'],
  standalone: false,
})
export class AddMeasurementPage implements OnInit {
  form!: FormGroup;
  dressConfigs: DressConfig[] = [];
  measurementFields: MeasurementField[] = [];
  isEdit = false;
  customerId = '';
  measurementId = '';

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
    this.dressConfigs = this.storage.getDressConfigs();

    const firstConfig = this.dressConfigs[0];
    this.measurementFields = firstConfig?.fields || [];

    this.form = this.fb.group({ dressType: [firstConfig?.name || ''], notes: [''] });
    this.addMeasurementControls(this.measurementFields, {});

    if (this.isEdit) {
      const customer = this.storage.getCustomer(this.customerId);
      const m = customer?.measurements.find(x => x.id === this.measurementId);
      if (m) {
        const config = this.dressConfigs.find(c => c.name === m.dressType);
        this.measurementFields = config?.fields || [];
        this.addMeasurementControls(this.measurementFields, m.measurements);
        this.form.patchValue({ dressType: m.dressType, notes: m.notes || '' });
      }
    }
  }

  private addMeasurementControls(fields: MeasurementField[], values: Record<string, string>) {
    const keep = ['dressType', 'notes'];
    Object.keys(this.form.controls).forEach(k => { if (!keep.includes(k)) this.form.removeControl(k); });
    fields.forEach(f => this.form.addControl(f.key, this.fb.control(values[f.key] || '')));
  }

  onDressTypeChange(event: any) {
    const config = this.dressConfigs.find(c => c.name === event.detail.value);
    this.measurementFields = config?.fields || [];
    this.addMeasurementControls(this.measurementFields, {});
  }

  async save() {
    const v = this.form.value;
    const measurements: Record<string, string> = {};
    this.measurementFields.forEach(f => { measurements[f.key] = v[f.key] || ''; });

    if (this.isEdit) {
      this.storage.updateMeasurement(this.customerId, { id: this.measurementId, dressType: v.dressType, measurements, notes: v.notes });
    } else {
      this.storage.addMeasurement(this.customerId, { dressType: v.dressType, measurements, notes: v.notes });
    }

    const toast = await this.toastCtrl.create({ message: this.isEdit ? 'Measurement updated!' : 'Measurement saved!', duration: 2000, position: 'bottom', color: 'dark' });
    await toast.present();
    this.router.navigateByUrl(`/customer-detail/${this.customerId}`);
  }
}
