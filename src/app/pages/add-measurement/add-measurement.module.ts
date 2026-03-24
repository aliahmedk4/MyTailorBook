import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { AddMeasurementPage } from './add-measurement.page';

const routes: Routes = [{ path: '', component: AddMeasurementPage }];

@NgModule({
  imports: [CommonModule, ReactiveFormsModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [AddMeasurementPage]
})
export class AddMeasurementPageModule {}
