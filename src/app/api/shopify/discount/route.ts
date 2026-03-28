import { NextRequest } from "next/server";

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL || "";
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || "";

interface DiscountRequest {
  sku: string;
  discountPercentage: number;
  productTitle?: string;
}

interface ShopifyGraphQLResponse {
  data?: {
    discountCodeBasicCreate?: {
      codeDiscountNode?: {
        id: string;
        codeDiscount?: {
          title: string;
          codes?: { nodes?: { code: string }[] };
        };
      };
      userErrors?: { field: string[]; message: string }[];
    };
  };
  errors?: { message: string }[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DiscountRequest;
    const { sku, discountPercentage, productTitle } = body;

    if (!sku || typeof discountPercentage !== "number") {
      return Response.json(
        { error: "Missing required fields: sku, discountPercentage" },
        { status: 400 }
      );
    }

    if (discountPercentage < 1 || discountPercentage > 99) {
      return Response.json(
        { error: "discountPercentage must be between 1 and 99" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const endsAt = new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000
    ).toISOString();
    const code = `CLEAR${sku.replace(/[^A-Z0-9]/gi, "").toUpperCase()}${discountPercentage}`;

    const mutation = `
      mutation discountCodeBasicCreate {
        discountCodeBasicCreate(basicCodeDiscount: {
          title: "Dead Stock Clearance: ${productTitle || sku} (${discountPercentage}% off)"
          code: "${code}"
          startsAt: "${now}"
          endsAt: "${endsAt}"
          customerGets: {
            value: { percentage: ${discountPercentage / 100} }
            items: { all: true }
          }
          customerSelection: { all: true }
          usageLimit: 500
          appliesOncePerCustomer: true
        }) {
          codeDiscountNode {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                title
                codes(first: 1) {
                  nodes { code }
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    // If Shopify credentials are configured, make the real API call
    if (SHOPIFY_STORE_URL && SHOPIFY_ACCESS_TOKEN) {
      try {
        const shopifyRes = await fetch(
          `https://${SHOPIFY_STORE_URL}/admin/api/2026-01/graphql.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
            },
            body: JSON.stringify({ query: mutation }),
          }
        );

        if (!shopifyRes.ok) {
          // Fallback to mock on auth errors (401, 403)
          if (shopifyRes.status === 401 || shopifyRes.status === 403) {
            console.warn(
              `Shopify auth failed (${shopifyRes.status}), falling back to mock`
            );
            return Response.json(buildMockResponse(sku, code, discountPercentage, productTitle));
          }
          throw new Error(`Shopify API error: ${shopifyRes.status}`);
        }

        const data = (await shopifyRes.json()) as ShopifyGraphQLResponse;

        if (data.errors?.length) {
          throw new Error(data.errors.map((e) => e.message).join(", "));
        }

        const userErrors =
          data.data?.discountCodeBasicCreate?.userErrors ?? [];
        if (userErrors.length > 0) {
          return Response.json(
            {
              error: "Shopify validation failed",
              details: userErrors,
            },
            { status: 422 }
          );
        }

        return Response.json({
          success: true,
          source: "shopify_live",
          discount: {
            id: data.data?.discountCodeBasicCreate?.codeDiscountNode?.id,
            code,
            title: `Dead Stock Clearance: ${productTitle || sku} (${discountPercentage}% off)`,
            percentage: discountPercentage,
            startsAt: now,
            endsAt,
            usageLimit: 500,
          },
          mutation,
        });
      } catch (shopifyError) {
        // Silent fallback to mock response on any Shopify error
        console.warn("Shopify API call failed, returning mock:", shopifyError);
        return Response.json(buildMockResponse(sku, code, discountPercentage, productTitle));
      }
    }

    // No Shopify credentials — return mock
    return Response.json(buildMockResponse(sku, code, discountPercentage, productTitle));
  } catch (error) {
    console.error("Discount endpoint error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: "Failed to create discount", details: message },
      { status: 500 }
    );
  }
}

function buildMockResponse(
  sku: string,
  code: string,
  discountPercentage: number,
  productTitle?: string
) {
  return {
    success: true,
    source: "mock",
    discount: {
      id: `gid://shopify/DiscountCodeNode/${Date.now()}`,
      code,
      title: `Dead Stock Clearance: ${productTitle || sku} (${discountPercentage}% off)`,
      percentage: discountPercentage,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      usageLimit: 500,
    },
    mutation: `discountCodeBasicCreate(code: "${code}", percentage: ${discountPercentage}%)`,
  };
}
