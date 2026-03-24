import { Injectable } from '@angular/core';
import { Customer } from '../models/customer.model';
import { DressMeasurement } from '../models/dress-measurement.model';
import { Order, OrderStatus } from '../models/order.model';

const CUSTOMERS_KEY = 'tailor_customers';
const ORDERS_KEY = 'tailor_orders';

@Injectable({ providedIn: 'root' })
export class StorageService {

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

  addCustomer(name: string, phone: string): Customer {
    const customers = this.getCustomers();
    const customer: Customer = { id: this.genId(), name, phone, measurements: [] };
    customers.push(customer);
    this.saveCustomers(customers);
    return customer;
  }

  updateCustomer(id: string, name: string, phone: string): void {
    const customers = this.getCustomers();
    const c = customers.find(x => x.id === id);
    if (c) { c.name = name; c.phone = phone; }
    this.saveCustomers(customers);
  }

  deleteCustomer(id: string): void {
    this.saveCustomers(this.getCustomers().filter(c => c.id !== id));
    this.saveOrders(this.getOrders().filter(o => o.customerId !== id));
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

  getOrders(): Order[] {
    const data = localStorage.getItem(ORDERS_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveOrders(orders: Order[]): void {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  }

  getOrdersForCustomer(customerId: string): Order[] {
    return this.getOrders().filter(o => o.customerId === customerId);
  }

  getOrder(id: string): Order | undefined {
    return this.getOrders().find(o => o.id === id);
  }

  addOrder(order: Omit<Order, 'id' | 'createdAt'>): Order {
    const orders = this.getOrders();
    const newOrder: Order = { ...order, id: this.genId(), createdAt: new Date().toISOString() };
    orders.unshift(newOrder);
    this.saveOrders(orders);
    return newOrder;
  }

  updateOrder(order: Order): void {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === order.id);
    if (idx > -1) orders[idx] = order;
    this.saveOrders(orders);
  }

  updateOrderStatus(id: string, status: OrderStatus): void {
    const orders = this.getOrders();
    const o = orders.find(x => x.id === id);
    if (o) o.status = status;
    this.saveOrders(orders);
  }

  deleteOrder(id: string): void {
    this.saveOrders(this.getOrders().filter(o => o.id !== id));
  }

  // ── Import (Restore) ───────────────────────────────────────────────

  importData(customers: Customer[], orders: Order[]): void {
    localStorage.setItem('tailor_customers', JSON.stringify(customers));
    localStorage.setItem('tailor_orders', JSON.stringify(orders));
  }

  getOrderStats() {
    const orders = this.getOrders();
    return {
      total: orders.length,
      pending: orders.filter(o => o.status === 'Pending').length,
      inProgress: orders.filter(o => o.status === 'In Progress').length,
      ready: orders.filter(o => o.status === 'Ready').length,
      delivered: orders.filter(o => o.status === 'Delivered').length,
    };
  }

  // ── Sample Data ────────────────────────────────────────────────────

  private initSampleData(): Customer[] {
    const customers: Customer[] = [
      {
        id: 'c1', name: 'Ahmed Khan', phone: '0300-1234567',
        measurements: [
          { id: 'm1', dressType: 'Shirt', measurements: { chest: '40', waist: '36', shoulder: '17', sleeveLength: '25', length: '30' }, notes: 'Loose fit' },
          { id: 'm2', dressType: 'Pant', measurements: { waist: '34', hip: '40', length: '42' }, notes: '' }
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
      { id: 'o1', customerId: 'c1', customerName: 'Ahmed Khan', dressType: 'Shirt', quantity: 2, price: '1200', dueDate: '2025-08-10', status: 'In Progress', measurements: { chest: '40', waist: '36', shoulder: '17', sleeveLength: '25', length: '30' }, notes: 'White fabric, loose fit', createdAt: new Date().toISOString() },
      { id: 'o2', customerId: 'c2', customerName: 'Sara Ali', dressType: 'Blouse', quantity: 1, price: '800', dueDate: '2025-08-05', status: 'Ready', measurements: { chest: '36', waist: '30', shoulder: '14', sleeveLength: '22', length: '18' }, notes: 'Silk fabric', createdAt: new Date().toISOString() },
      { id: 'o3', customerId: 'c1', customerName: 'Ahmed Khan', dressType: 'Pant', quantity: 1, price: '600', dueDate: '2025-08-15', status: 'Pending', measurements: { waist: '34', hip: '40', length: '42' }, notes: '', createdAt: new Date().toISOString() }
    ];
    this.saveOrders(orders);

    return customers;
  }
}
