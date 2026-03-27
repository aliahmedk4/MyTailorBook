import { Component, OnInit } from '@angular/core';
import { GoogleDriveService } from './services/google-drive.service';
import { StorageService } from './services/storage.service';

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

  constructor(private drive: GoogleDriveService, private storage: StorageService) {}

  ngOnInit() { this.scheduleAutoBackup(); }

  loadDummyOrders() {
    this.dummyLoading = true;
    this.dummyResult  = '';

    const customers  = this.storage.getCustomers();
    if (!customers.length) { this.dummyResult = 'No customers found.'; this.dummyLoading = false; return; }

    const statuses: any[]  = ['Pending', 'In Progress', 'Ready', 'Delivered'];
    const dressTypes       = ['Shirt', 'Pant', 'Blouse', 'Suit', 'Kurta'];
    const rand = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
    const randNum = (min: number, max: number) => (Math.random() * (max - min) + min).toFixed(1);

    // Generate in chunks to avoid blocking the UI thread
    const CHUNK  = 100;
    let created  = 0;

    const processChunk = () => {
      const end = Math.min(created + CHUNK, this.TOTAL);
      for (let i = created; i < end; i++) {
        const customer  = rand(customers);
        const dressType = rand(dressTypes);
        const due = new Date(Date.now() + Math.random() * 60 * 24 * 60 * 60 * 1000);
        this.storage.addOrder({
          customerId:   customer.id,
          customerName: customer.name,
          dressType,
          quantity:     Math.ceil(Math.random() * 3),
          price:        String(Math.floor(Math.random() * 4000) + 500),
          dueDate:      due.toISOString().split('T')[0],
          status:       rand(statuses),
          measurements: {
            chest: randNum(34, 46), waist: randNum(28, 42),
            hip:   randNum(34, 48), shoulder: randNum(14, 20),
            sleeveLength: randNum(22, 28), length: randNum(28, 44),
          },
          notes: '',
        });
      }
      created = end;

      if (created < this.TOTAL) {
        setTimeout(processChunk, 0); // yield to browser between chunks
      } else {
        const jsonSize = new Blob([JSON.stringify({
          customers: this.storage.getCustomers(),
          orders:    this.storage.getOrders(),
        })]).size;
        this.dummyResult  = `✅ ${this.TOTAL} orders added. JSON size: ${(jsonSize / 1024).toFixed(1)} KB`;
        this.dummyLoading = false;
      }
    };

    setTimeout(processChunk, 0);
  }

  clearDummyOrders() {
    const orders  = this.storage.getOrders();
    const kept    = orders.filter(o => !o.notes?.includes('') || o.imageUrl); // keep real ones with images
    // simpler: just wipe all orders for test purposes
    localStorage.removeItem('tailor_orders');
    this.dummyResult = '🗑️ All orders cleared.';
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
      await this.drive.backup({
        version: 1,
        backedUpAt: new Date().toISOString(),
        customers: this.storage.getCustomers(),
        orders: this.storage.getOrders(),
        dressConfigs: this.storage.getDressConfigs(),
      });
      localStorage.setItem(LAST_AUTO_BACKUP_KEY, todayStr);
    } catch { /* silent fail */ }
  }
}
