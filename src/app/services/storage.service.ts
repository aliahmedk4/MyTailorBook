import { Injectable } from '@angular/core';
import { Customer } from '../models/customer.model';
import { DressMeasurement } from '../models/dress-measurement.model';
import { Order, OrderStatus } from '../models/order.model';
import { DressConfig, MeasurementField } from '../models/dress-config.model';
import { ImageStoreService } from './image-store.service';

const CUSTOMERS_KEY     = 'tailor_customers';
const ORDERS_INDEX_KEY  = 'tailor_orders_index';
const ORDER_PREFIX      = 'order_';
const DRESS_CONFIGS_KEY = 'tailor_dress_configs';

const DEFAULT_DRESS_CONFIGS: DressConfig[] = [
  { id: 'dc_shirt',  name: 'Shirt',  isDefault: true, fields: [
    { key: 'chest', label: 'Chest' }, { key: 'waist', label: 'Waist' },
    { key: 'shoulder', label: 'Shoulder' }, { key: 'sleeveLength', label: 'Sleeve Length' },
    { key: 'length', label: 'Length' }
  ]},
  { id: 'dc_pant',   name: 'Pant',   isDefault: true, fields: [
    { key: 'waist', label: 'Waist' }, { key: 'hip', label: 'Hip' },
    { key: 'thigh', label: 'Thigh' }, { key: 'length', label: 'Length' }
  ]},
  { id: 'dc_blouse', name: 'Blouse', isDefault: true, fields: [
    { key: 'chest', label: 'Chest' }, { key: 'waist', label: 'Waist' },
    { key: 'shoulder', label: 'Shoulder' }, { key: 'sleeveLength', label: 'Sleeve Length' },
    { key: 'length', label: 'Length' }
  ]},
  { id: 'dc_suit',   name: 'Suit',   isDefault: true, fields: [
    { key: 'chest', label: 'Chest' }, { key: 'waist', label: 'Waist' },
    { key: 'hip', label: 'Hip' }, { key: 'shoulder', label: 'Shoulder' },
    { key: 'sleeveLength', label: 'Sleeve Length' }, { key: 'length', label: 'Length' }
  ]},
  { id: 'dc_kurta',  name: 'Kurta',  isDefault: true, fields: [
    { key: 'chest', label: 'Chest' }, { key: 'waist', label: 'Waist' },
    { key: 'shoulder', label: 'Shoulder' }, { key: 'sleeveLength', label: 'Sleeve Length' },
    { key: 'length', label: 'Length' }, { key: 'hip', label: 'Hip' }
  ]},
];

@Injectable({ providedIn: 'root' })
export class StorageService {

  constructor(private imageStore: ImageStoreService) {}

  private genId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  // ── Customers ──────────────────────────────────────────────────────

  getCustomers(): Customer[] {
    const data = localStorage.getItem(CUSTOMERS_KEY);
    if (data) return JSON.parse(data);
    return this.initSampleData();
  }

  private saveCustomers(customers: Customer[]): void {
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
  }

  getCustomer(id: string): Customer | undefined {
    return this.getCustomers().find(c => c.id === id);
  }

  addCustomer(data: Omit<Customer, 'id' | 'measurements'>): Customer {
    const customers = this.getCustomers();
    const customer: Customer = { ...data, id: this.genId(), measurements: [] };
    customers.push(customer);
    this.saveCustomers(customers);
    return customer;
  }

  updateCustomer(id: string, data: Omit<Customer, 'id' | 'measurements'>): void {
    const customers = this.getCustomers();
    const c = customers.find(x => x.id === id);
    if (c) Object.assign(c, data);
    this.saveCustomers(customers);
  }

  deleteCustomer(id: string): void {
    this.saveCustomers(this.getCustomers().filter(c => c.id !== id));
    const ids = this.getOrderIndex();
    const toDelete = ids.filter(oid => {
      const raw = localStorage.getItem(ORDER_PREFIX + oid);
      return raw ? (JSON.parse(raw) as Order).customerId === id : false;
    });
    toDelete.forEach(oid => { this.deleteOrderRecord(oid); this.imageStore.delete(oid); });
    this.saveOrderIndex(ids.filter(oid => !toDelete.includes(oid)));
  }

  // ── Measurements ───────────────────────────────────────────────────

  addMeasurement(customerId: string, m: Omit<DressMeasurement, 'id'>): void {
    const customers = this.getCustomers();
    const c = customers.find(x => x.id === customerId);
    if (c) c.measurements.push({ ...m, id: this.genId() });
    this.saveCustomers(customers);
  }

  updateMeasurement(customerId: string, m: DressMeasurement): void {
    const customers = this.getCustomers();
    const c = customers.find(x => x.id === customerId);
    if (c) {
      const idx = c.measurements.findIndex(x => x.id === m.id);
      if (idx > -1) c.measurements[idx] = m;
    }
    this.saveCustomers(customers);
  }

  deleteMeasurement(customerId: string, measurementId: string): void {
    const customers = this.getCustomers();
    const c = customers.find(x => x.id === customerId);
    if (c) c.measurements = c.measurements.filter(m => m.id !== measurementId);
    this.saveCustomers(customers);
  }

  // ── Orders ─────────────────────────────────────────────────────────

  private getOrderIndex(): string[] {
    const raw = localStorage.getItem(ORDERS_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  private saveOrderIndex(ids: string[]): void {
    localStorage.setItem(ORDERS_INDEX_KEY, JSON.stringify(ids));
  }

  // Strip imageUrl before writing to localStorage — images live in IndexedDB only
  private saveOrderRecord(order: Order): void {
    const { imageUrl, ...rest } = order;
    localStorage.setItem(ORDER_PREFIX + order.id, JSON.stringify(rest));
  }

  private deleteOrderRecord(id: string): void {
    localStorage.removeItem(ORDER_PREFIX + id);
  }

  getOrders(): Order[] {
    // migrate old single-blob format on first access
    const legacy = localStorage.getItem('tailor_orders');
    if (legacy) {
      const old: Order[] = JSON.parse(legacy);
      old.forEach(o => this.saveOrderRecord(o));
      this.saveOrderIndex(old.map(o => o.id));
      localStorage.removeItem('tailor_orders');
    }
    return this.getOrderIndex()
      .map(id => {
        const raw = localStorage.getItem(ORDER_PREFIX + id);
        return raw ? JSON.parse(raw) as Order : null;
      })
      .filter((o): o is Order => o !== null);
  }

  // Loads order + attaches imageUrl from IndexedDB
  async getOrderWithImage(id: string): Promise<Order | undefined> {
    const order = this.getOrder(id);
    if (!order) return undefined;
    const imageUrl = await this.imageStore.get(id);
    return imageUrl ? { ...order, imageUrl } : order;
  }

  getOrdersForCustomer(customerId: string): Order[] {
    return this.getOrders().filter(o => o.customerId === customerId);
  }

  getOrder(id: string): Order | undefined {
    const raw = localStorage.getItem(ORDER_PREFIX + id);
    return raw ? JSON.parse(raw) : undefined;
  }

  addOrder(order: Omit<Order, 'id' | 'createdAt'>): Order {
    const { imageUrl, ...rest } = order as any;
    const newOrder: Order = { ...rest, id: this.genId(), createdAt: new Date().toISOString() };
    this.saveOrderRecord(newOrder);
    if (imageUrl) this.imageStore.save(newOrder.id, imageUrl);
    const ids = this.getOrderIndex();
    ids.unshift(newOrder.id);
    this.saveOrderIndex(ids);
    return newOrder;
  }

  updateOrder(order: Order): void {
    const { imageUrl, ...rest } = order;
    this.saveOrderRecord(rest as Order);
    if (imageUrl) {
      this.imageStore.save(order.id, imageUrl);
    } else {
      // imageUrl explicitly removed — delete from IndexedDB too
      this.imageStore.delete(order.id);
    }
  }

  updateOrderStatus(id: string, status: OrderStatus): void {
    const order = this.getOrder(id);
    if (order) this.saveOrderRecord({ ...order, status });
  }

  deleteOrder(id: string): void {
    this.deleteOrderRecord(id);
    this.imageStore.delete(id);
    this.saveOrderIndex(this.getOrderIndex().filter(i => i !== id));
  }

  // ── Import (Restore) ───────────────────────────────────────────────

  async importData(customers: Customer[], orders: Order[], dressConfigs?: DressConfig[], images?: Record<string, string>): Promise<void> {
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
    this.getOrderIndex().forEach(id => this.deleteOrderRecord(id));
    orders.forEach(o => this.saveOrderRecord(o));
    this.saveOrderIndex(orders.map(o => o.id));
    if (dressConfigs?.length) localStorage.setItem(DRESS_CONFIGS_KEY, JSON.stringify(dressConfigs));
    if (images) await this.imageStore.restoreAll(images);
  }

  // ── Dress Configs ──────────────────────────────────────────────────

  getDressConfigs(): DressConfig[] {
    const data = localStorage.getItem(DRESS_CONFIGS_KEY);
    if (data) return JSON.parse(data);
    localStorage.setItem(DRESS_CONFIGS_KEY, JSON.stringify(DEFAULT_DRESS_CONFIGS));
    return DEFAULT_DRESS_CONFIGS;
  }

  saveDressConfigs(configs: DressConfig[]): void {
    localStorage.setItem(DRESS_CONFIGS_KEY, JSON.stringify(configs));
  }

  addDressConfig(name: string, fields: MeasurementField[]): DressConfig {
    const configs = this.getDressConfigs();
    const config: DressConfig = { id: this.genId(), name, fields, isDefault: false };
    configs.push(config);
    this.saveDressConfigs(configs);
    return config;
  }

  updateDressConfig(config: DressConfig): void {
    const configs = this.getDressConfigs();
    const idx = configs.findIndex(c => c.id === config.id);
    if (idx > -1) configs[idx] = config;
    this.saveDressConfigs(configs);
  }

  deleteDressConfig(id: string): void {
    this.saveDressConfigs(this.getDressConfigs().filter(c => c.id !== id));
  }

  // ── Order Stats ────────────────────────────────────────────────────

  getOrderStats() {
    const orders = this.getOrders();
    return {
      total:      orders.length,
      pending:    orders.filter(o => o.status === 'Pending').length,
      inProgress: orders.filter(o => o.status === 'In Progress').length,
      ready:      orders.filter(o => o.status === 'Ready').length,
      delivered:  orders.filter(o => o.status === 'Delivered').length,
    };
  }

  // ── Sample Data ────────────────────────────────────────────────────

  private initSampleData(): Customer[] {
    const customers: Customer[] = [
      {
        id: 'c1', name: 'Ahmed Khan', phone: '0300-1234567',
        measurements: [
          { id: 'm1', dressType: 'Shirt', measurements: { chest: '40', waist: '36', shoulder: '17', sleeveLength: '25', length: '30' }, notes: 'Loose fit' },
          { id: 'm2', dressType: 'Pant',  measurements: { waist: '34', hip: '40', length: '42' }, notes: '' }
        ]
      },
      {
        id: 'c2', name: 'Sara Ali', phone: '0321-9876543',
        measurements: [
          { id: 'm3', dressType: 'Blouse', measurements: { chest: '36', waist: '30', shoulder: '14', sleeveLength: '22', length: '18' }, notes: 'Silk fabric' }
        ]
      }
    ];
    this.saveCustomers(customers);

    const orders: Order[] = [
      { id: 'o1', customerId: 'c1', customerName: 'Ahmed Khan', dressType: 'Shirt',  quantity: 2, price: '1200', dueDate: '2025-08-10', status: 'In Progress', measurements: { chest: '40', waist: '36', shoulder: '17', sleeveLength: '25', length: '30' }, notes: 'White fabric, loose fit', createdAt: new Date().toISOString() },
      { id: 'o2', customerId: 'c2', customerName: 'Sara Ali',   dressType: 'Blouse', quantity: 1, price: '800',  dueDate: '2025-08-05', status: 'Ready',       measurements: { chest: '36', waist: '30', shoulder: '14', sleeveLength: '22', length: '18' }, notes: 'Silk fabric',          createdAt: new Date().toISOString() },
      { id: 'o3', customerId: 'c1', customerName: 'Ahmed Khan', dressType: 'Pant',   quantity: 1, price: '600',  dueDate: '2025-08-15', status: 'Pending',     measurements: { waist: '34', hip: '40', length: '42' },                                       notes: '',                     createdAt: new Date().toISOString() }
    ];
    orders.forEach(o => this.saveOrderRecord(o));
    this.saveOrderIndex(orders.map(o => o.id));
    return customers;
  }
}
