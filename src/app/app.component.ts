import { Component, OnInit } from '@angular/core';
import { GoogleDriveService } from './services/google-drive.service';
import { StorageService } from './services/storage.service';
import { ImageStoreService } from './services/image-store.service';
import { IdbService } from './services/idb.service';

const LAST_AUTO_BACKUP_KEY = 'last_auto_backup_date';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  menuPages = [
    { title: 'Customers', url: '/home',     icon: 'people-outline' },
    { title: 'Orders',    url: '/orders',   icon: 'receipt-outline' },
    { title: 'Backup',    url: '/backup',   icon: 'cloud-outline' },
    { title: 'Settings',  url: '/settings', icon: 'settings-outline' },
  ];

  dummyLoading = false;
  dummyResult  = '';
  TOTAL       = 10000;

  constructor(private drive: GoogleDriveService, private storage: StorageService, private imageStore: ImageStoreService, private idb: IdbService) {}

  ngOnInit() { this.scheduleAutoBackup(); }

  loadDummyOrders() {
    this.dummyLoading = true;
    this.dummyResult  = '';

    const customers = this.storage.getCustomers();
    if (!customers.length) { this.dummyResult = 'No customers found.'; this.dummyLoading = false; return; }

    const statuses: any[] = ['Pending', 'In Progress', 'Ready', 'Delivered'];
    const dressTypes      = ['Shirt', 'Pant', 'Blouse', 'Suit', 'Kurta'];
    const rand    = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
    const randNum = (min: number, max: number) => (Math.random() * (max - min) + min).toFixed(1);
    const genId   = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

    const CHUNK   = 500;
    let created   = 0;
    const batch: any[] = [];
    let seq = parseInt(localStorage.getItem('tailor_order_seq') || '0', 10);

    const processChunk = async () => {
      const end = Math.min(created + CHUNK, this.TOTAL);
      for (let i = created; i < end; i++) {
        const customer  = rand(customers);
        const dressType = rand(dressTypes);
        const due = new Date(Date.now() + Math.random() * 60 * 24 * 60 * 60 * 1000);
        const ordered = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000);
        seq++;
        batch.push({
          id: genId(), orderNo: seq, customerId: customer.id, customerName: customer.name, dressType,
          quantity: Math.ceil(Math.random() * 3),
          price: String(Math.floor(Math.random() * 4000) + 500),
          orderedDate: ordered.toISOString().split('T')[0],
          dueDate: due.toISOString().split('T')[0],
          status: rand(statuses),
          measurements: {
            chest: randNum(34, 46), waist: randNum(28, 42),
            hip: randNum(34, 48), shoulder: randNum(14, 20),
            sleeveLength: randNum(22, 28), length: randNum(28, 44),
          },
          notes: '', createdAt: new Date().toISOString()
        });
      }
      created = end;

      // Flush chunk to IDB
      await this.idb.bulkSaveOrders(batch.slice(created - CHUNK < 0 ? 0 : created - CHUNK));

      if (created < this.TOTAL) {
        this.dummyResult = `Loading... ${created}/${this.TOTAL}`;
        setTimeout(processChunk, 0);
      } else {
        await this.idb.bulkSaveOrders(batch); // final flush
        localStorage.setItem('tailor_order_seq', seq.toString()); // persist counter
        this.storage['_ordersCache'] = null;  // invalidate cache
        this.dummyResult  = `✅ ${this.TOTAL} orders written to IndexedDB. No localStorage used.`;
        this.dummyLoading = false;
      }
    };

    setTimeout(processChunk, 0);
  }

  async clearDummyOrders() {
    await this.idb.clearOrders();
    this.storage['_ordersCache'] = null;
    // also clear any legacy localStorage keys
    localStorage.removeItem('tailor_orders');
    localStorage.removeItem('tailor_orders_index');
    Object.keys(localStorage).filter(k => k.startsWith('order_')).forEach(k => localStorage.removeItem(k));
    this.dummyResult = '🗑️ All orders cleared from IndexedDB.';
  }

  private scheduleAutoBackup() {
    const now = new Date();
    const target = new Date(now);
    target.setHours(14, 0, 0, 0);
    if (now >= target) target.setDate(target.getDate() + 1);

    const todayStr = now.toDateString();
    const lastBackup = localStorage.getItem(LAST_AUTO_BACKUP_KEY);

    // If already past 2PM today and not yet backed up today, run immediately
    const past2pmToday = new Date().getHours() >= 14;
    if (past2pmToday && lastBackup !== todayStr) {
      this.runAutoBackup();
    }

    // Schedule next 2PM
    const msUntilTarget = target.getTime() - Date.now();
    setTimeout(() => {
      this.runAutoBackup();
      // Repeat every 24h
      setInterval(() => this.runAutoBackup(), 24 * 60 * 60 * 1000);
    }, msUntilTarget);
  }

  private async runAutoBackup() {
    if (!this.drive.isSignedIn()) return;
    const todayStr = new Date().toDateString();
    if (localStorage.getItem(LAST_AUTO_BACKUP_KEY) === todayStr) return;
    try {
      const images = await this.idb.getAllImages();
      await this.drive.backup({
        version: 1,
        backedUpAt: new Date().toISOString(),
        customers: this.storage.getCustomers(),
        orders: this.storage.getOrders(),
        dressConfigs: this.storage.getDressConfigs(),
        images,
      });
      localStorage.setItem(LAST_AUTO_BACKUP_KEY, todayStr);
    } catch { /* silent fail */ }
  }
}
