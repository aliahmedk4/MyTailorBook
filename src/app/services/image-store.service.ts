import { Injectable } from '@angular/core';

const DB_NAME    = 'tailor_images';
const DB_VERSION = 1;
const STORE_NAME = 'images';

@Injectable({ providedIn: 'root' })
export class ImageStoreService {

  private db: IDBDatabase | null = null;

  private open(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE_NAME); // key = orderId
      };
      req.onsuccess = () => { this.db = req.result; resolve(this.db); };
      req.onerror   = () => reject(req.error);
    });
  }

  async save(orderId: string, dataUrl: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(dataUrl, orderId);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  async get(orderId: string): Promise<string | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(orderId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => reject(req.error);
    });
  }

  async delete(orderId: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(orderId);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  // Returns { orderId -> dataUrl } map — used by backup
  async getAll(): Promise<Record<string, string>> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const result: Record<string, string> = {};
      const tx       = db.transaction(STORE_NAME, 'readonly');
      const store    = tx.objectStore(STORE_NAME);
      const keysReq  = store.getAllKeys();
      keysReq.onsuccess = () => {
        const keys = keysReq.result as string[];
        if (!keys.length) { resolve(result); return; }
        let done = 0;
        keys.forEach(key => {
          const vReq = store.get(key);
          vReq.onsuccess = () => {
            result[key] = vReq.result;
            if (++done === keys.length) resolve(result);
          };
          vReq.onerror = () => reject(vReq.error);
        });
      };
      keysReq.onerror = () => reject(keysReq.error);
    });
  }

  // Bulk restore — used by importData
  async restoreAll(images: Record<string, string>): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      Object.entries(images).forEach(([key, val]) => store.put(val, key));
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  }
}
