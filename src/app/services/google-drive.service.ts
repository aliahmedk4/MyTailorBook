/// <reference types="google.accounts" />
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Capacitor } from '@capacitor/core';

const WEB_CLIENT_ID    = '698576182522-ca5o3snq3bfopn0b2nibqh5tq08b7tog.apps.googleusercontent.com';
const SCOPE            = 'https://www.googleapis.com/auth/drive.appdata';
const BACKUP_FILENAME  = 'mytailorbook_backup.json';
const DRIVE_FILES_URL  = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const TOKEN_KEY        = 'gdrive_token';
const TOKEN_EXPIRY_KEY = 'gdrive_token_expiry';

@Injectable({ providedIn: 'root' })
export class GoogleDriveService {

  constructor(private http: HttpClient) {}

  // ── Auth ────────────────────────────────────────────────────────

  async signIn(): Promise<string> {
    const cached = this.getCachedToken();
    if (cached) return cached;

    if (Capacitor.isNativePlatform()) {
      return this.nativeSignIn();
    }
    return this.webSignIn();
  }

  private webSignIn(): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: WEB_CLIENT_ID,
        scope: SCOPE,
        callback: (response: any) => {
          if (response.error) { reject(new Error(response.error)); return; }
          this.cacheToken(response.access_token, response.expires_in || 3500);
          resolve(response.access_token);
        },
      });
      client.requestAccessToken();
    });
  }

  private async nativeSignIn1(): Promise<string> {
    const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
    try {
      const user = await GoogleAuth.signIn();
      const token = user.authentication?.accessToken;
      if (!token) throw new Error('No access token from native sign-in');
      this.cacheToken(token, 3500);
      return token;
    } catch (e: any) {
      throw new Error(e?.message || JSON.stringify(e) || 'Sign-in failed');
    }
  }

  private async nativeSignIn(): Promise<string> {
    const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
  
    // ✅ MUST initialize on native
    GoogleAuth.initialize({
      clientId: WEB_CLIENT_ID,
      scopes: [SCOPE],
      grantOfflineAccess: true,
    });
  
    try {
      const user = await GoogleAuth.signIn();
      const token = user.authentication?.accessToken;
  
      if (!token) throw new Error('No access token from native sign-in');
  
      this.cacheToken(token, 3500);
      return token;
  
    } catch (e: any) {
      console.error('Native Google Sign-In Error:', e);
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
  }

  private headers(token: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // ── Backup ──────────────────────────────────────────────────────

  async backup(data: object): Promise<void> {
    const token  = await this.signIn();
    const fileId = await this.findBackupFile(token);
    const form   = new FormData();
    form.append('metadata', new Blob([JSON.stringify({
      name: BACKUP_FILENAME,
      ...(fileId ? {} : { parents: ['appDataFolder'] }),
      mimeType: 'application/json',
    })], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(data)], { type: 'application/json' }));

    const url = fileId
      ? `${DRIVE_UPLOAD_URL}/${fileId}?uploadType=multipart`
      : `${DRIVE_UPLOAD_URL}?uploadType=multipart`;
    const method = fileId ? 'patch' : 'post';
    await firstValueFrom(this.http[method](url, form, { headers: this.headers(token) }));
  }

  // ── Restore ─────────────────────────────────────────────────────

  async restore(): Promise<object | null> {
    const token  = await this.signIn();
    const fileId = await this.findBackupFile(token);
    if (!fileId) return null;
    return firstValueFrom(
      this.http.get<object>(`${DRIVE_FILES_URL}/${fileId}?alt=media`, { headers: this.headers(token) })
    );
  }

  // ── Last Backup Time ────────────────────────────────────────────

  async getLastBackupTime(): Promise<string | null> {
    try {
      const token  = await this.signIn();
      const fileId = await this.findBackupFile(token);
      if (!fileId) return null;
      const res = await firstValueFrom(
        this.http.get<any>(`${DRIVE_FILES_URL}/${fileId}?fields=modifiedTime`, { headers: this.headers(token) })
      );
      return res.modifiedTime || null;
    } catch { return null; }
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private async findBackupFile(token: string): Promise<string | null> {
    const res = await firstValueFrom(
      this.http.get<any>(
        `${DRIVE_FILES_URL}?spaces=appDataFolder&q=name='${BACKUP_FILENAME}'&fields=files(id)`,
        { headers: this.headers(token) }
      )
    );
    return res.files?.[0]?.id || null;
  }
}
