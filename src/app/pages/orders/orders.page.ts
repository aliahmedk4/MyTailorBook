import { Component, ViewChild } from '@angular/core';
import { AlertController, IonInfiniteScroll, ToastController } from '@ionic/angular';
import { StorageService } from '../../services/storage.service';
import { IdbService } from '../../services/idb.service';
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
  statuses: string[] = [];
  stats: Record<string, number> = { total: 0 };

  constructor(
    private storage: StorageService,
    private idb: IdbService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ionViewWillEnter() {
    this.statuses = this.storage.getStatuses();
    this.filterStatus = this.storage.getDefaultStatus();
    this.reload();
  }

  reload(event?: any) {
    this.storage.getOrdersAsync().then(() => {
      this.stats = this.storage.getOrderStats();
      this.buildMaster();
      this.resetPages();
      if (event) event.target.complete();
    });
  }

  // ── Build sorted+filtered master list ──────────────────────────

  private buildMaster() {
    let list = this.storage.getOrders()
      .sort((a, b) => {
        const da = a.orderedDate || a.createdAt;
        const db = b.orderedDate || b.createdAt;
        return new Date(db).getTime() - new Date(da).getTime();
      });

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
      this.idb.getImage(order.id).then(url => {
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

  statusKey(status: string): string {
    return status.toLowerCase().replace(/\s+/g, '-');
  }

  badgeClass(status: string): string {
    return 'badge-' + this.statusKey(status);
  }

  async changeStatus(order: Order) {
    const idx = this.statuses.indexOf(order.status);
    const next = this.statuses[(idx + 1) % this.statuses.length];
    await this.storage.updateOrderStatus(order.id, next);
    this.reload();
    this.showToast(`Status → ${next}`);
  }

  async confirmDelete(order: Order) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Order',
      message: `Delete order for ${order.customerName}?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete', role: 'destructive', handler: async () => { await this.storage.deleteOrder(order.id); this.reload(); this.showToast('Order deleted'); } }
      ]
    });
    await alert.present();
  }

  async showToast(msg: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 2000, position: 'bottom', color: 'dark' });
    await t.present();
  }
}
