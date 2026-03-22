import { Injectable } from '@angular/core';
import { Customer } from '../models/customer.model';
import { DressMeasurement } from '../models/dress-measurement.model';

const STORAGE_KEY = 'tailor_customers';

@Injectable({ providedIn: 'root' })
export class StorageService {

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  getCustomers(): Customer[] {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : this.getSampleData();
  }

  private save(customers: Customer[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
  }

  addCustomer(name: string, phone: string): Customer {
    const customers = this.getCustomers();
    const customer: Customer = { id: this.generateId(), name, phone, measurements: [] };
    customers.push(customer);
    this.save(customers);
    return customer;
  }

  updateCustomer(id: string, name: string, phone: string): void {
    const customers = this.getCustomers();
    const c = customers.find(x => x.id === id);
    if (c) { c.name = name; c.phone = phone; }
    this.save(customers);
  }

  deleteCustomer(id: string): void {
    this.save(this.getCustomers().filter(c => c.id !== id));
  }

  getCustomer(id: string): Customer | undefined {
    return this.getCustomers().find(c => c.id === id);
  }

  addMeasurement(customerId: string, m: Omit<DressMeasurement, 'id'>): void {
    const customers = this.getCustomers();
    const c = customers.find(x => x.id === customerId);
    if (c) c.measurements.push({ ...m, id: this.generateId() });
    this.save(customers);
  }

  updateMeasurement(customerId: string, m: DressMeasurement): void {
    const customers = this.getCustomers();
    const c = customers.find(x => x.id === customerId);
    if (c) {
      const idx = c.measurements.findIndex(x => x.id === m.id);
      if (idx > -1) c.measurements[idx] = m;
    }
    this.save(customers);
  }

  deleteMeasurement(customerId: string, measurementId: string): void {
    const customers = this.getCustomers();
    const c = customers.find(x => x.id === customerId);
    if (c) c.measurements = c.measurements.filter(m => m.id !== measurementId);
    this.save(customers);
  }

  private getSampleData(): Customer[] {
    const sample: Customer[] = [
      {
        id: 'sample1',
        name: 'Ahmed Khan',
        phone: '0300-1234567',
        measurements: [
          {
            id: 'sm1',
            dressType: 'Shirt',
            measurements: { chest: '40', waist: '36', shoulder: '17', sleeveLength: '25', length: '30' },
            notes: 'Prefers loose fit'
          },
          {
            id: 'sm2',
            dressType: 'Pant',
            measurements: { waist: '34', hip: '40', length: '42' },
            notes: ''
          }
        ]
      },
      {
        id: 'sample2',
        name: 'Sara Ali',
        phone: '0321-9876543',
        measurements: [
          {
            id: 'sm3',
            dressType: 'Blouse',
            measurements: { chest: '36', waist: '30', shoulder: '14', sleeveLength: '22', length: '18' },
            notes: 'Silk fabric preferred'
          }
        ]
      }
    ];
    this.save(sample);
    return sample;
  }
}
