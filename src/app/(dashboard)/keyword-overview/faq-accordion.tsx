"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";

const FAQS = [
  {
    q: "Is Keyword Overview free to use?",
    a: "Yes, Keyword Overview offers free keyword analysis with core metrics such as search volume, keyword difficulty, intent, and competitive density. Free accounts have generous daily search quotas.",
  },
  {
    q: "Can I see both organic and paid data for keywords?",
    a: "Yes, you can analyze both organic SEO metrics (search volume, difficulty, SERP features) and paid advertising data (CPC, competitive density, active ad copy count, PLA metrics).",
  },
  {
    q: "How can I use the domain-based feature?",
    a: "Entering your domain allows the tool to provide personalized keyword difficulty calculations specifically tailored to your website's authority and ranking potential.",
  },
  {
    q: "How does the Personal Keyword Difficulty checker work?",
    a: "Personal Keyword Difficulty evaluates your site's current authority score and backlink profile against top-ranking pages to estimate your realistic likelihood of ranking in the top 10.",
  },
  {
    q: "Can I filter the keyword data based on location and device?",
    a: "Yes, you can filter keyword metrics across over 200+ global databases, drill down to specific local cities/regions, and toggle between Desktop and Mobile search data.",
  },
  {
    q: "How is the Keyword Difficulty score calculated?",
    a: "The Keyword Difficulty (KD%) score measures how hard it would be for a new website to rank on the first page of Google, calculated from the backlink and authority profiles of current top-10 URLs.",
  },
];

export function KeywordOverviewFaqs() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <div className="rounded-xl border border-border bg-surface shadow-xs divide-y divide-border overflow-hidden">
      {FAQS.map((faq, idx) => {
        const isOpen = openIdx === idx;
        return (
          <div key={idx} className="transition-colors">
            <button
              type="button"
              onClick={() => toggle(idx)}
              className="flex w-full items-center justify-between px-6 py-4 text-left text-[14px] font-semibold text-foreground hover:bg-surface-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ChevronRight
                  className={`size-4 text-muted-foreground transition-transform duration-200 ${
                    isOpen ? "rotate-90 text-blue-600" : ""
                  }`}
                />
                <span>{faq.q}</span>
              </div>
            </button>
            {isOpen && (
              <div className="px-6 pb-4 pt-1 text-[13px] text-muted-foreground leading-relaxed pl-12 animate-in fade-in-0 duration-150">
                {faq.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
