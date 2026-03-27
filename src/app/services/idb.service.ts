import { Injectable } from '@angular/core';
import { Order } from '../models/order.model';

const DB_NAME    = 'tailorbook';
const DB_VERSION = 2;
const ORDERS     = 'orders';
const IMAGES     = 'images';

@Injectable({ providedIn: 'root' })
export class IdbService {

  private db: IDBDatabase | null = null;

  private open(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(ORDERS)) {
          db.createObjectStore(ORDERS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(IMAGES)) {
          db.createObjectStore(IMAGES); // key = orderId
        }
      };
      req.onsuccess = () => { this.db = req.result; resolve(this.db); };
      req.onerror   = () => reject(req.error);
    });
  }

  // ── Orders ──────────────────────────────────────────────────────

  async saveOrder(order: Order): Promise<void> {
    const { imageUrl, ...rest } = order; // never store imageUrl in orders store
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(ORDERS, 'readwrite').objectStore(ORDERS).put(rest);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(ORDERS, 'readonly').objectStore(ORDERS).get(id);
      req.onsuccess = () => resolve(req.result ?? undefined);
      req.onerror   = () => reject(req.error);
    });
  }

  async getAllOrders(): Promise<Order[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(ORDERS, 'readonly').objectStore(ORDERS).getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror   = () => reject(req.error);
    });
  }

  async deleteOrder(id: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(ORDERS, 'readwrite').objectStore(ORDERS).delete(id);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  async clearOrders(): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(ORDERS, 'readwrite').objectStore(ORDERS).clear();
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  // Bulk write — used by import/restore
  async bulkSaveOrders(orders: Order[]): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(ORDERS, 'readwrite');
      const store = tx.objectStore(ORDERS);
      orders.forEach(o => { const { imageUrl, ...rest } = o; store.put(rest); });
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  }

  // ── Images ──────────────────────────────────────────────────────

  async saveImage(orderId: string, dataUrl: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(IMAGES, 'readwrite').objectStore(IMAGES).put(dataUrl, orderId);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  async getImage(orderId: string): Promise<string | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(IMAGES, 'readonly').objectStore(IMAGES).get(orderId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => reject(req.error);
    });
  }

  async deleteImage(orderId: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(IMAGES, 'readwrite').objectStore(IMAGES).delete(orderId);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  async getAllImages(): Promise<Record<string, string>> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const result: Record<string, string> = {};
      const tx       = db.transaction(IMAGES, 'readonly');
      const store    = tx.objectStore(IMAGES);
      const keysReq  = store.getAllKeys();
      keysReq.onsuccess = () => {
        const keys = keysReq.result as string[];
        if (!keys.length) { resolve(result); return; }
        let done = 0;
        keys.forEach(key => {
          const vReq = store.get(key);
          vReq.onsuccess = () => { result[key as string] = vReq.result; if (++done === keys.length) resolve(result); };
          vReq.onerror   = () => reject(vReq.error);
        });
      };
      keysReq.onerror = () => reject(keysReq.error);
    });
  }

  async bulkSaveImages(images: Record<string, string>): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(IMAGES, 'readwrite');
      const store = tx.objectStore(IMAGES);
      store.clear();
      Object.entries(images).forEach(([k, v]) => store.put(v, k));
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  }
}
