import { analytics } from "@/lib/mockShopifyData";
import type { ApiResponse, DailyAnalytics } from "@/types";

export async function GET() {
  await new Promise((resolve) => setTimeout(resolve, 400));

  const response: ApiResponse<DailyAnalytics[]> = {
    data: analytics,
    meta: {
      timestamp: new Date().toISOString(),
      count: analytics.length,
    },
  };

  return Response.json(response);
}
