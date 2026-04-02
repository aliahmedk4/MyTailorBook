import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { StorageService } from '../../services/storage.service';
import { PdfService } from '../../services/pdf.service';
import { Customer } from '../../models/customer.model';
import { DressMeasurement } from '../../models/dress-measurement.model';
import { Order, OrderStatus } from '../../models/order.model';

@Component({
  selector: 'app-customer-detail',
  templateUrl: './customer-detail.page.html',
  styleUrls: ['./customer-detail.page.scss'],
  standalone: false,
})
export class CustomerDetailPage implements OnInit {
  @ViewChild('ordersScroll') ordersScrollRef!: ElementRef<HTMLDivElement>;

  customer: Customer | undefined;
  customerId = '';
  orders: Order[] = [];
  allOrders: Order[] = [];
  orderCount = 0;
  private page = 0;
  private readonly PAGE_SIZE = 20;

  labelMap: Record<string, string> = {
    chest: 'Chest', waist: 'Waist', hip: 'Hip',
    shoulder: 'Shoulder', sleeveLength: 'Sleeve', length: 'Length'
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storage: StorageService,
    private pdf: PdfService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.customerId = this.route.snapshot.paramMap.get('id') || '';
  }

  ionViewWillEnter() {
    this.load();
  }

  load() {
    const c = this.storage.getCustomer(this.customerId);
    if (c) {
      this.customer = c;
      this.allOrders = this.storage.getOrdersForCustomer(this.customerId)
        .sort((a, b) => {
          const da = a.orderDate || a.createdAt;
          const db = b.orderDate || b.createdAt;
          return new Date(db).getTime() - new Date(da).getTime();
        });
      this.orderCount = this.allOrders.length;
      this.page = 0;
      this.orders = this.allOrders.slice(0, this.PAGE_SIZE);
    } else {
      this.router.navigateByUrl('/home');
    }
  }

  loadMore() {
    if (this.orders.length >= this.allOrders.length) return;
    this.page++;
    const next = this.allOrders.slice(this.page * this.PAGE_SIZE, (this.page + 1) * this.PAGE_SIZE);
    this.orders = [...this.orders, ...next];
  }

  onOrdersScroll(event: Event) {
    const el = event.target as HTMLDivElement;
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 40) {
      this.loadMore();
    }
  }

  getMeasurementEntries(m: DressMeasurement): { label: string; value: string }[] {
    return Object.entries(m.measurements)
      .filter(([, v]) => v)
      .map(([k, v]) => ({ label: this.labelMap[k] || k, value: v as string }));
  }

  badgeClass(status: OrderStatus): string {
    const map: Record<OrderStatus, string> = {
      'Pending': 'badge-pending', 'In Progress': 'badge-progress',
      'Ready': 'badge-ready', 'Delivered': 'badge-delivered'
    };
    return map[status];
  }

  savePdf() {
    if (!this.customer) return;
    this.pdf.saveCustomerPdf(this.customer, this.allOrders);
  }

  shareWhatsApp() {
    if (!this.customer) return;
    this.pdf.shareCustomerPdfOnWhatsApp(this.customer, this.allOrders);
  }

  async confirmDelete(m: DressMeasurement) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Measurement',
      message: `Delete ${m.dressType} measurement?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete', role: 'destructive',
          handler: () => {
            this.storage.deleteMeasurement(this.customerId, m.id);
            this.load();
            this.showToast('Measurement deleted');
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
