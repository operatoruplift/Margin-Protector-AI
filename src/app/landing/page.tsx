"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-50">
      {/* ── NAV ── */}
      <nav className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-white/5 bg-[#09090B]/80 px-6 backdrop-blur-xl lg:px-16">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-[#AAFF00]">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="black"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight">
            Margin Protector AI
          </span>
        </div>
        <Link
          href="/"
          className="rounded-lg bg-[#AAFF00] px-4 py-2 text-sm font-semibold text-black transition-all hover:brightness-110 active:scale-95"
        >
          Open Dashboard
        </Link>
      </nav>

      {/* ── HERO ── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-16 text-center">
        {/* Background glow */}
        <div className="pointer-events-none absolute top-1/4 size-[600px] rounded-full bg-[#AAFF00]/[0.04] blur-[120px]" />

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative z-10 flex max-w-3xl flex-col items-center"
        >
          <motion.div variants={fadeUp}>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#AAFF00]/20 bg-[#AAFF00]/5 px-4 py-1.5 text-xs font-medium text-[#AAFF00]">
              <span className="size-1.5 rounded-full bg-[#AAFF00]" />
              6 Deterministic Heuristics &middot; Zero Hallucinations
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl"
          >
            Your store is{" "}
            <span className="text-[#AAFF00]">bleeding money.</span>
            <br />
            We stop the leak.
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-zinc-400"
          >
            100 units of a $45 SKU sitting unsold is{" "}
            <span className="font-semibold text-zinc-200">
              $4,500 in dead capital
            </span>{" "}
            — depreciating at 2% per month. Margin Protector connects to
            your Shopify store, identifies profit leakage in under 50ms, and
            deploys the fix with a single click.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
          >
            <Link
              href="/"
              className="rounded-xl bg-[#AAFF00] px-8 py-3.5 text-base font-semibold text-black shadow-[0_0_30px_rgba(170,255,0,0.3)] transition-all hover:brightness-110 active:scale-95"
            >
              See It In Action
            </Link>
            <span className="text-sm text-zinc-500">
              8:1 ROI in the first month
            </span>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="mt-16 flex items-center gap-8 font-mono text-sm text-zinc-500"
          >
            <span>
              <span className="text-2xl font-bold text-[#AAFF00]">50ms</span>
              <br />
              analysis time
            </span>
            <span className="h-8 w-px bg-zinc-800" />
            <span>
              <span className="text-2xl font-bold text-[#AAFF00]">6</span>
              <br />
              heuristics
            </span>
            <span className="h-8 w-px bg-zinc-800" />
            <span>
              <span className="text-2xl font-bold text-[#AAFF00]">1-click</span>
              <br />
              Shopify fix
            </span>
          </motion.div>
        </motion.div>
      </section>

      {/* ── THE PROBLEM ── */}
      <section className="border-t border-zinc-800/50 px-6 py-24 lg:px-16">
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-[#AAFF00]">
              The Problem
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              You&apos;re optimizing ads while your warehouse bleeds cash.
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-400">
              Merchants obsess over ROAS and conversion rates. Meanwhile, dead
              inventory quietly drains capital at 2% per month in holding costs.
              Shipping margins erode. Conversion dips go unnoticed for days. By
              the time a human spots the leak, thousands are already gone.
            </p>
          </motion.div>

          <motion.div
            className="mt-12 grid gap-6 md:grid-cols-3"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
          >
            {[
              {
                stat: "$800+",
                label: "Monthly holding cost bleed on 8 SKUs",
              },
              {
                stat: "2-4 weeks",
                label: "Time to manually identify dead stock",
              },
              {
                stat: "30+ min",
                label: "To create a discount code in Shopify",
              },
            ].map((item) => (
              <motion.div
                key={item.label}
                variants={fadeUp}
                className="rounded-xl border border-white/5 bg-zinc-900/50 p-6"
              >
                <span className="font-mono text-3xl font-bold text-red-400">
                  {item.stat}
                </span>
                <p className="mt-2 text-sm text-zinc-500">{item.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="border-t border-zinc-800/50 px-6 py-24 lg:px-16">
        <div className="mx-auto max-w-4xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#AAFF00]">
            How It Works
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Three steps. Under 50 milliseconds.
          </h2>

          <motion.div
            className="mt-12 grid gap-8 lg:grid-cols-3"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
          >
            {[
              {
                step: "01",
                title: "Connect",
                desc: "Plug in your Shopify store. We ingest every product, order, and analytics data point via the Admin API.",
              },
              {
                step: "02",
                title: "Analyze",
                desc: "6 deterministic heuristics scan every SKU for dead stock, shipping erosion, restock urgency, conversion dips, refund anomalies, and fulfillment bottlenecks.",
              },
              {
                step: "03",
                title: "Execute",
                desc: "Each finding includes the exact Shopify GraphQL mutation. Click 'Deploy Fix' — discount codes, POs, and campaigns are live in 2 seconds.",
              },
            ].map((item) => (
              <motion.div
                key={item.step}
                variants={fadeUp}
                className="rounded-xl border border-white/5 bg-zinc-900/50 p-6"
              >
                <span className="font-mono text-xs font-bold text-[#AAFF00]">
                  {item.step}
                </span>
                <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── ROI ── */}
      <section className="border-t border-zinc-800/50 px-6 py-24 lg:px-16">
        <div className="mx-auto max-w-4xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#AAFF00]">
            Why This Makes Money
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            8:1 ROI in the first month.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
            A $99/mo subscription recovers $800+ in dead stock capital alone —
            before touching shipping optimization, conversion recovery, or
            refund analysis.
          </p>

          <motion.div
            className="mx-auto mt-12 grid max-w-2xl gap-4 md:grid-cols-2"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
          >
            {[
              { label: "Dead stock capital recovered", value: "$12,000+" },
              { label: "Monthly holding cost eliminated", value: "$800+/mo" },
              { label: "Time to detect leakage", value: "< 50ms" },
              { label: "Time to deploy Shopify fix", value: "2 seconds" },
            ].map((item) => (
              <motion.div
                key={item.label}
                variants={fadeUp}
                className="rounded-xl border border-white/5 bg-zinc-900/50 p-6 text-left"
              >
                <span className="font-mono text-2xl font-bold text-[#AAFF00]">
                  {item.value}
                </span>
                <p className="mt-1 text-sm text-zinc-500">{item.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-zinc-800/50 px-6 py-24 text-center lg:px-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Stop losing money to dead capital.
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Connect your Shopify store in 30 seconds and see exactly where
            your margins are leaking.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex rounded-xl bg-[#AAFF00] px-10 py-4 text-base font-bold text-black shadow-[0_0_40px_rgba(170,255,0,0.25)] transition-all hover:brightness-110 active:scale-95"
          >
            Launch Dashboard
          </Link>
          <p className="mt-4 text-xs text-zinc-600">
            No credit card required &middot; Works with any Shopify store
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-zinc-800/50 px-6 py-8 lg:px-16">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <div className="flex size-5 items-center justify-center rounded bg-[#AAFF00]">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="black"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            Margin Protector AI
          </div>
          <span className="text-xs text-zinc-600">
            Built by Operator Uplift &middot; OpenClaw 2026
          </span>
        </div>
      </footer>
    </div>
  );
}
