import { DressMeasurement } from './dress-measurement.model';

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  measurements: DressMeasurement[];
}
