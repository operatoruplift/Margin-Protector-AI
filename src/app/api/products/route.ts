import { products } from "@/lib/mockShopifyData";
import type { ApiResponse, Product } from "@/types";

export async function GET() {
  await new Promise((resolve) => setTimeout(resolve, 400));

  const response: ApiResponse<Product[]> = {
    data: products,
    meta: {
      timestamp: new Date().toISOString(),
      count: products.length,
    },
  };

  return Response.json(response);
}
