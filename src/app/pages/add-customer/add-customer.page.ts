import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { StorageService } from '../../services/storage.service';

@Component({
  selector: 'app-add-customer',
  templateUrl: './add-customer.page.html',
  standalone: false,
})
export class AddCustomerPage implements OnInit {
  form!: FormGroup;
  isEdit = false;
  customerId = '';

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private storage: StorageService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.customerId = this.route.snapshot.paramMap.get('id') || 'new';
    this.isEdit = this.customerId !== 'new';

    this.form = this.fb.group({
      name: ['', Validators.required],
      phone: ['']
    });

    if (this.isEdit) {
      const c = this.storage.getCustomer(this.customerId);
      if (c) this.form.patchValue({ name: c.name, phone: c.phone });
    }
  }

  async save() {
    if (this.form.invalid) return;
    const { name, phone } = this.form.value;
    if (this.isEdit) {
      this.storage.updateCustomer(this.customerId, name, phone);
    } else {
      this.storage.addCustomer(name, phone);
    }
    const toast = await this.toastCtrl.create({
      message: this.isEdit ? 'Customer updated!' : 'Customer added!',
      duration: 2000, position: 'bottom'
    });
    await toast.present();
    this.router.navigateByUrl('/home');
  }
}
