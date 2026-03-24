import { Component } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { StorageService } from '../../services/storage.service';
import { Order, OrderStatus } from '../../models/order.model';

@Component({
  selector: 'app-orders',
  templateUrl: './orders.page.html',
  styleUrls: ['./orders.page.scss'],
  standalone: false,
})
export class OrdersPage {
  orders: Order[] = [];
  filtered: Order[] = [];
  searchTerm = '';
  filterStatus = 'All';
  stats = { total: 0, pending: 0, inProgress: 0, ready: 0, delivered: 0 };

  constructor(
    private storage: StorageService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ionViewWillEnter() { this.load(); }

  load() {
    this.orders = this.storage.getOrders();
    this.stats = this.storage.getOrderStats();
    this.applyFilter();
  }

  applyFilter() {
    let result = [...this.orders];
    if (this.filterStatus !== 'All') result = result.filter(o => o.status === this.filterStatus);
    if (this.searchTerm) {
      const t = this.searchTerm.toLowerCase();
      result = result.filter(o =>
        o.customerName.toLowerCase().includes(t) || o.dressType.toLowerCase().includes(t)
      );
    }
    this.filtered = result;
  }

  badgeClass(status: OrderStatus): string {
    return { 'Pending': 'badge-pending', 'In Progress': 'badge-progress', 'Ready': 'badge-ready', 'Delivered': 'badge-delivered' }[status];
  }

  statusKey(status: OrderStatus): string {
    return { 'Pending': 'pending', 'In Progress': 'progress', 'Ready': 'ready', 'Delivered': 'delivered' }[status];
  }

  async changeStatus(order: Order) {
    const next: Record<OrderStatus, OrderStatus> = {
      'Pending': 'In Progress', 'In Progress': 'Ready', 'Ready': 'Delivered', 'Delivered': 'Pending'
    };
    this.storage.updateOrderStatus(order.id, next[order.status]);
    this.load();
    this.showToast(`Status → ${next[order.status]}`);
  }

  async confirmDelete(order: Order) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Order',
      message: `Delete order for ${order.customerName}?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete', role: 'destructive', handler: () => { this.storage.deleteOrder(order.id); this.load(); this.showToast('Order deleted'); } }
      ]
    });
    await alert.present();
  }

  async showToast(msg: string) {
    const toast = await this.toastCtrl.create({ message: msg, duration: 2000, position: 'bottom', color: 'dark' });
    await toast.present();
  }
}
