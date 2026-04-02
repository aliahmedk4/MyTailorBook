import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { StorageService } from '../../services/storage.service';

@Component({
  selector: 'app-add-customer',
  templateUrl: './add-customer.page.html',
  styleUrls: ['./add-customer.page.scss'],
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
      firstName: ['', Validators.required],
      lastName:  [''],
      phone:     [''],
      altPhone:  [''],
      address:   [''],
    });

    if (this.isEdit) {
      const c = this.storage.getCustomer(this.customerId);
      if (c) this.form.patchValue({
        firstName: c.firstName || c.name,
        lastName:  c.lastName  || '',
        phone:     c.phone     || '',
        altPhone:  c.altPhone  || '',
        address:   c.address   || '',
      });
    }
  }

  get displayName(): string {
    const f = this.form.value.firstName?.trim() || '';
    const l = this.form.value.lastName?.trim()  || '';
    return l ? `${f} ${l}` : f;
  }

  async save() {
    if (this.form.invalid) return;
    const { firstName, lastName, phone, altPhone, address } = this.form.value;
    const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
    const data = { name, firstName: firstName.trim(), lastName: lastName.trim(), phone, altPhone, address };

    if (this.isEdit) {
      this.storage.updateCustomer(this.customerId, data);
    } else {
      this.storage.addCustomer(data);
    }

    const toast = await this.toastCtrl.create({
      message: this.isEdit ? 'Customer updated!' : 'Customer added!',
      duration: 2000, position: 'bottom'
    });
    await toast.present();
    this.router.navigateByUrl('/home');
  }
}
