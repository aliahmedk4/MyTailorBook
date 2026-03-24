import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { CustomerDetailPage } from './customer-detail.page';

const routes: Routes = [{ path: '', component: CustomerDetailPage }];

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [CustomerDetailPage]
})
export class CustomerDetailPageModule {}
