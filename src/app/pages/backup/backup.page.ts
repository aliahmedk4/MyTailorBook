import { Component, OnInit } from '@angular/core';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { GoogleDriveService } from '../../services/google-drive.service';
import { StorageService } from '../../services/storage.service';

@Component({
  selector: 'app-backup',
  templateUrl: './backup.page.html',
  styleUrls: ['./backup.page.scss'],
  standalone: false,
})
export class BackupPage implements OnInit {
  lastBackup: string | null = null;
  isSignedIn = false;
  userChecked = false;

  constructor(
    private drive: GoogleDriveService,
    private storage: StorageService,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    this.isSignedIn = this.drive.isSignedIn();
    if (this.isSignedIn) this.loadLastBackupTime();
    this.userChecked = true;
  }

  async loadLastBackupTime() {
    this.lastBackup = await this.drive.getLastBackupTime();
  }

  async signIn() {
    const loading = await this.loadingCtrl.create({ message: 'Signing in…', spinner: 'crescent' });
    await loading.present();
    try {
      await this.drive.signIn();
      this.isSignedIn = true;
      await this.loadLastBackupTime();
    } catch (e: any) {
      this.showToast(e.message || 'Sign-in failed', 'danger');
    } finally { await loading.dismiss(); }
  }

  signOut() {
    this.drive.signOut();
    this.isSignedIn = false;
    this.lastBackup = null;
  }

  async backup() {
    const loading = await this.loadingCtrl.create({ message: 'Backing up… uploading images', spinner: 'crescent' });
    await loading.present();
    try {
      const data = {
        version: 1,
        backedUpAt: new Date().toISOString(),
        customers: this.storage.getCustomers(),
        orders: this.storage.getOrders(),
        dressConfigs: this.storage.getDressConfigs(),
      };
      await this.drive.backup(data);
      await this.loadLastBackupTime();
      this.showToast('✅ Backup saved to Google Drive!', 'success');
    } catch (e: any) {
      this.showToast(e.message || 'Backup failed', 'danger');
    } finally { await loading.dismiss(); }
  }

  async restore() {
    const alert = await this.alertCtrl.create({
      header: 'Restore Backup?',
      message: 'This will replace ALL current data with the backup from Google Drive. This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Restore', role: 'destructive', handler: () => this.doRestore() }
      ]
    });
    await alert.present();
  }

  private async doRestore() {
    const loading = await this.loadingCtrl.create({ message: 'Restoring from Google Drive…', spinner: 'crescent' });
    await loading.present();
    try {
      const data: any = await this.drive.restore();
      if (!data) { this.showToast('No backup found on Google Drive.', 'warning'); return; }
      this.storage.importData(data.customers || [], data.orders || [], data.dressConfigs || []);
      this.showToast('✅ Data restored successfully!', 'success');
    } catch (e: any) {
      this.showToast(e.message || 'Restore failed', 'danger');
    } finally { await loading.dismiss(); }
  }

  private async showToast(message: string, color: string) {
    const t = await this.toastCtrl.create({ message, duration: 3000, position: 'bottom', color });
    await t.present();
  }

  formatDate(iso: string | null): string {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d.toLocaleDateString() + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
