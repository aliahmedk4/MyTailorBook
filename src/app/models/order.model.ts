export type OrderStatus = string;

export interface OrderDressItem {
  dressType: string;
  measurements: Record<string, string>;
  imageUrl?: string;
  imageFileId?: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  dressType: string;           // kept for backward compat (= dressItems[0].dressType)
  quantity: number;
  price?: string;
  dueDate?: string;
  orderDate?: string;
  status: OrderStatus;
  measurements: Record<string, string>; // kept for backward compat
  dressItems?: OrderDressItem[];        // multi-dress support
  notes?: string;
  orderNo?: number;
  imageUrl?: string;
  imageFileId?: string;
  orderedDate?: string;
  createdAt: string;
}
