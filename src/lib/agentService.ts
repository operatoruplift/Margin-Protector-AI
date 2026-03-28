import Anthropic from "@anthropic-ai/sdk";
import { headers } from "next/headers";
import type {
  Product,
  Order,
  DailyAnalytics,
  ApiResponse,
  RecommendedAction,
  ActionType,
  Urgency,
} from "@/types";

const anthropic = new Anthropic();

async function getBaseUrl(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") || "http";
  return `${protocol}://${host}`;
}

async function fetchBusinessData(): Promise<{
  products: Product[];
  orders: Order[];
  analytics: DailyAnalytics[];
}> {
  const baseUrl = await getBaseUrl();

  const [productsRes, ordersRes, analyticsRes] = await Promise.all([
    fetch(`${baseUrl}/api/products`),
    fetch(`${baseUrl}/api/orders`),
    fetch(`${baseUrl}/api/analytics`),
  ]);

  if (!productsRes.ok || !ordersRes.ok || !analyticsRes.ok) {
    throw new Error("Failed to fetch business data from internal APIs");
  }

  const [productsBody, ordersBody, analyticsBody] = (await Promise.all([
    productsRes.json(),
    ordersRes.json(),
    analyticsRes.json(),
  ])) as [
    ApiResponse<Product[]>,
    ApiResponse<Order[]>,
    ApiResponse<DailyAnalytics[]>,
  ];

  return {
    products: productsBody.data,
    orders: ordersBody.data,
    analytics: analyticsBody.data,
  };
}

function buildSystemPrompt(
  products: Product[],
  orders: Order[],
  analytics: DailyAnalytics[]
): string {
  return `You are a CEO-level AI analyst for an e-commerce business. Your job is to analyze real-time business data and produce actionable recommendations.

## Business Rules (MUST follow)

1. **RESTOCK (HIGH urgency):** Any product where currentInventory < reorderThreshold is critically low on stock. Generate a RESTOCK action with HIGH urgency for EACH such product. Include the product name, current stock, and threshold in the description.

2. **DISCOUNT (MEDIUM urgency):** Any day where conversionRate < 0.030 (3.0%) indicates a conversion dip. Generate a DISCOUNT action with MEDIUM urgency suggesting a promotional campaign to boost conversions. Reference the specific dates and rates.

3. **MARKETING (MEDIUM urgency):** If activeSessions drops below 1500 on any day, generate a MARKETING action to drive traffic. Reference the specific dates.

4. **ALERT (LOW urgency):** Flag any notable patterns in orders — e.g., high refund rates, clusters of pending orders, or revenue anomalies.

## Current Business Data

### Products (all prices in cents)
${JSON.stringify(products, null, 2)}

### Recent Orders (totals in cents)
${JSON.stringify(orders, null, 2)}

### 7-Day Trailing Analytics (revenue in cents, conversionRate as decimal 0-1)
${JSON.stringify(analytics, null, 2)}

## Output Format

Respond with ONLY a valid JSON array. No markdown, no code fences, no explanation, no text before or after the array.

Each object in the array must match this exact schema:
{
  "id": "action-{TYPE}-{index}",
  "type": "RESTOCK" | "DISCOUNT" | "MARKETING" | "ALERT",
  "title": "Short action title",
  "description": "Detailed explanation of the issue and recommendation",
  "urgency": "HIGH" | "MEDIUM" | "LOW",
  "proposedExecution": "Specific step-by-step action to take"
}

Generate between 4 and 8 actions based on your analysis.`;
}

async function callClaudeAPI(systemPrompt: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    temperature: 0,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content:
          "Analyze the business data and generate your recommended actions now.",
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Claude response");
  }
  return textBlock.text;
}

function parseAndValidateActions(raw: string): RecommendedAction[] {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed: unknown = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) {
    throw new Error("Claude response is not a JSON array");
  }

  const validTypes: ActionType[] = [
    "RESTOCK",
    "DISCOUNT",
    "MARKETING",
    "ALERT",
  ];
  const validUrgencies: Urgency[] = ["HIGH", "MEDIUM", "LOW"];

  return parsed.map((item: unknown, index: number) => {
    const action = item as Record<string, unknown>;

    if (typeof action.id !== "string")
      throw new Error(`Action ${index}: missing or invalid id`);
    if (!validTypes.includes(action.type as ActionType))
      throw new Error(`Action ${index}: invalid type "${action.type}"`);
    if (typeof action.title !== "string")
      throw new Error(`Action ${index}: missing or invalid title`);
    if (typeof action.description !== "string")
      throw new Error(`Action ${index}: missing or invalid description`);
    if (!validUrgencies.includes(action.urgency as Urgency))
      throw new Error(`Action ${index}: invalid urgency "${action.urgency}"`);
    if (typeof action.proposedExecution !== "string")
      throw new Error(
        `Action ${index}: missing or invalid proposedExecution`
      );

    return {
      id: action.id as string,
      type: action.type as ActionType,
      title: action.title as string,
      description: action.description as string,
      urgency: action.urgency as Urgency,
      proposedExecution: action.proposedExecution as string,
    };
  });
}

export async function runCEOAgent(): Promise<RecommendedAction[]> {
  const { products, orders, analytics } = await fetchBusinessData();
  const systemPrompt = buildSystemPrompt(products, orders, analytics);
  const rawResponse = await callClaudeAPI(systemPrompt);
  return parseAndValidateActions(rawResponse);
}
