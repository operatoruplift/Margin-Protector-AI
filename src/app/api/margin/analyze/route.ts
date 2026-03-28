/**
 * POST /api/margin/analyze
 *
 * Runs the 6-heuristic margin analysis engine against current store data.
 * Returns an array of RecommendedAction objects with transparent AI reasoning.
 *
 * Heuristics: Dead Stock, Shipping Erosion, Critical Restock,
 *             Conversion Dip, Refund Anomaly, Pending Backlog
 */

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
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    return Response.json(
      { error: "Margin analysis failed", details: message },
      { status: 500 }
    );
  }
}
