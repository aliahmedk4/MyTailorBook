import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { AddOrderPage } from './add-order.page';

const routes: Routes = [{ path: '', component: AddOrderPage }];

@NgModule({
  imports: [CommonModule, ReactiveFormsModule, FormsModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [AddOrderPage]
})
export class AddOrderPageModule {}
