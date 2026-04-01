export type OrderStatus = 'Pending' | 'In Progress' | 'Ready' | 'Delivered';

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  dressType: string;
  quantity: number;
  price?: string;
  dueDate?: string;
  orderDate?: string;
  status: OrderStatus;
  measurements: Record<string, string>;
  notes?: string;
  imageUrl?: string;     // local base64 — never sent to Drive JSON
  imageFileId?: string;  // Drive file ID — stored in JSON, used to restore imageUrl
  createdAt: string;
}
