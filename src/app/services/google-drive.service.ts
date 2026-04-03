 /// <reference types="google.accounts" />
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { Order } from '../models/order.model';

// const ANDROID_CLIENT_ID  = '698576182522-049gdgch1cc0d3tpfkfsceeugmuh4tip.apps.googleusercontent.com';
const ANDROID_CLIENT_ID      = '698576182522-ca5o3snq3bfopn0b2nibqh5tq08b7tog.apps.googleusercontent.com';
const WEB_CLIENT_ID      = '698576182522-ca5o3snq3bfopn0b2nibqh5tq08b7tog.apps.googleusercontent.com';
const SCOPE              = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file';
const BACKUP_FILENAME    = 'mytailorbook_backup.json';
const DRIVE_FOLDER_NAME  = 'MyTailorBook';
const IMAGES_FOLDER_NAME = 'images';
const DRIVE_FILES_URL    = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL   = 'https://www.googleapis.com/upload/drive/v3/files';
const TOKEN_KEY          = 'gdrive_token';
const TOKEN_EXPIRY_KEY   = 'gdrive_token_expiry';
const SCOPE_VERSION      = 'v2';
const SCOPE_VER_KEY      = 'gdrive_scope_ver';

@Injectable({ providedIn: 'root' })
export class GoogleDriveService {

  constructor(private http: HttpClient) {}

  // ── Auth ────────────────────────────────────────────────────────

  async signIn(): Promise<string> {
    if (localStorage.getItem(SCOPE_VER_KEY) !== SCOPE_VERSION) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
    }
    const cached = this.getCachedToken();
    if (cached) return cached;
    return Capacitor.isNativePlatform() ? this.nativeSignIn() : this.webSignIn();
  }

  private webSignIn(): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: WEB_CLIENT_ID,
        scope: SCOPE,
        callback: (response: any) => {
          console.log(response.error);
          if (response.error) { reject(new Error(response.error)); return; }
          this.cacheToken(response.access_token, response.expires_in || 3500);
          resolve(response.access_token);
        },
      });
      client.requestAccessToken();
    });
  }

  private async nativeSignIn(): Promise<string> {
    const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
    GoogleAuth.initialize({
      clientId: Capacitor.isNativePlatform() ? ANDROID_CLIENT_ID : WEB_CLIENT_ID,
      scopes: SCOPE.split(' '),
      grantOfflineAccess: true,
    });
    try {
      const user  = await GoogleAuth.signIn();
      const token = user.authentication?.accessToken;
      if (!token) throw new Error('No access token from native sign-in');
      this.cacheToken(token, 3500);
      return token;
    } catch (e: any) {
      throw new Error(e?.message || JSON.stringify(e) || 'Sign-in failed');
    }
  }

  async signOut(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
      await GoogleAuth.signOut();
    } else {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) google.accounts.oauth2.revoke(token, () => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }

  isSignedIn(): boolean { return !!this.getCachedToken(); }

  private getCachedToken(): string | null {
    const token  = localStorage.getItem(TOKEN_KEY);
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!token || !expiry) return null;
    if (Date.now() > parseInt(expiry, 10)) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
      return null;
    }
    return token;
  }

  private cacheToken(token: string, expiresIn: number) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, (Date.now() + expiresIn * 1000).toString());
    localStorage.setItem(SCOPE_VER_KEY, SCOPE_VERSION);
  }

  private headers(token: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // ── Backup ──────────────────────────────────────────────────────

  async backup(data: { customers: any[]; orders: Order[]; dressConfigs: any[]; version: number; backedUpAt: string; images?: Record<string, string> }): Promise<void> {
    const token    = await this.signIn();
    const rootId   = await this.findOrCreateFolder(token, null, DRIVE_FOLDER_NAME);
    const imagesId = await this.findOrCreateFolder(token, rootId, IMAGES_FOLDER_NAME);

    // Upload each image from the images map, store Drive fileId on the order
    const imageMap = data.images || {};
    const ordersForJson = await Promise.all(data.orders.map(async order => {
      const dataUrl = imageMap[order.id];
      if (!dataUrl) return order;
      const fileId = await this.upsertImageFile(token, imagesId, order.id, dataUrl);
      return { ...order, imageFileId: fileId };
    }));

    const payload = { ...data, orders: ordersForJson, images: undefined };
    const blob    = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });

    await Promise.all([
      this.upsertJsonFile(token, 'appDataFolder', blob, true),
      this.upsertJsonFile(token, rootId, blob, false),
    ]);
  }

  // ── Restore ─────────────────────────────────────────────────────

  async restore(): Promise<any | null> {
    const token   = await this.signIn();
    const rootId  = await this.findOrCreateFolder(token, null, DRIVE_FOLDER_NAME);
    const visibleFileId = await this.findFileInFolder(token, rootId, BACKUP_FILENAME);
    const fileId  = visibleFileId || await this.findAppDataFile(token);
    if (!fileId) return null;

    const data: any = await firstValueFrom(
      this.http.get<object>(`${DRIVE_FILES_URL}/${fileId}?alt=media`, { headers: this.headers(token) })
    );

    // Download images from Drive back into images map { orderId -> dataUrl }
    const images: Record<string, string> = {};
    if (data.orders?.length) {
      await Promise.all(data.orders.map(async (order: any) => {
        if (!order.imageFileId) return;
        try {
          images[order.id] = await this.downloadImage(token, order.imageFileId);
        } catch { /* image missing, skip */ }
      }));
    }

    return { ...data, images };
  }

  // ── Last Backup Time ────────────────────────────────────────────

  async getLastBackupTime(): Promise<string | null> {
    try {
      const token  = await this.signIn();
      const rootId = await this.findOrCreateFolder(token, null, DRIVE_FOLDER_NAME);
      const fileId = await this.findFileInFolder(token, rootId, BACKUP_FILENAME) || await this.findAppDataFile(token);
      if (!fileId) return null;
      const res = await firstValueFrom(
        this.http.get<any>(`${DRIVE_FILES_URL}/${fileId}?fields=modifiedTime`, { headers: this.headers(token) })
      );
      return res.modifiedTime || null;
    } catch { return null; }
  }

  // ── Image helpers ───────────────────────────────────────────────

  private async upsertImageFile(token: string, folderId: string, orderId: string, dataUrl: string): Promise<string> {
    const filename = `order_${orderId}.jpg`;
    const existing = await this.findFileInFolder(token, folderId, filename);

    // Convert base64 data URL to binary blob
    const base64 = dataUrl.split(',')[1];
    const binary  = atob(base64);
    const bytes   = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const imageBlob = new Blob([bytes], { type: 'image/jpeg' });

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({
      name: filename,
      mimeType: 'image/jpeg',
      ...(existing ? {} : { parents: [folderId] }),
    })], { type: 'application/json' }));
    form.append('file', imageBlob);

    const url    = existing ? `${DRIVE_UPLOAD_URL}/${existing}?uploadType=multipart` : `${DRIVE_UPLOAD_URL}?uploadType=multipart`;
    const method = existing ? 'patch' : 'post';
    const res: any = await firstValueFrom(this.http[method](url, form, { headers: this.headers(token) }));
    return res.id;
  }

  private async downloadImage(token: string, fileId: string): Promise<string> {
    const arrayBuffer = await firstValueFrom(
      this.http.get(`${DRIVE_FILES_URL}/${fileId}?alt=media`, {
        headers: this.headers(token),
        responseType: 'arraybuffer',
      })
    );
    const bytes  = new Uint8Array(arrayBuffer);
    let binary   = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return `data:image/jpeg;base64,${btoa(binary)}`;
  }

  // ── File / Folder helpers ───────────────────────────────────────

  private async upsertJsonFile(token: string, parentId: string, blob: Blob, isAppData: boolean): Promise<void> {
    const existing = isAppData
      ? await this.findAppDataFile(token)
      : await this.findFileInFolder(token, parentId, BACKUP_FILENAME);

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({
      name: BACKUP_FILENAME,
      mimeType: 'application/json',
      ...(existing ? {} : { parents: [parentId] }),
    })], { type: 'application/json' }));
    form.append('file', blob);

    const url    = existing ? `${DRIVE_UPLOAD_URL}/${existing}?uploadType=multipart` : `${DRIVE_UPLOAD_URL}?uploadType=multipart`;
    const method = existing ? 'patch' : 'post';
    await firstValueFrom(this.http[method](url, form, { headers: this.headers(token) }));
  }

  private async findOrCreateFolder(token: string, parentId: string | null, name: string): Promise<string> {
    const parentClause = parentId ? ` and '${parentId}' in parents` : '';
    const res = await firstValueFrom(
      this.http.get<any>(
        `${DRIVE_FILES_URL}?q=name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentClause}&fields=files(id)`,
        { headers: this.headers(token) }
      )
    );
    if (res.files?.[0]?.id) return res.files[0].id;
    const body: any = { name, mimeType: 'application/vnd.google-apps.folder' };
    if (parentId) body.parents = [parentId];
    const folder = await firstValueFrom(
      this.http.post<any>(DRIVE_FILES_URL, body, { headers: this.headers(token) })
    );
    return folder.id;
  }

  private async findFileInFolder(token: string, folderId: string, filename: string): Promise<string | null> {
    const res = await firstValueFrom(
      this.http.get<any>(
        `${DRIVE_FILES_URL}?q=name='${filename}' and '${folderId}' in parents and trashed=false&fields=files(id)`,
        { headers: this.headers(token) }
      )
    );
    return res.files?.[0]?.id || null;
  }

  private async findAppDataFile(token: string): Promise<string | null> {
    const res = await firstValueFrom(
      this.http.get<any>(
        `${DRIVE_FILES_URL}?spaces=appDataFolder&q=name='${BACKUP_FILENAME}'&fields=files(id)`,
        { headers: this.headers(token) }
      )
    );
    return res.files?.[0]?.id || null;
  }
}
