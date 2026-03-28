import { products, orders, analytics } from "@/lib/mockShopifyData";
import { runMarginAnalysis } from "@/lib/marginAnalyzer";
import type { ApiResponse, RecommendedAction } from "@/types";

export async function POST() {
  try {
    const actions = runMarginAnalysis(products, orders, analytics);

    const response: ApiResponse<RecommendedAction[]> = {
      data: actions,
      meta: {
        timestamp: new Date().toISOString(),
        count: actions.length,
      },
    };

    return Response.json(response);
  } catch (error) {
    console.error("Margin Analyzer error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    return Response.json(
      { error: "Margin analysis failed", details: message },
      { status: 500 }
    );
  }
}
