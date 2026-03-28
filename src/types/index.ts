// Prices are stored as integer cents to avoid floating-point precision issues.

export type ProductStatus = "active" | "draft" | "archived";

export interface Product {
  id: string;
  title: string;
  sku: string;
  price: number;
  currentInventory: number;
  reorderThreshold: number;
  status: ProductStatus;
  shippingCost: number;
  totalSold30d: number;
}

export type OrderStatus = "fulfilled" | "pending" | "refunded";

export interface Order {
  id: string;
  customerId: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
}

export interface DailyAnalytics {
  date: string;
  dailyRevenue: number;
  conversionRate: number;
  activeSessions: number;
}

export interface ApiResponse<T> {
  data: T;
  meta: {
    timestamp: string;
    count: number;
  };
}

export type ActionType = "RESTOCK" | "DISCOUNT" | "MARKETING" | "ALERT";
export type Urgency = "HIGH" | "MEDIUM" | "LOW";

export interface RecommendedAction {
  id: string;
  type: ActionType;
  title: string;
  description: string;
  urgency: Urgency;
  proposedExecution: string;
  aiReasoning?: string;
}
