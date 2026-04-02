import { DressMeasurement } from './dress-measurement.model';

export interface Customer {
  id: string;
  name: string;         // display name = firstName + lastName
  firstName?: string;
  lastName?: string;
  phone?: string;
  altPhone?: string;
  address?: string;
  measurements: DressMeasurement[];
}
