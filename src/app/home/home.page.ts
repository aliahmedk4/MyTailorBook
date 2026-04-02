import { Component } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { StorageService } from '../services/storage.service';
import { Customer } from '../models/customer.model';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  customers: Customer[] = [];
  filtered: Customer[] = [];
  searchTerm = '';
  today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  constructor(
    private storage: StorageService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ionViewWillEnter() { this.load(); }

  load() {
    this.customers = this.storage.getCustomers()
      .sort((a, b) => a.name.localeCompare(b.name));
    this.applyFilter();
  }

  applyFilter() {
    const term = this.searchTerm.toLowerCase();
    this.filtered = term
      ? this.customers.filter(c =>
          c.name.toLowerCase().includes(term) ||
          (c.phone || '').toLowerCase().includes(term)
        )
      : [...this.customers];
  }

  totalOrders(): number {
    return this.storage.getOrders().length;
  }

  pendingOrders(): number {
    return this.storage.getOrders().filter(o => o.status === 'Pending').length;
  }

  getOrderCount(customerId: string): number {
    return this.storage.getOrdersForCustomer(customerId).length;
  }

  async confirmDelete(customer: Customer) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Customer',
      message: `Delete "${customer.name}"? All data will be lost.`,
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
    const toast = await this.toastCtrl.create({ message: msg, duration: 2000, position: 'bottom', color: 'dark' });
    await toast.present();
  }
}
