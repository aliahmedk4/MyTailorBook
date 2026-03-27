import { Injectable } from '@angular/core';
import { Customer } from '../models/customer.model';
import { DressMeasurement } from '../models/dress-measurement.model';
import { Order, OrderStatus } from '../models/order.model';
import { DressConfig, MeasurementField } from '../models/dress-config.model';
import { IdbService } from './idb.service';

const CUSTOMERS_KEY     = 'tailor_customers';
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

  constructor(private idb: IdbService) {}

  private genId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  // ── Customers (localStorage — small, text only) ─────────────────

  getCustomers(): Customer[] {
    const data = localStorage.getItem(CUSTOMERS_KEY);
    if (data) return JSON.parse(data);
    return this.initSampleCustomers();
  }

  private saveCustomers(c: Customer[]): void {
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(c));
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
    // async — delete all orders + images for this customer
    this.idb.getAllOrders().then(orders => {
      orders.filter(o => o.customerId === id).forEach(o => {
        this.idb.deleteOrder(o.id);
        this.idb.deleteImage(o.id);
      });
    });
  }

  // ── Measurements ────────────────────────────────────────────────

  addMeasurement(customerId: string, m: Omit<DressMeasurement, 'id'>): void {
    const customers = this.getCustomers();
    const c = customers.find(x => x.id === customerId);
    if (c) c.measurements.push({ ...m, id: this.genId() });
    this.saveCustomers(customers);
  }

  updateMeasurement(customerId: string, m: DressMeasurement): void {
    const customers = this.getCustomers();
    const c = customers.find(x => x.id === customerId);
    if (c) { const idx = c.measurements.findIndex(x => x.id === m.id); if (idx > -1) c.measurements[idx] = m; }
    this.saveCustomers(customers);
  }

  deleteMeasurement(customerId: string, measurementId: string): void {
    const customers = this.getCustomers();
    const c = customers.find(x => x.id === customerId);
    if (c) c.measurements = c.measurements.filter(m => m.id !== measurementId);
    this.saveCustomers(customers);
  }

  // ── Orders (IndexedDB — unlimited) ──────────────────────────────

  // Sync wrapper — returns cached result; callers that need fresh data use getOrdersAsync
  private _ordersCache: Order[] | null = null;

  async getOrdersAsync(): Promise<Order[]> {
    // migrate old localStorage orders on first call
    const legacyBlob = localStorage.getItem('tailor_orders');
    if (legacyBlob) {
      const old: Order[] = JSON.parse(legacyBlob);
      await this.idb.bulkSaveOrders(old);
      localStorage.removeItem('tailor_orders');
    }
    // migrate old per-key orders
    const legacyIndex = localStorage.getItem('tailor_orders_index');
    if (legacyIndex) {
      const ids: string[] = JSON.parse(legacyIndex);
      const migrated: Order[] = [];
      ids.forEach(id => {
        const raw = localStorage.getItem('order_' + id);
        if (raw) { migrated.push(JSON.parse(raw)); localStorage.removeItem('order_' + id); }
      });
      if (migrated.length) await this.idb.bulkSaveOrders(migrated);
      localStorage.removeItem('tailor_orders_index');
    }
    const orders = await this.idb.getAllOrders();
    this._ordersCache = orders;
    return orders;
  }

  // Synchronous — returns cache (may be stale on first load; pages should call getOrdersAsync)
  getOrders(): Order[] {
    return this._ordersCache ?? [];
  }

  async getOrdersForCustomerAsync(customerId: string): Promise<Order[]> {
    const all = await this.getOrdersAsync();
    return all.filter(o => o.customerId === customerId);
  }

  getOrdersForCustomer(customerId: string): Order[] {
    return this.getOrders().filter(o => o.customerId === customerId);
  }

  async getOrder(id: string): Promise<Order | undefined> {
    return this.idb.getOrder(id);
  }

  async getOrderWithImage(id: string): Promise<Order | undefined> {
    const order = await this.idb.getOrder(id);
    if (!order) return undefined;
    const imageUrl = await this.idb.getImage(id);
    return imageUrl ? { ...order, imageUrl } : order;
  }

  async addOrder(order: Omit<Order, 'id' | 'createdAt'>): Promise<Order> {
    const { imageUrl, ...rest } = order as any;
    const newOrder: Order = { ...rest, id: this.genId(), createdAt: new Date().toISOString() };
    await this.idb.saveOrder(newOrder);
    if (imageUrl) await this.idb.saveImage(newOrder.id, imageUrl);
    if (this._ordersCache) this._ordersCache.unshift(newOrder);
    return newOrder;
  }

  async updateOrder(order: Order): Promise<void> {
    const { imageUrl, ...rest } = order;
    await this.idb.saveOrder(rest as Order);
    if (imageUrl) {
      await this.idb.saveImage(order.id, imageUrl);
    } else {
      await this.idb.deleteImage(order.id);
    }
    if (this._ordersCache) {
      const idx = this._ordersCache.findIndex(o => o.id === order.id);
      if (idx > -1) this._ordersCache[idx] = rest as Order;
    }
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
    const order = await this.idb.getOrder(id);
    if (order) await this.idb.saveOrder({ ...order, status });
    if (this._ordersCache) {
      const o = this._ordersCache.find(x => x.id === id);
      if (o) o.status = status;
    }
  }

  async deleteOrder(id: string): Promise<void> {
    await this.idb.deleteOrder(id);
    await this.idb.deleteImage(id);
    if (this._ordersCache) this._ordersCache = this._ordersCache.filter(o => o.id !== id);
  }

  // ── Import / Restore ────────────────────────────────────────────

  async importData(customers: Customer[], orders: Order[], dressConfigs?: DressConfig[], images?: Record<string, string>): Promise<void> {
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
    await this.idb.clearOrders();
    await this.idb.bulkSaveOrders(orders);
    this._ordersCache = null;
    if (dressConfigs?.length) localStorage.setItem(DRESS_CONFIGS_KEY, JSON.stringify(dressConfigs));
    if (images && Object.keys(images).length) await this.idb.bulkSaveImages(images);
  }

  // ── Order Stats ─────────────────────────────────────────────────

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

  // ── Dress Configs ───────────────────────────────────────────────

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

  // ── Sample Data ─────────────────────────────────────────────────

  private initSampleCustomers(): Customer[] {
    const customers: Customer[] = [
      { id: 'c1', name: 'Ahmed Khan', phone: '0300-1234567', measurements: [
        { id: 'm1', dressType: 'Shirt', measurements: { chest: '40', waist: '36', shoulder: '17', sleeveLength: '25', length: '30' }, notes: 'Loose fit' },
        { id: 'm2', dressType: 'Pant',  measurements: { waist: '34', hip: '40', length: '42' }, notes: '' }
      ]},
      { id: 'c2', name: 'Sara Ali', phone: '0321-9876543', measurements: [
        { id: 'm3', dressType: 'Blouse', measurements: { chest: '36', waist: '30', shoulder: '14', sleeveLength: '22', length: '18' }, notes: 'Silk fabric' }
      ]},
    ];
    this.saveCustomers(customers);
    // seed sample orders into IDB
    const orders: Order[] = [
      { id: 'o1', customerId: 'c1', customerName: 'Ahmed Khan', dressType: 'Shirt',  quantity: 2, price: '1200', dueDate: '2025-08-10', status: 'In Progress', measurements: { chest: '40', waist: '36', shoulder: '17', sleeveLength: '25', length: '30' }, notes: 'White fabric', createdAt: new Date().toISOString() },
      { id: 'o2', customerId: 'c2', customerName: 'Sara Ali',   dressType: 'Blouse', quantity: 1, price: '800',  dueDate: '2025-08-05', status: 'Ready',       measurements: { chest: '36', waist: '30', shoulder: '14', sleeveLength: '22', length: '18' }, notes: 'Silk fabric', createdAt: new Date().toISOString() },
      { id: 'o3', customerId: 'c1', customerName: 'Ahmed Khan', dressType: 'Pant',   quantity: 1, price: '600',  dueDate: '2025-08-15', status: 'Pending',     measurements: { waist: '34', hip: '40', length: '42' },                                       notes: '',            createdAt: new Date().toISOString() },
    ];
    this.idb.bulkSaveOrders(orders);
    this._ordersCache = orders;
    return customers;
  }
}
