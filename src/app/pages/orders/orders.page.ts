import { Component, ViewChild } from '@angular/core';
import { AlertController, IonInfiniteScroll, ToastController } from '@ionic/angular';
import { StorageService } from '../../services/storage.service';
import { ImageStoreService } from '../../services/image-store.service';
import { Order, OrderStatus } from '../../models/order.model';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-orders',
  templateUrl: './orders.page.html',
  styleUrls: ['./orders.page.scss'],
  standalone: false,
})
export class OrdersPage {
  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;

  // full sorted+filtered master list (never rendered directly)
  private masterList: Order[] = [];

  // slice rendered in the template
  displayed: Order[] = [];

  private page = 0;
  private allLoaded = false;

  searchTerm    = '';
  filterStatus  = 'All';
  stats         = { total: 0, pending: 0, inProgress: 0, ready: 0, delivered: 0 };

  constructor(
    private storage: StorageService,
    private imageStore: ImageStoreService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ionViewWillEnter() { this.reload(); }

  // ── Full reload (on enter / pull-to-refresh) ────────────────────

  reload(event?: any) {
    this.stats      = this.storage.getOrderStats();
    this.buildMaster();
    this.resetPages();
    if (event) event.target.complete();
  }

  // ── Build sorted+filtered master list ──────────────────────────

  private buildMaster() {
    let list = this.storage.getOrders()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (this.filterStatus !== 'All')
      list = list.filter(o => o.status === this.filterStatus);

    if (this.searchTerm) {
      const t = this.searchTerm.toLowerCase();
      list = list.filter(o =>
        o.customerName.toLowerCase().includes(t) || o.dressType.toLowerCase().includes(t)
      );
    }

    this.masterList = list;
  }

  // ── Pagination helpers ──────────────────────────────────────────

  private resetPages() {
    this.page      = 0;
    this.allLoaded = false;
    this.displayed = [];
    if (this.infiniteScroll) this.infiniteScroll.disabled = false;
    this.appendPage();
  }

  private appendPage() {
    const start = this.page * PAGE_SIZE;
    const slice = this.masterList.slice(start, start + PAGE_SIZE);
    // Push orders first, then lazily attach images from IndexedDB
    this.displayed.push(...slice);
    slice.forEach(order => {
      this.imageStore.get(order.id).then(url => {
        if (!url) return;
        const target = this.displayed.find(o => o.id === order.id);
        if (target) target.imageUrl = url;
      });
    });
    this.page++;
    if (this.displayed.length >= this.masterList.length) this.allLoaded = true;
  }

  // ── Infinite scroll handler ─────────────────────────────────────

  loadMore(event: any) {
    if (this.allLoaded) {
      event.target.complete();
      event.target.disabled = true;
      return;
    }
    this.appendPage();
    event.target.complete();
    if (this.allLoaded) event.target.disabled = true;
  }

  // ── Filter / search (resets pagination) ────────────────────────

  applyFilter() {
    this.buildMaster();
    this.resetPages();
  }

  // ── Helpers ────────────────────────────────────────────────────

  badgeClass(status: OrderStatus): string {
    return ({ 'Pending': 'badge-pending', 'In Progress': 'badge-progress', 'Ready': 'badge-ready', 'Delivered': 'badge-delivered' } as any)[status];
  }

  statusKey(status: OrderStatus): string {
    return ({ 'Pending': 'pending', 'In Progress': 'progress', 'Ready': 'ready', 'Delivered': 'delivered' } as any)[status];
  }

  async changeStatus(order: Order) {
    const next: Record<OrderStatus, OrderStatus> = {
      'Pending': 'In Progress', 'In Progress': 'Ready', 'Ready': 'Delivered', 'Delivered': 'Pending'
    };
    this.storage.updateOrderStatus(order.id, next[order.status]);
    this.reload();
    this.showToast(`Status → ${next[order.status]}`);
  }

  async confirmDelete(order: Order) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Order',
      message: `Delete order for ${order.customerName}?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete', role: 'destructive', handler: () => { this.storage.deleteOrder(order.id); this.reload(); this.showToast('Order deleted'); } }
      ]
    });
    await alert.present();
  }

  async showToast(msg: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 2000, position: 'bottom', color: 'dark' });
    await t.present();
  }
}
