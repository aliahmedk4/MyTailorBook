export type OrderStatus = 'Pending' | 'In Progress' | 'Ready' | 'Delivered';

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  dressType: string;
  quantity: number;
  price?: string;
  dueDate?: string;
  status: OrderStatus;
  measurements: {
    chest?: string;
    waist?: string;
    hip?: string;
    shoulder?: string;
    sleeveLength?: string;
    length?: string;
  };
  notes?: string;
  imageUrl?: string;
  createdAt: string;
}
