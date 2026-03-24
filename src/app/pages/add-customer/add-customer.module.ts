import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { AddCustomerPage } from './add-customer.page';

const routes: Routes = [{ path: '', component: AddCustomerPage }];

@NgModule({
  imports: [CommonModule, ReactiveFormsModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [AddCustomerPage]
})
export class AddCustomerPageModule {}
