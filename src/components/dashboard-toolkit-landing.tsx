"use client";

import {
  ArrowRight,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Globe,
  Lock,
  Search,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { quickCreateProject } from "@/app/(dashboard)/quick-actions";
import { Button } from "@/components/ui/button";

export function DashboardToolkitLanding() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-16 pt-2">
      {/* 1. Hero Card */}
      <div className="rounded-3xl border border-zinc-200/90 bg-white p-8 shadow-xs sm:p-12 dark:border-zinc-800/90 dark:bg-[#121216]">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-[36px] sm:leading-[1.2] dark:text-white">
            Semrush SEO Toolkit: SEO Tools You Can Trust for the AI Search Era
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-zinc-600 sm:text-[15px] dark:text-zinc-400">
            Analyze your evolving search market, improve site performance, and
            reach your ideal customers with the SEO tools trusted by the
            world’s top brands.
          </p>

          {/* Quick Domain Form */}
          <form
            action={quickCreateProject}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <div className="relative w-full flex-1">
              <input
                type="text"
                name="domain"
                required
                placeholder="Enter domain"
                className="w-full rounded-[6px] border-2 border-indigo-400/80 bg-white px-4 py-2.5 text-[14px] font-medium text-zinc-950 placeholder:text-zinc-400 shadow-xs focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 dark:border-indigo-500/80 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-[6px] bg-zinc-950 px-5 py-3 text-[14px] font-bold text-white shadow-md transition-all hover:bg-zinc-800 active:scale-[0.98] sm:w-auto dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
            >
              Create SEO project
            </button>
          </form>
        </div>
      </div>

      {/* 2. 3-Step Process Card */}
      <div className="rounded-3xl border border-zinc-200/90 bg-white p-8 shadow-xs sm:p-10 dark:border-zinc-800/90 dark:bg-[#121216]">
        <h2 className="text-center text-xl font-bold tracking-tight text-zinc-950 sm:text-[22px] dark:text-white">
          Get discovered wherever your audience is searching
        </h2>

        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          {/* Step 1: Run Research */}
          <div className="flex flex-col items-center text-center">
            <div className="flex size-24 items-center justify-center rounded-2xl bg-blue-50/80 p-4 dark:bg-blue-950/30">
              <svg
                viewBox="0 0 64 64"
                className="size-16 text-blue-500"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="8"
                  y="12"
                  width="48"
                  height="38"
                  rx="6"
                  className="fill-blue-100 stroke-blue-600 dark:fill-blue-900/60 dark:stroke-blue-400"
                  strokeWidth="2.5"
                />
                <circle cx="16" cy="20" r="2" className="fill-blue-500" />
                <circle cx="22" cy="20" r="2" className="fill-blue-500" />
                <circle cx="28" cy="20" r="2" className="fill-blue-500" />
                <circle
                  cx="32"
                  cy="32"
                  r="10"
                  className="fill-white stroke-blue-700 dark:fill-zinc-900 dark:stroke-blue-300"
                  strokeWidth="3"
                />
                <path
                  d="M40 40L48 48"
                  className="stroke-blue-700 dark:stroke-blue-300"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-[16px] font-bold text-zinc-950 dark:text-white">
              Run Research
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Gather & interpret data about your SEO market—with AI assistance at
              each step.
            </p>
          </div>

          {/* Step 2: Take Action */}
          <div className="flex flex-col items-center text-center">
            <div className="flex size-24 items-center justify-center rounded-2xl bg-purple-50/80 p-4 dark:bg-purple-950/30">
              <svg
                viewBox="0 0 64 64"
                className="size-16 text-purple-500"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="10"
                  y="12"
                  width="44"
                  height="34"
                  rx="6"
                  className="fill-purple-100 stroke-purple-600 dark:fill-purple-900/60 dark:stroke-purple-400"
                  strokeWidth="2.5"
                />
                <circle
                  cx="22"
                  cy="24"
                  r="5"
                  className="fill-purple-300 dark:fill-purple-700"
                />
                <line
                  x1="32"
                  y1="22"
                  x2="46"
                  y2="22"
                  className="stroke-purple-500"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <line
                  x1="32"
                  y1="27"
                  x2="42"
                  y2="27"
                  className="stroke-purple-400"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M16 38C24 38 28 32 36 32C42 32 44 38 48 38"
                  className="stroke-purple-600 dark:stroke-purple-400"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-[16px] font-bold text-zinc-950 dark:text-white">
              Take Action
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Receive tailored recommendations for SEO with the help of
              AI-powered tools.
            </p>
          </div>

          {/* Step 3: See Results */}
          <div className="flex flex-col items-center text-center">
            <div className="flex size-24 items-center justify-center rounded-2xl bg-pink-50/80 p-4 dark:bg-pink-950/30">
              <svg
                viewBox="0 0 64 64"
                className="size-16 text-pink-500"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="14"
                  y="12"
                  width="36"
                  height="40"
                  rx="6"
                  className="fill-pink-100 stroke-pink-600 dark:fill-pink-900/60 dark:stroke-pink-400"
                  strokeWidth="2.5"
                />
                <circle cx="24" cy="24" r="3" className="fill-pink-500" />
                <path
                  d="M32 24H42"
                  className="stroke-pink-400"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="24" cy="34" r="3" className="fill-pink-500" />
                <path
                  d="M32 34H42"
                  className="stroke-pink-400"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M20 44L28 38L36 42L44 32"
                  className="stroke-pink-600 dark:stroke-pink-400"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-[16px] font-bold text-zinc-950 dark:text-white">
              See Results
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Watch your efforts impact where you stand in the market.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Alternating Feature Showcase */}
      <div className="space-y-6">
        {/* Feature 1: Competitors */}
        <div className="grid items-center gap-8 rounded-3xl border border-zinc-200/90 bg-white p-8 shadow-xs md:grid-cols-2 md:p-12 dark:border-zinc-800/90 dark:bg-[#121216]">
          <div className="space-y-4">
            <h2 className="text-xl font-extrabold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">
              Outsmart your competition with high-impact SEO analysis
            </h2>
            <p className="text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Get a clear roadmap to outrank your rivals by uncovering their
              traffic, keywords, and strategies—so you can make smarter, faster
              decisions that drive growth.
            </p>
            <div className="pt-2">
              <Button
                variant="primary"
                className="rounded-xl bg-zinc-950 px-5 font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                asChild
              >
                <Link href="/projects">Analyze competitors</Link>
              </Button>
            </div>
          </div>

          {/* Graphic: Competition Map & Table */}
          <div className="relative flex items-center justify-center rounded-2xl bg-amber-50/50 p-6 dark:bg-amber-950/10">
            <div className="w-full max-w-sm rounded-xl border border-zinc-200/80 bg-white p-4 shadow-md dark:border-zinc-800 dark:bg-zinc-900">
              <div className="border-b border-zinc-100 pb-3 dark:border-zinc-800">
                <span className="text-[11px] font-bold text-zinc-400">
                  Competition Map
                </span>
                <div className="mt-2 flex items-center justify-around">
                  <div className="size-6 rounded-full bg-purple-400/80 opacity-80" />
                  <div className="size-10 rounded-full bg-orange-400/80 opacity-80" />
                  <div className="size-12 rounded-full bg-emerald-400/80 opacity-80" />
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <span className="text-[12px] font-bold text-zinc-900 dark:text-white">
                  Main Organic Competitors
                </span>
                <div className="space-y-1.5 text-[12px]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-blue-600">ebay.com</span>
                    <span className="text-zinc-500">185M</span>
                    <div className="h-1.5 w-16 rounded-full bg-blue-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-blue-600">
                      walmart.com
                    </span>
                    <span className="text-zinc-500">25M</span>
                    <div className="h-1.5 w-10 rounded-full bg-blue-300" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature 2: Keywords */}
        <div className="grid items-center gap-8 rounded-3xl border border-zinc-200/90 bg-white p-8 shadow-xs md:grid-cols-2 md:p-12 dark:border-zinc-800/90 dark:bg-[#121216]">
          {/* Graphic: Keyword Volume & KD */}
          <div className="order-2 md:order-1 relative flex items-center justify-center rounded-2xl bg-blue-50/50 p-6 dark:bg-blue-950/10">
            <div className="w-full max-w-sm rounded-xl border border-zinc-200/80 bg-white p-4 shadow-md dark:border-zinc-800 dark:bg-zinc-900">
              <div className="grid grid-cols-2 gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800">
                <div>
                  <span className="text-[11px] font-bold text-zinc-400">
                    Volume
                  </span>
                  <div className="text-[18px] font-extrabold text-zinc-900 dark:text-white">
                    5.4K 🇺🇸
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-zinc-400">
                    Global Volume
                  </span>
                  <div className="text-[18px] font-extrabold text-zinc-900 dark:text-white">
                    17.5K
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <span className="text-[11px] font-bold text-zinc-400">
                  Keyword Difficulty
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[16px] font-bold text-red-500">82%</span>
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-950 dark:text-red-400">
                    Very hard
                  </span>
                </div>
                {/* Mini trend bars */}
                <div className="mt-3 flex items-end gap-1 h-8">
                  {[40, 50, 60, 45, 75, 90, 85, 100, 95, 80].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-xs bg-blue-500/80"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 md:order-2 space-y-4">
            <h2 className="text-xl font-extrabold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">
              Reach more customers by finding the right keywords & prompts
            </h2>
            <p className="text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Discover high-intent keywords that attract ready-to-buy traffic and
              power your content to the top of the search results—from Google to
              ChatGPT.
            </p>
            <div className="pt-2">
              <Button
                variant="primary"
                className="rounded-xl bg-zinc-950 px-5 font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                asChild
              >
                <Link href="/imports">Explore keyword ideas</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Feature 3: Backlinks */}
        <div className="grid items-center gap-8 rounded-3xl border border-zinc-200/90 bg-white p-8 shadow-xs md:grid-cols-2 md:p-12 dark:border-zinc-800/90 dark:bg-[#121216]">
          <div className="space-y-4">
            <h2 className="text-xl font-extrabold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">
              Build authority & trust that outlasts your rivals
            </h2>
            <p className="text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Turn your online connections into a growth engine. Earn quality
              backlinks that fuel search rankings, brand trust, and long-term
              SEO success.
            </p>
            <div className="pt-2">
              <Button
                variant="primary"
                className="rounded-xl bg-zinc-950 px-5 font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                asChild
              >
                <Link href="/projects">Optimize backlinks</Link>
              </Button>
            </div>
          </div>

          {/* Graphic: Backlinks & Authority */}
          <div className="relative flex items-center justify-center rounded-2xl bg-purple-50/50 p-6 dark:bg-purple-950/10">
            <div className="w-full max-w-sm rounded-xl border border-zinc-200/80 bg-white p-4 shadow-md dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800">
                <span className="text-[12px] font-bold text-zinc-900 dark:text-white">
                  Authority Score
                </span>
                <span className="rounded bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                  AS 68
                </span>
              </div>
              {/* Trend lines graphic */}
              <div className="mt-4">
                <span className="text-[11px] font-bold text-zinc-400">
                  New & Lost Backlinks
                </span>
                <svg
                  viewBox="0 0 200 60"
                  className="mt-2 w-full"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M0 45C30 35 60 50 100 25C140 10 170 30 200 15"
                    stroke="#ec4899"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M0 50C40 45 70 30 110 35C150 40 180 20 200 25"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="mt-2 flex justify-between text-[10px] text-zinc-400">
                  <span>Nov 20</span>
                  <span>Dec 20</span>
                  <span>Jan 21</span>
                  <span>Feb 21</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature 4: Site Audit */}
        <div className="grid items-center gap-8 rounded-3xl border border-zinc-200/90 bg-white p-8 shadow-xs md:grid-cols-2 md:p-12 dark:border-zinc-800/90 dark:bg-[#121216]">
          {/* Graphic: Issue Card */}
          <div className="order-2 md:order-1 relative flex items-center justify-center rounded-2xl bg-emerald-50/50 p-6 dark:bg-emerald-950/10">
            <div className="w-full max-w-sm rounded-xl border border-zinc-200/80 bg-white p-4 shadow-md dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-[12px] font-bold text-red-500">Errors</span>
              <div className="mt-2 space-y-2 text-[12px]">
                <div className="rounded-md bg-zinc-50 p-2 text-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-200">
                  <div className="font-semibold text-blue-600">
                    21 pages have duplicate content
                  </div>
                </div>
                <div className="rounded-md bg-zinc-50 p-2 text-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-200">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-blue-600">
                      16 internal links are broken
                    </span>
                    <span className="rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-700">
                      2 new
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-zinc-100 p-2 text-center text-[11px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                <span className="bg-white py-1 rounded shadow-xs dark:bg-zinc-700">
                  About issue
                </span>
                <span className="py-1">How to fix</span>
              </div>
            </div>
          </div>

          <div className="order-1 md:order-2 space-y-4">
            <h2 className="text-xl font-extrabold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">
              Understand the SEO issues holding you back in search
            </h2>
            <p className="text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Improve site health, content quality, and UX in ways that search
              engines reward—so you can rank higher and convert more visitors.
            </p>
            <div className="pt-2">
              <Button
                variant="primary"
                className="rounded-xl bg-zinc-950 px-5 font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                asChild
              >
                <Link href="/projects">Run site audit</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Feature 5: Content Creation */}
        <div className="grid items-center gap-8 rounded-3xl border border-zinc-200/90 bg-white p-8 shadow-xs md:grid-cols-2 md:p-12 dark:border-zinc-800/90 dark:bg-[#121216]">
          <div className="space-y-4">
            <h2 className="text-xl font-extrabold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">
              Gather ideas and create better website content
            </h2>
            <p className="text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Find trending topic ideas, build a backlog of content creation
              plans, and generate search-optimized briefs and drafts ready to
              rank on Google.
            </p>
            <div className="pt-2">
              <Button
                variant="primary"
                className="rounded-xl bg-zinc-950 px-5 font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                asChild
              >
                <Link href="/projects">Create content</Link>
              </Button>
            </div>
          </div>

          {/* Graphic: Content Ideas Card */}
          <div className="relative flex items-center justify-center rounded-2xl bg-amber-50/50 p-6 dark:bg-amber-950/10">
            <div className="w-full max-w-sm rounded-xl border border-zinc-200/80 bg-white p-4 shadow-md dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-[11px] font-bold text-zinc-400">
                See how your competitors use target keywords
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                  Virtual Reality
                </span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">
                  content trends
                </span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">
                  data driven
                </span>
              </div>
              <div className="mt-3 rounded-lg border border-zinc-100 p-2.5 text-[12px] dark:border-zinc-800">
                <div className="font-semibold text-zinc-900 dark:text-white">
                  1. Virtual Reality, the technology of the future
                </div>
                <div className="truncate text-[11px] text-blue-600">
                  https://www.yourcompetitor.com/article/
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature 6: Position Tracking & AI Visibility */}
        <div className="grid items-center gap-8 rounded-3xl border border-zinc-200/90 bg-white p-8 shadow-xs md:grid-cols-2 md:p-12 dark:border-zinc-800/90 dark:bg-[#121216]">
          {/* Graphic: AI Visibility Card */}
          <div className="order-2 md:order-1 relative flex items-center justify-center rounded-2xl bg-sky-50/50 p-6 dark:bg-sky-950/10">
            <div className="w-full max-w-sm rounded-xl border border-zinc-200/80 bg-white p-4 shadow-md dark:border-zinc-800 dark:bg-zinc-900">
              <div className="grid grid-cols-2 gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800">
                <div>
                  <span className="text-[11px] font-bold text-zinc-400">
                    AI Visibility
                  </span>
                  <div className="text-[18px] font-extrabold text-blue-600">
                    77% <span className="text-[12px] text-emerald-500">+6%</span>
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-zinc-400">
                    Mentions
                  </span>
                  <div className="text-[18px] font-extrabold text-zinc-900 dark:text-white">
                    883 <span className="text-[12px] text-emerald-500">+75</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-[12px]">
                <span className="text-zinc-500">Average position</span>
                <span className="font-bold text-zinc-900 dark:text-white">
                  35.6 <span className="text-emerald-500">↑0.8</span>
                </span>
              </div>
            </div>
          </div>

          <div className="order-1 md:order-2 space-y-4">
            <h2 className="text-xl font-extrabold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">
              Track positions on Google, Bing, Baidu, ChatGPT, and AI Mode
            </h2>
            <p className="text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Measure your site’s visibility on traditional and AI-powered
              search platforms for high-value prompts and keywords. Then, report
              on traditional SEO and AI search results in one platform.
            </p>
            <div className="pt-2">
              <Button
                variant="primary"
                className="rounded-xl bg-zinc-950 px-5 font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                asChild
              >
                <Link href="/projects">Track positions</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Feature 7: AI Search Readiness */}
        <div className="grid items-center gap-8 rounded-3xl border border-zinc-200/90 bg-white p-8 shadow-xs md:grid-cols-2 md:p-12 dark:border-zinc-800/90 dark:bg-[#121216]">
          <div className="space-y-4">
            <h2 className="text-xl font-extrabold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">
              Audit your site for AI-readiness
            </h2>
            <p className="text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Check your AI Search Site Health and identify critical errors that
              could be blocking AI bots from accessing your content or citing
              you in their responses.
            </p>
            <div className="pt-2">
              <Button
                variant="primary"
                className="rounded-xl bg-zinc-950 px-5 font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                asChild
              >
                <Link href="/projects">Check AI search site health</Link>
              </Button>
            </div>
          </div>

          {/* Graphic: AI Search Health & Bot access list */}
          <div className="relative flex items-center justify-center rounded-2xl bg-orange-50/50 p-6 dark:bg-orange-950/10">
            <div className="w-full max-w-sm rounded-xl border border-zinc-200/80 bg-white p-4 shadow-md dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
                <div>
                  <span className="text-[11px] font-bold text-zinc-400">
                    AI Search Health
                  </span>
                  <div className="text-[20px] font-extrabold text-orange-500">
                    44%
                  </div>
                </div>
                <div className="text-[11px] text-zinc-500 max-w-[120px] text-right leading-tight">
                  Reach 80% for better AI search
                </div>
              </div>
              <div className="mt-3 space-y-2 text-[12px]">
                <span className="text-[11px] font-bold text-zinc-400">
                  Blocked from AI Search
                </span>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    ✳️ Claude
                  </span>
                  <span className="size-2 rounded-full bg-emerald-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    🕸️ Perplexity
                  </span>
                  <span className="size-2 rounded-full bg-emerald-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    💬 ChatGPT
                  </span>
                  <span className="size-2 rounded-full bg-emerald-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    🌐 Googlebot
                  </span>
                  <span className="size-2 rounded-full bg-emerald-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
