export interface Measurements {
  chest?: string;
  waist?: string;
  hip?: string;
  shoulder?: string;
  sleeveLength?: string;
  length?: string;
}

export interface DressMeasurement {
  id: string;
  dressType: string;
  measurements: Measurements;
  notes?: string;
}
