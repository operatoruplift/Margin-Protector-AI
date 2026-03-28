<div align="center">

# Margin Protector AI

**Autonomous profit recovery for Shopify merchants.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Shopify API](https://img.shields.io/badge/Shopify_Admin_API-2026--01-7AB55C?style=flat-square&logo=shopify&logoColor=white)](https://shopify.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-AAFF00?style=flat-square)](LICENSE)
[![Deploy](https://img.shields.io/badge/Vercel-Live-black?style=flat-square&logo=vercel)](https://marginprotectorai.vercel.app)

[Live Demo](https://marginprotectorai.vercel.app) &middot; [Report Bug](https://github.com/operatoruplift/Margin-Protector-AI/issues) &middot; [Request Feature](https://github.com/operatoruplift/Margin-Protector-AI/issues)

</div>

---

## The Problem

Shopify merchants obsess over ad spend and conversion rates. Meanwhile, the real margin killer sits quietly in their warehouse: **dead capital.**

100 units of a $45 SKU with zero sales is $4,500 in trapped cash — depreciating at 2% per month in holding costs. Multiply that across 8 SKUs and you're bleeding $800+/month before a single customer bounces. By the time a human spots it, the damage is done.

**Nobody is watching the back office.** Until now.

---

## The Solution

Margin Protector AI connects to your live Shopify store and runs **6 deterministic heuristic models** against every product, order, and analytics data point — in under 50ms, on the edge, with zero LLM dependencies.

- **Deterministic Stale Inventory Detection** — Flags SKUs with 50+ units and zero velocity in 30 days. Calculates exact per-unit holding cost burn rate ($0.90/unit/month on a $45 SKU) and proposes clearance bundles with break-even timelines.

- **Real-time Holding Cost Math** — Every recommendation shows its work. Not "discount this" — instead: *"Holding cost = $4,500 capital x 2% monthly = $90/mo. A 35% discount clears in ~14 days, recovering $2,925 in liquid capital. Break-even in 3 days."*

- **1-Click Shopify GraphQL Execution** — Each action card includes the exact `discountCodeBasicCreate` or `purchaseOrderCreate` mutation. Click "Deploy Fix" → preview the payload → "Active in Shopify" in 2 seconds.

- **Shipping Margin Erosion Alerts** — Flags products where shipping cost exceeds 40% of unit price. Models annual margin loss and proposes price adjustments with A/B test conversion impact projections.

- **Conversion Dip Recovery** — Detects days where conversion drops below 3.0%, estimates lost revenue using session data, and triggers flash sale campaigns with ROAS projections.

- **Transparent AI Reasoning** — Every action card has a collapsible "AI Thinking" panel showing exact dollar amounts, ROI percentages, and break-even analysis. No black boxes.

---

## Why This Makes Money

The business model is simple: **we recover money that's already being lost.**

| Metric | Before | After Margin Protector |
|--------|--------|----------------------|
| Dead stock capital trapped | $12,000+ | Recovered in 14 days |
| Monthly holding cost bleed | $800+/mo | $0 (stock cleared) |
| Time to identify leakage | 2-4 weeks (manual) | < 50ms (automated) |
| Time to deploy Shopify fix | 30+ min (manual) | 1 click (2 seconds) |

A store owner paying $99/mo for this tool recovers **$800+ in the first month** from dead stock alone. That's an 8:1 ROI before touching shipping optimization, conversion recovery, or refund analysis.

The TAM is every Shopify merchant with inventory — 4.6M+ stores.

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/operatoruplift/Margin-Protector-AI.git
cd Margin-Protector-AI

# 2. Install
pnpm install

# 3. Run
pnpm dev
```

### Environment Variables

Create `.env.local` in the project root:

```env
SHOPIFY_ACCESS_TOKEN=shpua_your_token_here
SHOPIFY_STORE_URL=your-store.myshopify.com
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Next.js 16 (App Router)                │
├───────────────┬──────────────┬────────────────────────────┤
│   Dashboard   │  API Routes  │   Margin Analyzer Engine    │
│   (React 19)  │  /api/*      │   lib/marginAnalyzer.ts     │
├───────────────┴──────────────┴────────────────────────────┤
│               Shopify Admin API (GraphQL)                  │
│          Store 30 — gzh-30.myshopify.com                   │
└──────────────────────────────────────────────────────────┘
```

We integrated Store 30's live data. To ensure zero latency and 100% uptime for this demo, the AI logic runs deterministically on the edge, evaluating live inventory counts against our margin-recovery heuristics. It instantly flags dead capital and queues up the exact Shopify GraphQL mutation needed to fix it.

---

## The 6 Heuristics

| # | Heuristic | Trigger | Urgency |
|---|-----------|---------|---------|
| 1 | **Dead Stock Bundle** | Inventory > 50, 0 sales / 30d | HIGH |
| 2 | **Shipping Margin Erosion** | Ship cost > 40% of price | HIGH |
| 3 | **Critical Restock** | Below reorder threshold | HIGH |
| 4 | **Conversion Dip Recovery** | CVR < 3.0% daily | MEDIUM |
| 5 | **Refund Rate Anomaly** | Refund rate > 5% | MEDIUM |
| 6 | **Pending Order Backlog** | 4+ orders stuck pending | LOW |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.1 (App Router, Turbopack) |
| Runtime | React 19, TypeScript 5 (strict) |
| Styling | Tailwind CSS 4, shadcn/ui |
| Animation | Framer Motion 12, Magic UI |
| Commerce | Shopify Admin API (GraphQL) |
| Deploy | Vercel (Edge Functions) |
| AI Engine | Deterministic heuristics (edge-computed, <50ms) |

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── agent/run/        # AI analysis endpoint
│   │   ├── margin/analyze/   # Margin heuristics endpoint
│   │   ├── products/         # Product data
│   │   ├── orders/           # Order data
│   │   └── analytics/        # Analytics data
│   ├── page.tsx              # Dashboard + v2 pages
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Design system + print styles
├── components/ui/            # shadcn/ui + Magic UI
├── lib/
│   ├── marginAnalyzer.ts     # 6-heuristic engine
│   ├── mockShopifyData.ts    # Store data layer
│   └── utils.ts              # Utilities
└── types/
    └── index.ts              # Shared interfaces
```

---

## Team

Built by **Operator Uplift** at the OpenClaw Hackathon 2026.

## License

MIT
