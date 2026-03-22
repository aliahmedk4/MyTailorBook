import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { StorageService } from '../services/storage.service';
import { Customer } from '../models/customer.model';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  customers: Customer[] = [];
  filtered: Customer[] = [];
  searchTerm = '';

  constructor(
    private storage: StorageService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {}

  ionViewWillEnter() {
    this.load();
  }

  load() {
    this.customers = this.storage.getCustomers();
    this.applyFilter();
  }

  applyFilter() {
    const term = this.searchTerm.toLowerCase();
    this.filtered = term
      ? this.customers.filter(c => c.name.toLowerCase().includes(term))
      : [...this.customers];
  }

  async confirmDelete(customer: Customer) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Customer',
      message: `Delete ${customer.name}? All measurements will be lost.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete', role: 'destructive',
          handler: () => {
            this.storage.deleteCustomer(customer.id);
            this.load();
            this.showToast('Customer deleted');
          }
        }
      ]
    });
    await alert.present();
  }

  async showToast(msg: string) {
    const toast = await this.toastCtrl.create({ message: msg, duration: 2000, position: 'bottom' });
    await toast.present();
  }
}
