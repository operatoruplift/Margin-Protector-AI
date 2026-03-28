import { runCEOAgent } from "@/lib/agentService";
import type { ApiResponse, RecommendedAction } from "@/types";

export async function POST() {
  try {
    const actions = await runCEOAgent();

    const response: ApiResponse<RecommendedAction[]> = {
      data: actions,
      meta: {
        timestamp: new Date().toISOString(),
        count: actions.length,
      },
    };

    return Response.json(response);
  } catch (error) {
    console.error("CEO Agent error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    return Response.json(
      { error: "Agent execution failed", details: message },
      { status: 500 }
    );
  }
}
