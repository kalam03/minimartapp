// models/product.model.ts
export interface Product {
  productId: number;
  tenantId: number;
  tenantName: string;
  productName: string;
  categoryId: number;
  categoryName: string;
  purchasePrice: number;
  salePrice: number;
  stockQty: number;
  barcode: string;
  unitType: string;       // 'PCS' | 'KG' | 'G' | 'L' | 'ML' | 'DOZ' | 'BOX'
  isActive: boolean;
  totalStockValue: number;
  profitMarginPercent: number;
  stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock';
  retrievedDate: Date;
  createdAt?: string;
}

export interface ProductFilter {
  tenantId?: number | null;
  isActive?: boolean | null;
  categoryId?: number | null;
  fromDate?: string | null;
  toDate?: string | null;
}