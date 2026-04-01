import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { StorageService } from '../../services/storage.service';
import { DressConfig, MeasurementField } from '../../models/dress-config.model';
import { OrderStatus } from '../../models/order.model';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false,
})
export class SettingsPage implements OnInit {
  configs: DressConfig[] = [];
  expandedId: string | null = null;
  statuses: string[] = [];
  defaultStatus!: OrderStatus;

  constructor(
    private storage: StorageService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.configs = this.storage.getDressConfigs();
    this.defaultStatus = this.storage.getDefaultStatus();
    this.statuses = this.storage.getStatuses();
  }

  setDefaultStatus(status: OrderStatus) {
    this.defaultStatus = status;
    this.storage.setDefaultStatus(status);
    this.toast(`Default status: "${status}"`);
  }

  async addStatus() {
    const alert = await this.alertCtrl.create({
      header: 'Add Status',
      inputs: [{ name: 'name', type: 'text', placeholder: 'e.g. Cutting, Stitching' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add',
          handler: (data) => {
            const name = data.name?.trim();
            if (!name) return false;
            if (this.statuses.includes(name)) { this.toast('Already exists'); return false; }
            const updated = [...this.statuses, name];
            this.storage.saveStatuses(updated);
            this.statuses = updated;
            this.toast(`"${name}" added`);
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async removeStatus(status: string) {
    if (status === 'Pending') { this.toast('Cannot remove Pending'); return; }
    const alert = await this.alertCtrl.create({
      header: `Remove "${status}"?`,
      message: 'Existing orders with this status are not affected.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove', role: 'destructive',
          handler: () => {
            const updated = this.statuses.filter(s => s !== status);
            this.storage.saveStatuses(updated);
            this.statuses = updated;
            if (this.defaultStatus === status) {
              this.storage.setDefaultStatus('Pending');
              this.defaultStatus = 'Pending';
            }
            this.toast(`"${status}" removed`);
          }
        }
      ]
    });
    await alert.present();
  }

  toggle(id: string) {
    this.expandedId = this.expandedId === id ? null : id;
  }

  async addDressType() {
    const alert = await this.alertCtrl.create({
      header: 'New Dress Type',
      inputs: [{ name: 'name', type: 'text', placeholder: 'e.g. Sherwani, Lehenga' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add',
          handler: (data) => {
            const name = data.name?.trim();
            if (!name) return false;
            this.storage.addDressConfig(name, []);
            this.load();
            this.toast(`"${name}" added`);
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async renameDressType(config: DressConfig) {
    const alert = await this.alertCtrl.create({
      header: 'Rename Dress Type',
      inputs: [{ name: 'name', type: 'text', value: config.name }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: (data) => {
            const name = data.name?.trim();
            if (!name) return false;
            this.storage.updateDressConfig({ ...config, name });
            this.load();
            this.toast('Renamed successfully');
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async deleteDressType(config: DressConfig) {
    const alert = await this.alertCtrl.create({
      header: `Delete "${config.name}"?`,
      message: 'This only removes it from the list. Existing orders are not affected.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete', role: 'destructive',
          handler: () => {
            this.storage.deleteDressConfig(config.id);
            if (this.expandedId === config.id) this.expandedId = null;
            this.load();
            this.toast(`"${config.name}" deleted`);
          }
        }
      ]
    });
    await alert.present();
  }

  async addField(config: DressConfig) {
    const alert = await this.alertCtrl.create({
      header: `Add Field to ${config.name}`,
      inputs: [{ name: 'label', type: 'text', placeholder: 'e.g. Neck, Knee, Armhole' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add',
          handler: (data) => {
            const label = data.label?.trim();
            if (!label) return false;
            const key = label.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now().toString(36);
            const updated: DressConfig = { ...config, fields: [...config.fields, { key, label }] };
            this.storage.updateDressConfig(updated);
            this.load();
            this.toast(`"${label}" field added`);
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async editField(config: DressConfig, field: MeasurementField) {
    const alert = await this.alertCtrl.create({
      header: 'Edit Field Name',
      inputs: [{ name: 'label', type: 'text', value: field.label }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: (data) => {
            const label = data.label?.trim();
            if (!label) return false;
            const fields = config.fields.map(f => f.key === field.key ? { ...f, label } : f);
            this.storage.updateDressConfig({ ...config, fields });
            this.load();
            this.toast('Field updated');
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  deleteField(config: DressConfig, field: MeasurementField) {
    const fields = config.fields.filter(f => f.key !== field.key);
    this.storage.updateDressConfig({ ...config, fields });
    this.load();
    this.toast(`"${field.label}" removed`);
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 1800, position: 'bottom', color: 'dark' });
    await t.present();
  }
}
