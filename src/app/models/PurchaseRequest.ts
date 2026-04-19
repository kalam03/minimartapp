import { PurchaseItem } from "./PurchaseItem";

export interface PurchaseRequest {
  supplierId: number;
  discount: number;
  paidAmount: number;
  paymentType: string;
  transport: string;
  transportCost: number;
  paymentMethod: string;
  paymentReferenceNo: string;
  remarks: string;
  items: PurchaseItem[];
}
export interface PurchaseResponse {
  success: boolean;
  message: string;
  data: {
    purchaseId: number;
    totalAmount: number;
    discount: number;
    transportCost: number;
    netAmount: number;
    paidAmount: number;
    dueAmount: number;
    returnAmount: number;
    paymentId: number;
  };
}

export interface PurchaseOrder {
  purchaseId: number;
  supplierId: string;
  supplierName: string;
  purchaseDate: string;
  totalAmount: number;
  netAmount: number;
  paidAmount: number;
  dueAmount: number;
  itemsCount: number;
  purchaseOrderNo?: string;
  date?: Date;
}

export interface PurchaseListResponse {
  success: boolean;
  data: {
    items: PurchaseOrder[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface SupplierBalanceResponse {
  success: boolean;
  data: {
    supplierId: number;
    balance: number;
  };
}

export interface SupplierPaymentRequest {
  supplierId: number;
  amount: number;
  paymentMethod: string;
  referenceNo: string;
  remarks: string;
  purchaseId?: number;
}

export interface SupplierPaymentResponse {
  success: boolean;
  message: string;
  data: {
    paymentId: number;
    paymentNo: string;
    amount: number;
    currentBalance: number;
  };
}