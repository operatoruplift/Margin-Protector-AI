import { orders } from "@/lib/mockShopifyData";
import type { ApiResponse, Order } from "@/types";

export async function GET() {
  await new Promise((resolve) => setTimeout(resolve, 400));

  const response: ApiResponse<Order[]> = {
    data: orders,
    meta: {
      timestamp: new Date().toISOString(),
      count: orders.length,
    },
  };

  return Response.json(response);
}
