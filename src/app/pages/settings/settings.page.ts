import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { StorageService, TailorInfo, PdfHeaderStyle } from '../../services/storage.service';
import { DressConfig, MeasurementField } from '../../models/dress-config.model';
import { OrderStatus } from '../../models/order.model';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false,
})
export class SettingsPage implements OnInit {
  tailorInfo!: TailorInfo;
  configs: DressConfig[] = [];
  expandedId: string | null = null;
  statuses: string[] = [];
  defaultStatus!: OrderStatus;
  terms: string[] = [];
  pdfStyle!: PdfHeaderStyle;
  saved = false;
  private saveTimer: any;

  constructor(
    private storage: StorageService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.tailorInfo    = this.storage.getTailorInfo();
    this.configs       = this.storage.getDressConfigs();
    this.defaultStatus = this.storage.getDefaultStatus();
    this.statuses      = this.storage.getStatuses();
    this.terms         = this.storage.getTerms();
    this.pdfStyle      = this.storage.getPdfHeaderStyle();
  }

  autoSaveTailorInfo() {
    this.storage.saveTailorInfo(this.tailorInfo);
    this.flashSaved();
  }

  autoSavePdfStyle() {
    this.storage.savePdfHeaderStyle(this.pdfStyle);
    this.flashSaved();
  }

  private flashSaved() {
    this.saved = true;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saved = false, 2000);
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

  statusColor(status: string): string {
    const map: Record<string, string> = {
      'Pending': '#f59e0b', 'In Progress': '#0ea5e9',
      'Ready': '#10b981', 'Delivered': '#94a3b8',
    };
    return map[status] || '#6c63ff';
  }

  async addTerm() {
    const alert = await this.alertCtrl.create({
      header: 'Add Term',
      inputs: [{ name: 'text', type: 'textarea', placeholder: 'Enter term or condition...' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add',
          handler: (data) => {
            const text = data.text?.trim();
            if (!text) return false;
            const updated = [...this.terms, text];
            this.storage.saveTerms(updated);
            this.terms = updated;
            this.toast('Term added');
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async editTerm(index: number) {
    const alert = await this.alertCtrl.create({
      header: 'Edit Term',
      inputs: [{ name: 'text', type: 'textarea', value: this.terms[index] }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: (data) => {
            const text = data.text?.trim();
            if (!text) return false;
            const updated = [...this.terms];
            updated[index] = text;
            this.storage.saveTerms(updated);
            this.terms = updated;
            this.toast('Term updated');
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  removeTerm(index: number) {
    const updated = this.terms.filter((_, i) => i !== index);
    this.storage.saveTerms(updated);
    this.terms = updated;
    this.toast('Term removed');
  }
}
