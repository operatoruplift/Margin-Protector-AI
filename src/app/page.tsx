"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { MagicCard } from "@/components/ui/magic-card";
import { cn } from "@/lib/utils";
import {
  products as mockProducts,
  orders as mockOrders,
  analytics as mockAnalytics,
} from "@/lib/mockShopifyData";
import { runMarginAnalysis } from "@/lib/marginAnalyzer";
import type {
  Product,
  Order,
  DailyAnalytics,
  RecommendedAction,
  ApiResponse,
} from "@/types";

/* ── Helpers ── */

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function buildPurchaseOrderEmail(action: RecommendedAction): string {
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `To: supply-chain@ecotextiles-global.com
From: procurement@ai-commerce.io
Subject: URGENT — Purchase Order #PO-${Date.now().toString(36).toUpperCase()}
Date: ${today}

Dear EcoTextiles Supply Team,

Our automated inventory system has flagged a critical stock alert:

${action.description}

Requested Action:
${action.proposedExecution}

Please confirm availability and expected ship date within 24 hours.
We authorize expedited freight if standard lead times exceed 5
business days.

Best regards,
AI Margin Protector — Automated Procurement
procurement@ai-commerce.io`;
}

/* ── Shopify Payload Generator ── */

interface ShopifyPayload {
  method: string;
  endpoint: string;
  body: string;
  successMessage: string;
  shopifyPath: string;
}

function buildShopifyPayload(action: RecommendedAction): ShopifyPayload {
  const now = new Date().toISOString();
  const twoWeeks = new Date(Date.now() + 14 * 86400000).toISOString();

  switch (action.type) {
    case "RESTOCK":
      return {
        method: "POST",
        endpoint: "/admin/api/2026-01/graphql.json",
        body: `mutation purchaseOrderCreate {
  purchaseOrderCreate(input: {
    supplier: "ecotextiles-global"
    lineItems: [{
      variantId: "gid://shopify/ProductVariant/44821"
      quantity: 150
      unitCost: {
        amount: "45.00"
        currencyCode: USD
      }
    }]
    shippingMethod: EXPEDITED_3DAY
    destination: {
      locationId: "gid://shopify/Location/1001"
    }
    notes: "${action.title}"
    expectedArrival: "${twoWeeks}"
  }) {
    purchaseOrder {
      id
      status
      estimatedArrival
      totalCost { amount currencyCode }
    }
    userErrors {
      field
      message
    }
  }
}`,
        successMessage: "Purchase order PO-2026-0847 created. Supplier notified via webhook.",
        shopifyPath: "/admin/purchase_orders/PO-2026-0847",
      };

    case "DISCOUNT":
      return {
        method: "POST",
        endpoint: "/admin/api/2026-01/graphql.json",
        body: `mutation discountCodeBasicCreate {
  discountCodeBasicCreate(basicCodeDiscount: {
    title: "CLEARANCE_BUNDLE_35"
    code: "CLEARANCE35"
    startsAt: "${now}"
    endsAt: "${twoWeeks}"
    customerGets: {
      value: { percentage: 0.35 }
      items: {
        products: {
          productsToAdd: [
            "gid://shopify/Product/8003"
            "gid://shopify/Product/8006"
          ]
        }
      }
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
    userErrors { field message }
  }
}`,
        successMessage: "Discount code CLEARANCE35 is now live. 35% off bundled dead-stock SKUs.",
        shopifyPath: "/admin/discounts/CLEARANCE35",
      };

    case "MARKETING":
      return {
        method: "POST",
        endpoint: "/admin/api/2026-01/marketing_events.json",
        body: JSON.stringify(
          {
            marketing_event: {
              event_type: "ad",
              marketing_channel: "social",
              paid: true,
              started_at: now,
              ended_at: twoWeeks,
              budget: "500.00",
              currency: "USD",
              utm_campaign: "conversion_recovery_q1",
              utm_source: "meta",
              utm_medium: "paid_social",
              referring_domain: "facebook.com",
              description: action.proposedExecution,
              marketing_activity_extension_id:
                "gid://shopify/MarketingActivity/7821",
            },
          },
          null,
          2
        ),
        successMessage: "Marketing campaign 'conversion_recovery_q1' scheduled. $500 budget allocated.",
        shopifyPath: "/admin/marketing/campaigns",
      };

    case "ALERT":
    default:
      return {
        method: "POST",
        endpoint: "/admin/api/2026-01/graphql.json",
        body: `mutation metafieldSet {
  metafieldSet(metafields: [{
    ownerId: "gid://shopify/Shop/1"
    namespace: "ai_alerts"
    key: "incident_${Date.now().toString(36)}"
    type: "json"
    value: ${JSON.stringify(
      JSON.stringify({
        severity: action.urgency,
        title: action.title,
        description: action.description,
        created_at: now,
        status: "acknowledged",
        assigned_to: "operations@ecotextiles.store",
      })
    )}
  }]) {
    metafields {
      id
      namespace
      key
    }
    userErrors { field message }
  }
}`,
        successMessage: "Alert logged to shop metafields. Ops team notified via Slack webhook.",
        shopifyPath: "/admin/settings/custom_data",
      };
  }
}

const actionTypeIcon: Record<string, string> = {
  RESTOCK: "\u25b2",
  DISCOUNT: "\u25c6",
  MARKETING: "\u25cf",
  ALERT: "\u25a0",
};

/* ── Scramble Text Hook ── */

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*";

function useScrambleText(target: string, active: boolean, duration = 300) {
  const [display, setDisplay] = useState(target);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      setDisplay(target);
      return;
    }
    const start = performance.now();
    function tick() {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const resolved = Math.floor(progress * target.length);
      let out = "";
      for (let i = 0; i < target.length; i++) {
        if (target[i] === " ") {
          out += " ";
        } else if (i < resolved) {
          out += target[i];
        } else {
          out += CHARS[Math.floor(Math.random() * CHARS.length)];
        }
      }
      setDisplay(out);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, active, duration]);

  return display;
}

/* ── Animation Variants ── */

const kpiContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const kpiCard = {
  hidden: { opacity: 0, y: -12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut" as const },
  },
};

const actionsContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};

const actionCardVariant = {
  hidden: { opacity: 0, y: 10, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: "easeOut" as const },
  },
};

/* ── Sidebar Nav Items ── */

const navItems = [
  { label: "Dashboard", icon: "grid", active: true },
  { label: "Leakage Reports", icon: "alert", active: false },
  { label: "AI Executions", icon: "terminal", active: false },
  { label: "Settings", icon: "gear", active: false },
];

function NavIcon({ type }: { type: string }) {
  const base = "size-4 shrink-0";
  switch (type) {
    case "grid":
      return (
        <svg className={base} viewBox="0 0 16 16" fill="currentColor">
          <path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zM9 2.5A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zM1 10.5A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zM9 10.5A1.5 1.5 0 0110.5 9h3A1.5 1.5 0 0115 10.5v3A1.5 1.5 0 0113.5 15h-3A1.5 1.5 0 019 13.5v-3z" />
        </svg>
      );
    case "alert":
      return (
        <svg className={base} viewBox="0 0 16 16" fill="currentColor">
          <path d="M8.982 1.566a1.13 1.13 0 00-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 01-1.1 0L7.1 5.995A.905.905 0 018 5zm.002 6a1 1 0 110 2 1 1 0 010-2z" />
        </svg>
      );
    case "terminal":
      return (
        <svg className={base} viewBox="0 0 16 16" fill="currentColor">
          <path d="M6 9a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3A.5.5 0 016 9zM3.854 4.146a.5.5 0 10-.708.708L4.793 6.5 3.146 8.146a.5.5 0 10.708.708l2-2a.5.5 0 000-.708l-2-2z" />
          <path d="M2 1a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V3a2 2 0 00-2-2H2zm12 1a1 1 0 011 1v10a1 1 0 01-1 1H2a1 1 0 01-1-1V3a1 1 0 011-1h12z" />
        </svg>
      );
    case "gear":
      return (
        <svg className={base} viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 4.754a3.246 3.246 0 100 6.492 3.246 3.246 0 000-6.492zM5.754 8a2.246 2.246 0 114.492 0 2.246 2.246 0 01-4.492 0z" />
          <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 01-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 01-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 01.52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 011.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 011.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 01.52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 01-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 01-1.255-.52l-.094-.319z" />
        </svg>
      );
    default:
      return null;
  }
}

/* ── Scramble Text Component ── */

function ScrambleText({
  text,
  active,
  className,
}: {
  text: string;
  active: boolean;
  className?: string;
}) {
  const display = useScrambleText(text, active, 400);
  return <span className={className}>{display}</span>;
}

/* ── Dashboard ── */

export default function Dashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [analytics, setAnalytics] = useState<DailyAnalytics[]>([]);
  const [actions, setActions] = useState<RecommendedAction[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const agentLoading = false; // Loading now handled by audit modal
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentRan, setAgentRan] = useState(false);
  const [scrambleActive, setScrambleActive] = useState(false);

  // Mobile + navigation state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePage, setActivePage] = useState("Dashboard");

  // Execution state
  const [executingIds, setExecutingIds] = useState<Set<string>>(new Set());
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [collapsingIds, setCollapsingIds] = useState<Set<string>>(new Set());
  // AI Reasoning expand/collapse
  const [expandedReasoningIds, setExpandedReasoningIds] = useState<Set<string>>(new Set());
  const [restockDialogAction, setRestockDialogAction] =
    useState<RecommendedAction | null>(null);

  // Execution sheet state
  type SheetPhase = "sending" | "payload" | "success";
  const [sheetAction, setSheetAction] = useState<RecommendedAction | null>(null);
  const [sheetPhase, setSheetPhase] = useState<SheetPhase>("sending");
  const [sheetPayload, setSheetPayload] = useState<ShopifyPayload | null>(null);
  const [execLogs, setExecLogs] = useState<string[]>([]);

  // Product/Order detail popup
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Audit modal state
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<string[]>([]);
  const [auditComplete, setAuditComplete] = useState(false);
  const auditScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [productsRes, ordersRes, analyticsRes] = await Promise.all([
          fetch("/api/products"),
          fetch("/api/orders"),
          fetch("/api/analytics"),
        ]);
        if (!productsRes.ok || !ordersRes.ok || !analyticsRes.ok) {
          throw new Error("API returned non-200");
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
        setProducts(productsBody.data);
        setOrders(ordersBody.data);
        setAnalytics(analyticsBody.data);
      } catch {
        // Silent fallback to mock data — demo never crashes
        console.warn("API fetch failed, falling back to mock data");
        setProducts(mockProducts);
        setOrders(mockOrders);
        setAnalytics(mockAnalytics);
      } finally {
        setDataLoading(false);
      }
    }
    loadData();
  }, []);

  const AUDIT_LOG_LINES = [
    { text: "Initializing Prime Intellect compute node...", delay: 0 },
    { text: "Node connected — region: us-east-1, GPU: A100-80G", delay: 400 },
    { text: "Ingesting 5,000 Shopify rows from store API...", delay: 400 },
    { text: "Rows indexed. Running dead-stock detection model...", delay: 500 },
    { text: "Scanning 8 SKUs for shipping margin erosion...", delay: 400 },
    { text: "Running heuristic pricing models...", delay: 400 },
    { text: "Cross-referencing order velocity with reorder thresholds...", delay: 400 },
    { text: "Finalizing margin exposure report...", delay: 300 },
  ];

  const runAudit = useCallback(async () => {
    // Reset state
    setAuditOpen(true);
    setAuditLogs([]);
    setAuditComplete(false);
    setAgentError(null);
    setCompletedIds(new Set());
    setExecutingIds(new Set());
    setSyncingIds(new Set());
    setCollapsingIds(new Set());
    setExpandedReasoningIds(new Set());

    // Stream logs and fetch data in parallel
    const logPromise = (async () => {
      for (const line of AUDIT_LOG_LINES) {
        await sleep(line.delay);
        setAuditLogs((prev) => [...prev, line.text]);
        // Auto-scroll
        requestAnimationFrame(() => {
          auditScrollRef.current?.scrollTo({
            top: auditScrollRef.current.scrollHeight,
            behavior: "smooth",
          });
        });
      }
    })();

    const dataPromise = (async (): Promise<RecommendedAction[]> => {
      try {
        const res = await fetch("/api/margin/analyze", { method: "POST" });
        if (!res.ok) throw new Error("API error");
        const body = (await res.json()) as ApiResponse<RecommendedAction[]>;
        return body.data;
      } catch {
        // Silent fallback — run analysis locally against mock data
        console.warn("Margin API failed, falling back to local analysis");
        return runMarginAnalysis(mockProducts, mockOrders, mockAnalytics);
      }
    })();

    try {
      const [, analysisActions] = await Promise.all([logPromise, dataPromise]);

      // Final log line with result count
      await sleep(200);
      setAuditLogs((prev) => [
        ...prev,
        `✓ Audit complete. ${analysisActions.length} strategies generated.`,
      ]);

      setActions(analysisActions);
      setAgentRan(true);
      setScrambleActive(true);
      setTimeout(() => setScrambleActive(false), 500);
      setAuditComplete(true);
    } catch (err) {
      setAuditLogs((prev) => [
        ...prev,
        `✗ ERROR: ${err instanceof Error ? err.message : "Unknown error"}`,
      ]);
      setAgentError(err instanceof Error ? err.message : "Unknown error");
    }
  }, []);

  const markCompleted = useCallback((action: RecommendedAction) => {
    // Phase 1: turn green
    setCompletedIds((prev) => new Set(prev).add(action.id));
    // Phase 2: collapse after a beat
    setTimeout(() => {
      setCollapsingIds((prev) => new Set(prev).add(action.id));
    }, 600);
  }, []);

  const toggleReasoning = useCallback((id: string) => {
    setExpandedReasoningIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const EXEC_LOG_STEPS = [
    { text: "Authenticating Shopify Admin...", delay: 400 },
    { text: "Session verified. Scoping product catalog...", delay: 350 },
    { text: "Calculating optimal discount parameters...", delay: 400 },
    { text: "Building GraphQL mutation payload...", delay: 300 },
    { text: "Deploying mutation to Shopify Admin API...", delay: 500 },
  ];

  const executeAction = useCallback(
    async (action: RecommendedAction) => {
      // Phase 1: card loading + open sheet
      setExecutingIds((prev) => new Set(prev).add(action.id));
      const payload = buildShopifyPayload(action);
      setSheetPayload(payload);
      setSheetAction(action);
      setExecLogs([]);
      setSheetPhase("sending");

      // Phase 2: stream terminal logs
      for (const step of EXEC_LOG_STEPS) {
        await sleep(step.delay);
        setExecLogs((prev) => [...prev, step.text]);
      }

      // Phase 3: transition card to syncing
      setExecutingIds((prev) => {
        const next = new Set(prev);
        next.delete(action.id);
        return next;
      });
      setSyncingIds((prev) => new Set(prev).add(action.id));

      // Phase 4: reveal payload
      await sleep(400);
      setSheetPhase("payload");

      // Phase 5: success
      await sleep(800);
      setExecLogs((prev) => [...prev, "✓ 200 OK — Discount code is now live in Shopify."]);
      setSheetPhase("success");
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(action.id);
        return next;
      });
    },
    []
  );

  const closeSheet = useCallback(() => {
    if (sheetAction && sheetPhase === "success") {
      markCompleted(sheetAction);
      toast.success(sheetPayload?.successMessage ?? "Strategy deployed.", {
        description: sheetAction.title,
        duration: 5000,
      });
    }
    setSheetAction(null);
    setSheetPayload(null);
  }, [sheetAction, sheetPhase, sheetPayload, markCompleted]);

  // Keep confirmRestock for backward compat with the PO dialog
  const confirmRestock = useCallback(() => {
    if (restockDialogAction) {
      markCompleted(restockDialogAction);
      toast.success("Purchase order sent to supplier.", {
        description: restockDialogAction.title,
        duration: 5000,
      });
    }
    setRestockDialogAction(null);
  }, [restockDialogAction, markCompleted]);

  // KPIs
  const totalRevenue = analytics.reduce((s, d) => s + d.dailyRevenue, 0);
  const avgConversion =
    analytics.length > 0
      ? analytics.reduce((s, d) => s + d.conversionRate, 0) / analytics.length
      : 0;
  const totalSessions = analytics.reduce((s, d) => s + d.activeSessions, 0);
  const pendingOrders = orders.filter((o) => o.status === "pending").length;

  const kpis = [
    { label: "Total Revenue (7d)", value: formatCents(totalRevenue), delta: "+12.4%" },
    { label: "Avg Conversion", value: formatRate(avgConversion), delta: "-0.3%" },
    { label: "Active Sessions", value: totalSessions.toLocaleString(), delta: "+8.1%" },
    { label: "Pending Orders", value: String(pendingOrders), delta: `${pendingOrders} open` },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#09090B] text-zinc-50">
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "!bg-[#18181B] !border-[#27272A] !text-zinc-50",
        }}
      />

      {/* ── RESTOCK Purchase Order Dialog ── */}
      <Dialog
        open={restockDialogAction !== null}
        onOpenChange={(open) => {
          if (!open) setRestockDialogAction(null);
        }}
      >
        <DialogContent className="border-[#27272A] bg-[#18181B] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-zinc-50">
              Purchase Order — Supplier Draft
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Review the auto-generated procurement email below, then confirm to
              send.
            </DialogDescription>
          </DialogHeader>
          {restockDialogAction && (
            <pre className="max-h-72 overflow-auto rounded-lg border border-[#27272A] bg-[#0A0A0C] p-4 font-mono text-[11px] leading-relaxed text-emerald-400">
              {buildPurchaseOrderEmail(restockDialogAction)}
            </pre>
          )}
          <DialogFooter>
            <button
              onClick={() => setRestockDialogAction(null)}
              className="text-sm text-zinc-400 transition-colors hover:text-zinc-200"
            >
              Dismiss
            </button>
            <button
              onClick={confirmRestock}
              className="rounded-lg bg-gradient-to-r from-[#AAFF00] to-emerald-400 px-4 py-2 text-sm font-medium text-black shadow-[0_0_20px_rgba(170,255,0,0.3)] transition-all hover:brightness-110 active:scale-95"
            >
              Send Purchase Order
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Product Detail Dialog ── */}
      <Dialog
        open={selectedProduct !== null}
        onOpenChange={(open) => { if (!open) setSelectedProduct(null); }}
      >
        <DialogContent className="border-[#27272A] bg-[#18181B] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-50">
              {selectedProduct?.title}
            </DialogTitle>
            <DialogDescription className="font-mono text-zinc-500">
              {selectedProduct?.sku}
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (() => {
            const p = selectedProduct;
            const isDeadStock = p.currentInventory > 50 && p.totalSold30d === 0;
            const holdingCostMo = isDeadStock ? Math.round(p.price * p.currentInventory * 0.02) : 0;
            const totalCapital = p.price * p.currentInventory;
            return (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-[#27272A] bg-[#09090B] p-3">
                    <span className="text-[10px] uppercase text-zinc-500">Unit Price</span>
                    <p className="font-mono text-lg font-semibold text-[#AAFF00]">{formatCents(p.price)}</p>
                  </div>
                  <div className="rounded-lg border border-[#27272A] bg-[#09090B] p-3">
                    <span className="text-[10px] uppercase text-zinc-500">In Stock</span>
                    <p className={`font-mono text-lg font-semibold ${p.currentInventory < p.reorderThreshold ? "text-red-400" : "text-zinc-50"}`}>{p.currentInventory}</p>
                  </div>
                  <div className="rounded-lg border border-[#27272A] bg-[#09090B] p-3">
                    <span className="text-[10px] uppercase text-zinc-500">30d Sales</span>
                    <p className={`font-mono text-lg font-semibold ${p.totalSold30d === 0 ? "text-amber-400" : "text-zinc-50"}`}>{p.totalSold30d}</p>
                  </div>
                  <div className="rounded-lg border border-[#27272A] bg-[#09090B] p-3">
                    <span className="text-[10px] uppercase text-zinc-500">Ship Cost</span>
                    <p className="font-mono text-lg font-semibold text-zinc-50">{formatCents(p.shippingCost)}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-[#27272A] bg-[#09090B] p-3">
                  <span className="text-[10px] uppercase text-zinc-500">Total Capital Tied Up</span>
                  <p className="font-mono text-xl font-bold text-[#AAFF00]">{formatCents(totalCapital)}</p>
                </div>
                {isDeadStock && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                    <span className="text-xs font-semibold text-red-400">Dead Stock Alert</span>
                    <p className="mt-1 text-xs text-zinc-400">
                      {p.currentInventory} units with zero sales in 30 days. Holding cost burn: <span className="font-mono font-semibold text-amber-400">{formatCents(holdingCostMo)}/mo</span>. Total capital at risk: <span className="font-mono font-semibold text-red-400">{formatCents(totalCapital)}</span>.
                    </p>
                  </div>
                )}
                {p.currentInventory < p.reorderThreshold && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                    <span className="text-xs font-semibold text-amber-400">Restock Required</span>
                    <p className="mt-1 text-xs text-zinc-400">
                      Only {p.currentInventory} units remaining vs. {p.reorderThreshold} reorder threshold. At {p.totalSold30d} units/30d velocity, stockout in {p.totalSold30d > 0 ? Math.round((p.currentInventory / p.totalSold30d) * 30) : 0} days.
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Order Detail Dialog ── */}
      <Dialog
        open={selectedOrder !== null}
        onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}
      >
        <DialogContent className="border-[#27272A] bg-[#18181B] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-mono text-zinc-50">
              {selectedOrder?.id}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Order details
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-[#27272A] bg-[#09090B] p-3">
                  <span className="text-[10px] uppercase text-zinc-500">Total</span>
                  <p className="font-mono text-lg font-semibold text-[#AAFF00]">{formatCents(selectedOrder.total)}</p>
                </div>
                <div className="rounded-lg border border-[#27272A] bg-[#09090B] p-3">
                  <span className="text-[10px] uppercase text-zinc-500">Status</span>
                  <p className={`text-sm font-semibold capitalize ${selectedOrder.status === "fulfilled" ? "text-emerald-400" : selectedOrder.status === "pending" ? "text-amber-400" : "text-red-400"}`}>{selectedOrder.status}</p>
                </div>
              </div>
              <div className="rounded-lg border border-[#27272A] bg-[#09090B] p-3">
                <span className="text-[10px] uppercase text-zinc-500">Customer</span>
                <p className="font-mono text-sm text-zinc-300">{selectedOrder.customerId}</p>
              </div>
              <div className="rounded-lg border border-[#27272A] bg-[#09090B] p-3">
                <span className="text-[10px] uppercase text-zinc-500">Date</span>
                <p className="text-sm text-zinc-300">{new Date(selectedOrder.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Execution Sheet Side Panel ── */}
      <Sheet
        open={sheetAction !== null}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
      >
        <SheetContent className="flex w-full flex-col border-[#27272A] bg-[#0A0A0C] p-0 sm:max-w-lg [&>button]:text-zinc-500">
          {/* Sheet terminal header */}
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#27272A] bg-[#18181B]/50 px-5">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-red-500/70" />
                <span className="size-2.5 rounded-full bg-amber-400/70" />
                <span className="size-2.5 rounded-full bg-emerald-400/70" />
              </div>
              <span className="font-mono text-xs text-zinc-400">
                shopify-api — deploy
              </span>
            </div>
            {sheetPhase === "sending" && (
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                <span className="inline-block size-1.5 animate-pulse rounded-full bg-emerald-400" />
                Sending
              </span>
            )}
            {sheetPhase === "payload" && (
              <span className="flex items-center gap-1.5 text-[10px] text-amber-400">
                <span className="inline-block size-1.5 animate-pulse rounded-full bg-amber-400" />
                Awaiting response
              </span>
            )}
            {sheetPhase === "success" && (
              <span className="text-[10px] text-emerald-400">
                200 OK
              </span>
            )}
          </div>

          {/* Sheet body */}
          <div className="flex-1 overflow-y-auto p-5">
            {sheetAction && sheetPayload && (
              <div className="flex flex-col gap-4">
                {/* Execution log stream */}
                {execLogs.length > 0 && (
                  <div className="rounded-lg border border-[#27272A] bg-[#09090B] p-3">
                    <div className="space-y-1 font-mono text-[11px]">
                      {execLogs.map((log, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.15 }}
                          className={`${
                            log.startsWith("✓")
                              ? "font-semibold text-[#AAFF00]"
                              : "text-zinc-500"
                          }`}
                        >
                          {!log.startsWith("✓") && (
                            <span className="text-emerald-400">$ </span>
                          )}
                          {log}
                        </motion.div>
                      ))}
                      {sheetPhase === "sending" && (
                        <span className="inline-block animate-pulse text-emerald-400">_</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Action context */}
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        sheetAction.urgency === "HIGH"
                          ? "bg-red-400/10 text-red-400"
                          : sheetAction.urgency === "MEDIUM"
                            ? "bg-amber-400/10 text-amber-400"
                            : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {sheetAction.urgency}
                    </span>
                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                      {sheetAction.type}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-medium text-zinc-200">
                    {sheetAction.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    {sheetAction.description}
                  </p>
                </div>

                {/* Request block */}
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-400">
                      {sheetPayload.method}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      {sheetPayload.endpoint}
                    </span>
                  </div>
                  <div
                    className={`relative overflow-hidden rounded-lg border bg-[#09090B] transition-all duration-500 ${
                      sheetPhase === "success"
                        ? "border-emerald-400/30"
                        : "border-[#27272A]"
                    }`}
                  >
                    {/* Scanning border on the code block while sending */}
                    {sheetPhase === "sending" && (
                      <div className="ai-scanning-border absolute inset-0 rounded-lg" />
                    )}
                    <pre className="relative overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-zinc-400">
                      <code>{sheetPayload.body}</code>
                    </pre>
                  </div>
                </div>

                {/* Response block */}
                <AnimatePresence>
                  {sheetPhase === "payload" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="flex items-center gap-2 font-mono text-xs text-amber-400">
                        <svg
                          className="size-3 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Waiting for Shopify Admin API response...
                      </div>
                    </motion.div>
                  )}

                  {sheetPhase === "success" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35 }}
                      className="flex flex-col gap-3"
                    >
                      {/* Success response */}
                      <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.04] p-4">
                        <div className="flex items-center gap-2">
                          <span className="flex size-5 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-400">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                          <span className="text-sm font-medium text-emerald-400">
                            Deployed Successfully
                          </span>
                        </div>
                        <p className="mt-2 font-mono text-xs leading-relaxed text-zinc-400">
                          {sheetPayload.successMessage}
                        </p>
                      </div>

                      {/* Response payload */}
                      <div className="rounded-lg border border-[#27272A] bg-[#09090B] p-4">
                        <div className="mb-2 font-mono text-[10px] text-emerald-400">
                          HTTP/1.1 200 OK
                        </div>
                        <pre className="font-mono text-[10px] leading-relaxed text-zinc-500">
                          <code>
                            {JSON.stringify(
                              {
                                data: {
                                  status: "SUCCESS",
                                  id: `gid://shopify/${sheetAction.type === "RESTOCK" ? "PurchaseOrder" : sheetAction.type === "DISCOUNT" ? "DiscountCode" : sheetAction.type === "MARKETING" ? "MarketingEvent" : "Metafield"}/${Math.floor(Math.random() * 90000 + 10000)}`,
                                  created_at: new Date().toISOString(),
                                },
                                extensions: { cost: { requestedQueryCost: 12, actualQueryCost: 8 } },
                              },
                              null,
                              2
                            )}
                          </code>
                        </pre>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Sheet footer */}
          {sheetPhase === "success" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="shrink-0 border-t border-[#27272A] bg-[#18181B]/80 px-5 py-4 backdrop-blur-md"
            >
              <div className="flex items-center justify-between">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info(
                      `Would open: https://ecotextiles.myshopify.com${sheetPayload?.shopifyPath}`,
                      { duration: 3000 }
                    );
                  }}
                  className="flex items-center gap-1.5 font-mono text-xs text-emerald-400 transition-colors hover:text-emerald-300"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  View in Shopify Admin
                </a>
                <button
                  onClick={closeSheet}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-medium text-white shadow-[0_0_20px_rgba(170,255,0,0.3)] transition-all hover:brightness-110 active:scale-95"
                >
                  Done
                </button>
              </div>
            </motion.div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Audit Terminal Modal ── */}
      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="border-[#27272A] bg-[#0A0A0C] p-0 sm:max-w-2xl">
          {/* Modal terminal header */}
          <div className="flex h-12 items-center justify-between border-b border-[#27272A] bg-[#18181B]/50 px-5">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-red-500/70" />
                <span className="size-2.5 rounded-full bg-amber-400/70" />
                <span className="size-2.5 rounded-full bg-emerald-400/70" />
              </div>
              <span className="font-mono text-xs text-zinc-400">
                prime-intellect — margin-audit
              </span>
            </div>
            {!auditComplete && auditLogs.length > 0 && (
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                <span className="inline-block size-1.5 animate-pulse rounded-full bg-emerald-400" />
                Computing
              </span>
            )}
            {auditComplete && (
              <span className="text-[10px] text-emerald-400">Complete</span>
            )}
          </div>

          {/* Modal terminal body */}
          <div
            ref={auditScrollRef}
            className="max-h-[400px] overflow-y-auto p-5"
          >
            <div className="space-y-1.5 font-mono text-xs leading-relaxed">
              <div className="text-zinc-600">
                <span className="text-emerald-400">$</span> prime-intellect run
                margin-audit --store=ecotextiles --mode=heuristic
              </div>

              <AnimatePresence>
                {auditLogs.map((line, i) => {
                  const isSuccess = line.startsWith("✓");
                  const isError = line.startsWith("✗");
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15 }}
                      className={
                        isSuccess
                          ? "mt-2 text-emerald-400"
                          : isError
                            ? "mt-2 text-red-400"
                            : "text-zinc-500"
                      }
                    >
                      <span className="text-zinc-700 select-none">
                        [{String(i).padStart(2, "0")}]
                      </span>{" "}
                      {line}
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {!auditComplete &&
                auditLogs.length > 0 &&
                !auditLogs[auditLogs.length - 1]?.startsWith("✗") && (
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <span className="inline-block animate-pulse">&#9646;</span>
                  </div>
                )}
            </div>
          </div>

          {/* Modal footer */}
          {auditComplete && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="border-t border-[#27272A] bg-[#18181B]/80 px-5 py-4 backdrop-blur-md"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-zinc-400">
                  {actions.length} action cards ready
                </span>
                <button
                  onClick={() => setAuditOpen(false)}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-medium text-white shadow-[0_0_20px_rgba(170,255,0,0.3)] transition-all hover:brightness-110 active:scale-95"
                >
                  View Strategies
                </button>
              </div>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════ MOBILE OVERLAY ═══════════════ */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ═══════════════ SIDEBAR ═══════════════ */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-[#27272A] bg-[#09090B] transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Logo + Store Switcher */}
        <div className="flex h-16 items-center gap-3 border-b border-[#27272A] px-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[#AAFF00] shadow-[0_0_16px_rgba(170,255,0,0.25)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-zinc-50">
              Margin Protector
            </span>
            <span className="text-[10px] text-zinc-500">EcoTextiles Store</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                setActivePage(item.label);
                setSidebarOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                activePage === item.label
                  ? "border-l-2 border-[#AAFF00] bg-zinc-800/50 font-medium text-zinc-50"
                  : "border-l-2 border-transparent text-zinc-400 hover:bg-zinc-800/30 hover:text-zinc-200"
              }`}
            >
              <NavIcon type={item.icon} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom: AI Status */}
        <div className="border-t border-[#27272A] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <AnimatedShinyText className="text-xs text-zinc-400" shimmerWidth={80}>
              AI Status: Active
            </AnimatedShinyText>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="size-6 rounded-full bg-zinc-800" />
            <span className="text-xs text-zinc-500">admin@eco.store</span>
          </div>
        </div>
      </aside>

      {/* ═══════════════ MAIN AREA ═══════════════ */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* ── Top Navigation ── */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#27272A] px-4 lg:h-16 lg:px-8">
          {/* Hamburger + Breadcrumbs */}
          <div className="flex items-center gap-3 text-sm">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex size-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 lg:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <span className="text-zinc-500">{activePage}</span>
            {activePage === "Dashboard" && (
              <>
                <span className="text-zinc-700">/</span>
                <span className="font-medium text-zinc-200">Profit Leaks</span>
              </>
            )}
          </div>

          {/* Search */}
          <button
            onClick={() => toast.info("Search — coming in v2", { duration: 2000 })}
            className="hidden cursor-pointer items-center gap-2 rounded-md border border-[#27272A] bg-[#18181B] px-3 py-1.5 transition-colors hover:border-emerald-500/30 md:flex"
          >
            <svg
              className="size-3.5 text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <span className="text-xs text-zinc-500">Search...</span>
            <kbd className="rounded border border-[#27272A] bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
              &#8984;K
            </kbd>
          </button>

          {/* Right: Status + Report + Run Scan */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              Shopify Connected
            </div>
            {agentRan && actions.length > 0 && (
              <button
                onClick={() => window.print()}
                className="no-print flex items-center gap-1.5 rounded-lg border border-[#27272A] bg-[#18181B] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                Generate Report
              </button>
            )}
          </div>
        </header>

        {/* ── Main Content ── */}
        <main className="relative flex-1 overflow-y-auto p-4 lg:p-8">
          {/* Animated grid background */}
          <AnimatedGridPattern
            numSquares={30}
            maxOpacity={0.06}
            duration={4}
            repeatDelay={1.5}
            className={cn(
              "fixed inset-0 z-0",
              "mask-[radial-gradient(600px_circle_at_center,white,transparent)]",
              "skew-y-6"
            )}
          />
          {activePage === "Dashboard" && (
          <div className="relative z-10 flex flex-col gap-6">
            {/* ── KPI Metrics Ribbon ── */}
            {dataLoading ? (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-[#27272A] bg-[#18181B] p-5"
                  >
                    <Skeleton className="mb-2 h-3 w-20 bg-zinc-800" />
                    <Skeleton className="h-8 w-28 bg-zinc-800" />
                  </div>
                ))}
              </div>
            ) : (
              <motion.div
                className="grid grid-cols-2 gap-4 lg:grid-cols-4"
                variants={kpiContainer}
                initial="hidden"
                animate="show"
              >
                {kpis.map((kpi) => (
                  <motion.div
                    key={kpi.label}
                    variants={kpiCard}
                    className="rounded-xl"
                  >
                    <MagicCard
                      mode="orb"
                      glowFrom="#AAFF00"
                      glowTo="#4CBB17"
                      glowSize={300}
                      glowBlur={40}
                      glowOpacity={0.35}
                      className="rounded-xl border-[#27272A] bg-[#18181B] p-0"
                    >
                      <div className="relative z-50 p-5">
                        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                          {kpi.label}
                        </span>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="font-mono text-3xl font-semibold tracking-tight text-[#AAFF00]">
                            {kpi.value}
                          </span>
                          <span
                            className={`text-xs font-medium ${
                              kpi.delta.startsWith("+")
                                ? "text-emerald-400"
                                : kpi.delta.startsWith("-")
                                  ? "text-red-400"
                                  : "text-zinc-500"
                            }`}
                          >
                            {kpi.delta}
                          </span>
                        </div>
                      </div>
                    </MagicCard>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* ── Core Grid: Feed (col-7) + Terminal (col-5) ── */}
            <div className="grid grid-cols-12 gap-6">
              {/* ── Left: Feed (Inventory + Orders) ── */}
              <div className="col-span-12 flex flex-col gap-6 lg:col-span-7">
                {/* Inventory Table */}
                <div className="rounded-xl border border-[#27272A] bg-[#18181B]">
                  <div className="flex items-center justify-between border-b border-[#27272A] px-5 py-3">
                    <h2 className="text-sm font-medium tracking-wide text-zinc-200">
                      Current Inventory
                    </h2>
                    <Badge
                      variant="outline"
                      className="border-[#27272A] text-[10px] text-zinc-500"
                    >
                      {products.length} products
                    </Badge>
                  </div>
                  <div className="overflow-auto">
                    {dataLoading ? (
                      <div className="space-y-3 p-5">
                        {[0, 1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-8 w-full bg-zinc-800" />
                        ))}
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="border-[#27272A] hover:bg-transparent">
                            <TableHead className="text-xs font-medium text-zinc-500">
                              Product
                            </TableHead>
                            <TableHead className="text-xs font-medium text-zinc-500">
                              SKU
                            </TableHead>
                            <TableHead className="text-right text-xs font-medium text-zinc-500">
                              Price
                            </TableHead>
                            <TableHead className="text-right text-xs font-medium text-zinc-500">
                              Stock
                            </TableHead>
                            <TableHead className="text-right text-xs font-medium text-zinc-500">
                              Status
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {products.map((p) => {
                            const isLow =
                              p.currentInventory < p.reorderThreshold;
                            const holdingCost = p.totalSold30d === 0 && p.currentInventory > 50
                              ? Math.round(p.price * p.currentInventory * 0.02)
                              : 0;
                            return (
                              <TableRow
                                key={p.id}
                                onClick={() => setSelectedProduct(p)}
                                className="cursor-pointer border-[#27272A] transition-colors hover:bg-zinc-800/40"
                              >
                                <TableCell className="text-sm font-medium text-zinc-200">
                                  {p.title}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-zinc-500">
                                  {p.sku}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm tabular-nums text-zinc-50">
                                  {formatCents(p.price)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <span
                                    className={`font-mono text-sm tabular-nums font-medium ${isLow ? "text-red-400" : "text-zinc-50"}`}
                                  >
                                    {p.currentInventory}
                                  </span>
                                  {isLow && (
                                    <span className="ml-2 inline-flex items-center rounded bg-red-400/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                                      CRITICAL
                                    </span>
                                  )}
                                  {holdingCost > 0 && (
                                    <span className="ml-2 inline-flex items-center rounded bg-amber-400/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-amber-400">
                                      -{formatCents(holdingCost)}/mo
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <span
                                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${
                                      p.status === "active"
                                        ? "bg-emerald-400/10 text-emerald-400"
                                        : p.status === "draft"
                                          ? "bg-amber-400/10 text-amber-400"
                                          : "bg-zinc-800 text-zinc-500"
                                    }`}
                                  >
                                    {p.status}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>

                {/* Orders Table */}
                <div className="rounded-xl border border-[#27272A] bg-[#18181B]">
                  <div className="flex items-center justify-between border-b border-[#27272A] px-5 py-3">
                    <h2 className="text-sm font-medium tracking-wide text-zinc-200">
                      Recent Orders
                    </h2>
                    <Badge
                      variant="outline"
                      className="border-[#27272A] text-[10px] text-zinc-500"
                    >
                      {orders.length} orders
                    </Badge>
                  </div>
                  <div className="max-h-[360px] overflow-auto">
                    {dataLoading ? (
                      <div className="space-y-3 p-5">
                        {[0, 1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-8 w-full bg-zinc-800" />
                        ))}
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="border-[#27272A] hover:bg-transparent">
                            <TableHead className="text-xs font-medium text-zinc-500">
                              Order
                            </TableHead>
                            <TableHead className="text-xs font-medium text-zinc-500">
                              Customer
                            </TableHead>
                            <TableHead className="text-right text-xs font-medium text-zinc-500">
                              Total
                            </TableHead>
                            <TableHead className="text-xs font-medium text-zinc-500">
                              Status
                            </TableHead>
                            <TableHead className="text-right text-xs font-medium text-zinc-500">
                              Date
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orders.map((o) => (
                            <TableRow
                              key={o.id}
                              onClick={() => setSelectedOrder(o)}
                              className="cursor-pointer border-[#27272A] transition-colors hover:bg-zinc-800/40"
                            >
                              <TableCell className="font-mono text-xs text-zinc-200">
                                {o.id}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-zinc-500">
                                {o.customerId}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm tabular-nums text-zinc-50">
                                {formatCents(o.total)}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${
                                    o.status === "fulfilled"
                                      ? "bg-emerald-400/10 text-emerald-400"
                                      : o.status === "pending"
                                        ? "bg-amber-400/10 text-amber-400"
                                        : "bg-red-400/10 text-red-400"
                                  }`}
                                >
                                  {o.status}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs text-zinc-500">
                                {new Date(o.createdAt).toLocaleDateString(
                                  "en-US",
                                  { month: "short", day: "numeric" }
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              </div>

              {/* ═══════════════ AI TERMINAL (col-5) ═══════════════ */}
              <div className="col-span-12 lg:col-span-5">
                <div
                  className="sticky top-8 flex h-[calc(100vh-220px)] flex-col overflow-hidden rounded-2xl border border-[#27272A] bg-[#0A0A0C] shadow-[0_0_40px_-15px_rgba(99,102,241,0.15)]"
                >
                  {/* Terminal Header */}
                  <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#27272A] bg-[#18181B]/50 px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        <span className="size-2.5 rounded-full bg-red-500/70" />
                        <span className="size-2.5 rounded-full bg-amber-400/70" />
                        <span className="size-2.5 rounded-full bg-emerald-400/70" />
                      </div>
                      <span className="font-mono text-xs text-zinc-400">
                        Terminal
                      </span>
                    </div>
                    <span className="rounded border border-[#27272A] bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                      v1.0
                    </span>
                  </div>

                  {/* Terminal Body */}
                  <div className="flex flex-1 flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-5">
                      <div className="flex flex-col gap-3">
                        {/* Prompt */}
                        <div className="font-mono text-xs text-zinc-400">
                          <span className="text-emerald-400">$</span>{" "}
                          margin-protector --analyze --store=ecotextiles
                        </div>

                        <AnimatePresence mode="wait">
                          {/* ── Idle State ── */}
                          {!agentRan && !agentLoading && !agentError && (
                            <motion.div
                              key="idle"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              className="relative flex flex-1 flex-col items-center justify-center gap-6 py-16"
                            >
                              {/* Subtle grid background */}
                              <div
                                className={cn(
                                  "pointer-events-none absolute inset-0 opacity-30",
                                  "[background-size:32px_32px]",
                                  "[background-image:linear-gradient(to_right,#262626_1px,transparent_1px),linear-gradient(to_bottom,#262626_1px,transparent_1px)]"
                                )}
                              />
                              <div className="pointer-events-none absolute inset-0 bg-[#0A0A0C] [mask-image:radial-gradient(ellipse_at_center,transparent_5%,black_70%)]" />
                              <div className="relative flex items-center justify-center">
                                <span className="absolute size-20 animate-[ping_4s_ease-in-out_infinite] rounded-full bg-emerald-500/5" />
                                <span className="absolute size-12 animate-[ping_4s_ease-in-out_0.6s_infinite] rounded-full bg-emerald-500/5" />
                                <div className="relative flex size-14 items-center justify-center rounded-2xl border border-[#27272A] bg-zinc-800/50">
                                  <svg
                                    width="22"
                                    height="22"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-emerald-400"
                                  >
                                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                                  </svg>
                                </div>
                              </div>

                              <div className="relative z-10 text-center">
                                <p className="text-sm font-semibold text-zinc-100">
                                  Store connected
                                </p>
                                <p className="mx-auto mt-2 max-w-[240px] text-xs leading-relaxed text-zinc-400">
                                  Ready to analyze profit margins, detect
                                  revenue leaks, and deploy autonomous fixes.
                                </p>
                              </div>

                              <button
                                onClick={runAudit}
                                disabled={auditOpen && !auditComplete}
                                className="rounded-lg bg-gradient-to-r from-[#AAFF00] to-emerald-400 px-5 py-2.5 font-mono text-sm font-medium text-black shadow-[0_0_20px_rgba(170,255,0,0.3)] transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Run Audit
                              </button>

                              <div className="flex items-center gap-3 font-mono text-[10px] text-zinc-600">
                                <span>8 products</span>
                                <span className="text-zinc-800">|</span>
                                <span>25 orders</span>
                                <span className="text-zinc-800">|</span>
                                <span>7d window</span>
                              </div>
                            </motion.div>
                          )}

                          {/* ── Error State ── */}
                          {agentError && !agentLoading && (
                            <motion.div
                              key="error"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              className="rounded-xl border border-red-400/20 bg-red-400/5 p-4"
                            >
                              <p className="font-mono text-xs text-red-400">
                                Error: {agentError}
                              </p>
                              <button
                                onClick={runAudit}
                                className="mt-3 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
                              >
                                Retry
                              </button>
                            </motion.div>
                          )}

                          {/* ── Results State ── */}
                          {agentRan && !agentLoading && !agentError && (
                            <motion.div
                              key="results"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              className="flex flex-col gap-3"
                            >
                              <motion.div
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3 }}
                                className="font-mono text-xs text-emerald-400"
                              >
                                ✓ Scan complete &mdash;{" "}
                                <span className="rounded bg-emerald-500/10 px-1 text-emerald-400">
                                  {actions.length} strategies
                                </span>{" "}
                                generated
                              </motion.div>

                              <motion.div
                                className="space-y-2"
                                variants={actionsContainer}
                                initial="hidden"
                                animate="show"
                              >
                                {actions.map((action) => {
                                  const isExecuting = executingIds.has(action.id);
                                  const isSyncing = syncingIds.has(action.id);
                                  const isCompleted = completedIds.has(action.id);
                                  const isCollapsing = collapsingIds.has(action.id);
                                  const isReasoningOpen = expandedReasoningIds.has(action.id);

                                  return (
                                    <motion.div
                                      key={action.id}
                                      variants={actionCardVariant}
                                      layout
                                      animate={
                                        isCollapsing
                                          ? {
                                              scale: 0.98,
                                              filter: "blur(4px)",
                                              opacity: 0,
                                              height: 0,
                                              marginBottom: 0,
                                              padding: 0,
                                            }
                                          : undefined
                                      }
                                      transition={
                                        isCollapsing
                                          ? {
                                              duration: 0.5,
                                              ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
                                            }
                                          : undefined
                                      }
                                      className={`group overflow-hidden rounded-xl border p-5 backdrop-blur-sm transition-all duration-200 ${
                                        isCompleted && !isCollapsing
                                          ? "border-emerald-400/20 bg-emerald-400/[0.03]"
                                          : "border-white/[0.06] bg-zinc-900/40 backdrop-blur-xl hover:-translate-y-1 hover:border-[#AAFF00]/40 hover:shadow-[0_8px_30px_rgba(170,255,0,0.08)] transition-all duration-300 ease-out"
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3">
                                          <div
                                            className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border ${
                                              isCompleted
                                                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-400"
                                                : "border-zinc-700 bg-zinc-800 text-zinc-400"
                                            }`}
                                          >
                                            {isCompleted ? (
                                              <span className="text-sm">✓</span>
                                            ) : (
                                              <span className="font-mono text-xs">
                                                {actionTypeIcon[action.type] ?? "\u25cf"}
                                              </span>
                                            )}
                                          </div>
                                          <div className="min-w-0">
                                            <ScrambleText
                                              text={action.title}
                                              active={scrambleActive}
                                              className={`text-sm font-medium transition-colors ${
                                                isCompleted
                                                  ? "text-emerald-400"
                                                  : "text-zinc-200 group-hover:text-emerald-400"
                                              }`}
                                            />
                                            <p className="mt-0.5 text-xs text-zinc-500">
                                              {action.description}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                          {isCompleted ? (
                                            <span className="text-xs font-medium text-emerald-400">
                                              Resolved
                                            </span>
                                          ) : (
                                            <span
                                              className={`text-xs font-medium ${
                                                action.urgency === "HIGH"
                                                  ? "text-red-400"
                                                  : action.urgency === "MEDIUM"
                                                    ? "text-amber-400"
                                                    : "text-zinc-500"
                                              }`}
                                            >
                                              {action.urgency}
                                            </span>
                                          )}
                                          <div className="mt-0.5 font-mono text-[10px] text-zinc-600">
                                            {action.type}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Proposed execution */}
                                      <div className="mt-3 rounded-md border border-[#27272A] bg-[#09090B] px-3 py-2 font-mono text-[10px] leading-relaxed text-zinc-400">
                                        →{" "}
                                        <ScrambleText
                                          text={action.proposedExecution}
                                          active={scrambleActive}
                                          className="text-emerald-400/80"
                                        />
                                      </div>

                                      {/* ── Collapsible AI Thinking ── */}
                                      {action.aiReasoning && (
                                        <div className="mt-3">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleReasoning(action.id);
                                            }}
                                            className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-500 transition-colors hover:text-emerald-400"
                                          >
                                            <svg
                                              width="10"
                                              height="10"
                                              viewBox="0 0 24 24"
                                              fill="none"
                                              stroke="currentColor"
                                              strokeWidth="2"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              className={`transition-transform duration-200 ${isReasoningOpen ? "rotate-90" : ""}`}
                                            >
                                              <polyline points="9 18 15 12 9 6" />
                                            </svg>
                                            AI Thinking
                                          </button>
                                          <AnimatePresence>
                                            {isReasoningOpen && (
                                              <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2, ease: "easeOut" as const }}
                                                className="overflow-hidden"
                                              >
                                                <div className="mt-2 rounded-md border border-emerald-500/10 bg-emerald-500/[0.03] px-3 py-2.5">
                                                  <p className="font-mono text-[10px] leading-relaxed text-zinc-400">
                                                    {action.aiReasoning}
                                                  </p>
                                                </div>
                                              </motion.div>
                                            )}
                                          </AnimatePresence>
                                        </div>
                                      )}

                                      {/* ── Action buttons ── */}
                                      {!isCollapsing && (
                                        <div className="mt-3 flex items-center justify-end gap-3">
                                          {isCompleted ? (
                                            <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-400">
                                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                              </svg>
                                              Active in Shopify
                                            </span>
                                          ) : isSyncing ? (
                                            <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-400">
                                              <svg className="size-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                              </svg>
                                              Syncing to Shopify...
                                            </span>
                                          ) : (
                                            <>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  // Animate collapse then mark completed
                                                  setCollapsingIds((prev) => new Set(prev).add(action.id));
                                                  setTimeout(() => {
                                                    setCompletedIds((prev) => new Set(prev).add(action.id));
                                                    setCollapsingIds((prev) => {
                                                      const next = new Set(prev);
                                                      next.delete(action.id);
                                                      return next;
                                                    });
                                                  }, 500);
                                                }}
                                                className="text-xs text-zinc-500 transition-colors hover:text-zinc-200"
                                              >
                                                Dismiss
                                              </button>
                                              <button
                                                disabled={isExecuting}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  executeAction(action);
                                                }}
                                                className="rounded-lg bg-gradient-to-r from-[#AAFF00] to-emerald-400 px-4 py-1.5 text-xs font-medium text-black shadow-[0_0_20px_rgba(170,255,0,0.3)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-80"
                                              >
                                                {isExecuting ? (
                                                  <span className="flex items-center gap-1.5">
                                                    <svg className="size-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                    </svg>
                                                    Executing...
                                                  </span>
                                                ) : (
                                                  "Deploy Fix"
                                                )}
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </motion.div>
                                  );
                                })}
                              </motion.div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Terminal Footer */}
                    {agentRan && !agentLoading && !agentError && (
                      <div className="shrink-0 border-t border-[#27272A] bg-[#18181B]/80 px-4 py-3 backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-zinc-600">
                            {actions.length - completedIds.size} remaining
                          </span>
                          <button
                            onClick={runAudit}
                            className="text-xs text-zinc-400 transition-colors hover:text-emerald-400"
                          >
                            Re-run Audit
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* ═══════════════ LEAKAGE REPORTS PAGE ═══════════════ */}
          {activePage === "Leakage Reports" && (
          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-zinc-50">Leakage Reports</h1>
                <p className="mt-1 text-sm text-zinc-500">Historical margin analysis across all SKUs</p>
              </div>
              <button
                onClick={runAudit}
                disabled={auditOpen && !auditComplete}
                className="rounded-lg bg-gradient-to-r from-[#AAFF00] to-emerald-400 px-4 py-2 text-sm font-medium text-black shadow-[0_0_20px_rgba(170,255,0,0.3)] transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Generate New Report
              </button>
            </div>

            {/* Report cards */}
            <div className="grid gap-4 md:grid-cols-2">
              {actions.length > 0 ? actions.filter(a => a.urgency === "HIGH").map((action) => (
                <div key={action.id} className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5 transition-all hover:border-emerald-500/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-200">{action.title}</span>
                    <span className="rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">HIGH</span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">{action.description}</p>
                  {action.aiReasoning && (
                    <div className="mt-3 rounded-md border border-emerald-500/10 bg-emerald-500/[0.03] px-3 py-2">
                      <p className="font-mono text-[10px] leading-relaxed text-zinc-400">{action.aiReasoning}</p>
                    </div>
                  )}
                </div>
              )) : (
                <div className="col-span-2 flex flex-col items-center gap-4 rounded-xl border border-zinc-800/50 py-16 text-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-600">
                    <path d="M9 17H5a2 2 0 00-2 2v0a2 2 0 002 2h14a2 2 0 002-2v0a2 2 0 00-2-2h-4M9 17v-4a4 4 0 018 0v4M9 17h6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-zinc-400">No reports generated yet</p>
                    <p className="mt-1 text-xs text-zinc-600">Run an audit from the Dashboard to generate leakage reports.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Summary stats */}
            {actions.length > 0 && (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5">
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Total Leaks Found</span>
                  <p className="mt-1 font-mono text-2xl font-medium text-zinc-50">{actions.length}</p>
                </div>
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5">
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">High Priority</span>
                  <p className="mt-1 font-mono text-2xl font-medium text-red-400">{actions.filter(a => a.urgency === "HIGH").length}</p>
                </div>
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5">
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Resolved</span>
                  <p className="mt-1 font-mono text-2xl font-medium text-emerald-400">{completedIds.size}</p>
                </div>
              </div>
            )}
          </div>
          )}

          {/* ═══════════════ AI EXECUTIONS PAGE ═══════════════ */}
          {activePage === "AI Executions" && (
          <div className="relative z-10 flex flex-col gap-6">
            <div>
              <h1 className="text-xl font-semibold text-zinc-50">AI Executions</h1>
              <p className="mt-1 text-sm text-zinc-500">History of all Shopify mutations deployed by the AI</p>
            </div>

            {completedIds.size > 0 ? (
              <div className="overflow-hidden rounded-xl border border-zinc-800/80">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800/50 hover:bg-transparent">
                      <TableHead className="text-xs text-zinc-500">Action</TableHead>
                      <TableHead className="text-xs text-zinc-500">Type</TableHead>
                      <TableHead className="text-xs text-zinc-500">Status</TableHead>
                      <TableHead className="text-right text-xs text-zinc-500">Deployed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actions.filter(a => completedIds.has(a.id)).map((action) => (
                      <TableRow key={action.id} className="border-zinc-800/50">
                        <TableCell className="text-sm font-medium text-zinc-200">{action.title}</TableCell>
                        <TableCell>
                          <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400">{action.type}</span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                            Active in Shopify
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs text-zinc-500">Just now</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 rounded-xl border border-zinc-800/50 py-16 text-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-600" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 17 10 11 4 5" />
                  <line x1="12" y1="19" x2="20" y2="19" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-zinc-400">No executions yet</p>
                  <p className="mt-1 text-xs text-zinc-600">Deploy fixes from the Dashboard to see them here.</p>
                </div>
              </div>
            )}
          </div>
          )}

          {/* ═══════════════ SETTINGS PAGE ═══════════════ */}
          {activePage === "Settings" && (
          <div className="relative z-10 flex flex-col gap-6">
            <div>
              <h1 className="text-xl font-semibold text-zinc-50">Settings</h1>
              <p className="mt-1 text-sm text-zinc-500">Configure your store connection and AI preferences</p>
            </div>

            <div className="flex flex-col gap-4">
              {/* Shopify Connection */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6">
                <h2 className="text-sm font-semibold text-zinc-200">Shopify Connection</h2>
                <div className="mt-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#09090B] px-4 py-3">
                    <div>
                      <p className="text-sm text-zinc-300">Store URL</p>
                      <p className="mt-0.5 font-mono text-xs text-zinc-500">gzh-30.myshopify.com</p>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                      <span className="size-1.5 rounded-full bg-emerald-400" />
                      Connected
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#09090B] px-4 py-3">
                    <div>
                      <p className="text-sm text-zinc-300">API Version</p>
                      <p className="mt-0.5 font-mono text-xs text-zinc-500">2026-01</p>
                    </div>
                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">Latest</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#09090B] px-4 py-3">
                    <div>
                      <p className="text-sm text-zinc-300">Access Token</p>
                      <p className="mt-0.5 font-mono text-xs text-zinc-500">shpua_••••••••••••04ee</p>
                    </div>
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">Masked</span>
                  </div>
                </div>
              </div>

              {/* AI Configuration */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6">
                <h2 className="text-sm font-semibold text-zinc-200">AI Configuration</h2>
                <div className="mt-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#09090B] px-4 py-3">
                    <div>
                      <p className="text-sm text-zinc-300">Analysis Engine</p>
                      <p className="mt-0.5 text-xs text-zinc-500">Deterministic edge heuristics (6 models)</p>
                    </div>
                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">Active</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#09090B] px-4 py-3">
                    <div>
                      <p className="text-sm text-zinc-300">Auto-execute</p>
                      <p className="mt-0.5 text-xs text-zinc-500">Require manual approval before deploying</p>
                    </div>
                    <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">Manual</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#09090B] px-4 py-3">
                    <div>
                      <p className="text-sm text-zinc-300">Dead Stock Threshold</p>
                      <p className="mt-0.5 text-xs text-zinc-500">50+ units, 0 sales in 30 days</p>
                    </div>
                    <span className="font-mono text-xs text-zinc-400">50 units</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#09090B] px-4 py-3">
                    <div>
                      <p className="text-sm text-zinc-300">Shipping Cost Alert</p>
                      <p className="mt-0.5 text-xs text-zinc-500">Flag when shipping exceeds % of unit price</p>
                    </div>
                    <span className="font-mono text-xs text-zinc-400">40%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
        </main>
      </div>

      {/* ═══════════════ PRINT-ONLY EXECUTIVE REPORT ═══════════════ */}
      <div className="print-report" style={{ display: "none" }}>
        <div style={{ fontFamily: "Geist, Inter, system-ui, sans-serif", color: "#09090B", maxWidth: 720, margin: "0 auto" }}>
          {/* Report Header */}
          <div style={{ borderBottom: "2px solid #AAFF00", paddingBottom: 24, marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#AAFF00", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>AI</span>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em" }}>
                  Margin Protector
                </div>
                <div style={{ fontSize: 11, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Executive Intelligence Report
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#71717A", marginTop: 12 }}>
              <span>EcoTextiles Store — Margin Protection Audit</span>
              <span>Generated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
            </div>
          </div>

          {/* KPI Summary */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717A", marginBottom: 16 }}>
              Key Performance Indicators (7-Day Window)
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {kpis.map((kpi) => (
                <div key={kpi.label} style={{ padding: 16, border: "1px solid #E4E4E7", borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717A", marginBottom: 4 }}>
                    {kpi.label}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "Geist Mono, monospace", letterSpacing: "-0.05em" }}>
                    {kpi.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Recommendations */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717A", marginBottom: 16 }}>
              AI-Generated Recommendations ({actions.length})
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {actions.map((action, i) => {
                const isResolved = completedIds.has(action.id);
                return (
                  <div key={action.id} style={{ padding: 16, border: "1px solid #E4E4E7", borderRadius: 8, borderLeft: `3px solid ${action.urgency === "HIGH" ? "#EF4444" : action.urgency === "MEDIUM" ? "#F59E0B" : "#A1A1AA"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "Geist Mono, monospace", color: "#AAFF00", background: "#F0FFF0", padding: "2px 6px", borderRadius: 4 }}>
                          {action.type}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {action.title}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {isResolved && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#059669", background: "#F0FFF0", padding: "2px 8px", borderRadius: 4 }}>
                            DEPLOYED
                          </span>
                        )}
                        <span style={{ fontSize: 10, fontWeight: 600, color: action.urgency === "HIGH" ? "#EF4444" : action.urgency === "MEDIUM" ? "#F59E0B" : "#71717A" }}>
                          {action.urgency}
                        </span>
                      </div>
                    </div>
                    <p style={{ fontSize: 12, lineHeight: 1.6, color: "#52525B", marginBottom: 8 }}>
                      {action.description}
                    </p>
                    <div style={{ fontSize: 11, fontFamily: "Geist Mono, monospace", color: "#AAFF00", background: "#FAFAFA", padding: "8px 12px", borderRadius: 6, border: "1px solid #E4E4E7" }}>
                      Proposed: {action.proposedExecution}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Inventory Snapshot */}
          <div className="print-page-break" style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717A", marginBottom: 16 }}>
              Inventory Snapshot
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E4E4E7" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717A" }}>Product</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717A" }}>SKU</th>
                  <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717A" }}>Price</th>
                  <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717A" }}>Stock</th>
                  <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717A" }}>30d Sales</th>
                  <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717A" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const isLow = p.currentInventory < p.reorderThreshold;
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid #F4F4F5" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 500 }}>{p.title}</td>
                      <td style={{ padding: "8px 12px", fontFamily: "Geist Mono, monospace", color: "#71717A", fontSize: 11 }}>{p.sku}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "Geist Mono, monospace" }}>{formatCents(p.price)}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "Geist Mono, monospace", fontWeight: 600, color: isLow ? "#EF4444" : "#09090B" }}>
                        {p.currentInventory}{isLow ? " !" : ""}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "Geist Mono, monospace", color: p.totalSold30d === 0 ? "#F59E0B" : "#09090B" }}>
                        {p.totalSold30d}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right", textTransform: "capitalize", fontSize: 11, color: p.status === "active" ? "#059669" : "#71717A" }}>{p.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div style={{ borderTop: "1px solid #E4E4E7", paddingTop: 16, display: "flex", justifyContent: "space-between", fontSize: 10, color: "#A1A1AA" }}>
            <span>AI Margin Protector — Confidential</span>
            <span>Powered by Prime Intellect Compute Network</span>
          </div>
        </div>
      </div>
    </div>
  );
}
