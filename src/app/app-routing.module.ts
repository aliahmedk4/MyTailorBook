import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: 'home', loadChildren: () => import('./home/home.module').then(m => m.HomePageModule) },
  { path: 'orders', loadChildren: () => import('./pages/orders/orders.module').then(m => m.OrdersPageModule) },
  { path: 'add-customer/:id', loadChildren: () => import('./pages/add-customer/add-customer.module').then(m => m.AddCustomerPageModule) },
  { path: 'customer-detail/:id', loadChildren: () => import('./pages/customer-detail/customer-detail.module').then(m => m.CustomerDetailPageModule) },
  { path: 'add-measurement/:customerId/:measurementId', loadChildren: () => import('./pages/add-measurement/add-measurement.module').then(m => m.AddMeasurementPageModule) },
  { path: 'add-order/:customerId/:orderId', loadChildren: () => import('./pages/add-order/add-order.module').then(m => m.AddOrderPageModule) },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'backup',
    loadChildren: () => import('./pages/backup/backup.module').then( m => m.BackupPageModule)
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule]
})
export class AppRoutingModule {}
