import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function About() {
  return (
    <div className="page-wrap py-16 max-w-3xl mx-auto">
      <h1 className="font-display text-3xl mb-8" style={{ color: "white", fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}>About SPEKD</h1>
      <div className="space-y-6 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)", fontFamily: "'Barlow', sans-serif" }}>
        <p>
          SPEKD is an AI-native furniture sourcing platform built for interior designers and the trade.
          We index thousands of products across leading trade-only manufacturers, giving designers a
          single place to search, compare, and quote furniture from verified vendor catalogs.
        </p>
        <p>
          Our AI understands the way designers think — materials, styles, dimensions, budgets, and
          design intent. Instead of browsing dozens of vendor websites, you describe what you need
          in natural language and SPEKD finds the best matches across every catalog simultaneously.
        </p>
        <h2 className="font-display text-xl pt-4" style={{ color: "white", fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}>Our Mission</h2>
        <p>
          We believe the furniture sourcing process is overdue for modernization. Designers spend
          countless hours searching through individual vendor sites, catalogs, and showrooms. SPEKD
          consolidates this workflow into a single intelligent search — saving time so designers can
          focus on what they do best: creating beautiful spaces.
        </p>
        <h2 className="font-display text-xl pt-4" style={{ color: "white", fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}>For the Trade</h2>
        <p>
          SPEKD is built exclusively for the trade. Every product links directly to the vendor's
          own page with real images, real pricing, and real availability. We don't sell furniture —
          we help you find it faster.
        </p>
        <div className="pt-8">
          <Link
            to={createPageUrl("Search")}
            className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium transition-all hover:opacity-90"
            style={{
              background: "white",
              color: "#0F0D0B",
              fontFamily: "'Barlow', sans-serif",
            }}
          >
            Start Searching
          </Link>
        </div>
      </div>
    </div>
  );
}
