/**
 * POST /api/agent/run
 *
 * Alternative entry point for the margin analysis engine.
 * Identical output to /api/margin/analyze — exists for backward compatibility.
 */

import { runMarginAnalysis } from "@/lib/marginAnalyzer";
import { products, orders, analytics } from "@/lib/mockShopifyData";
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
      { error: "Agent execution failed", details: message },
      { status: 500 }
    );
  }
}
