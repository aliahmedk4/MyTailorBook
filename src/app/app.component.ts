import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  menuPages = [
    { title: 'Customers', url: '/home',   icon: 'people-outline' },
    { title: 'Orders',    url: '/orders', icon: 'receipt-outline' },
    { title: 'Backup',    url: '/backup', icon: 'cloud-outline' },
  ];

  constructor() {}
}
