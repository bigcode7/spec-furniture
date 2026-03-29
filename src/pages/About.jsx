import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function About() {
  return (
    <div className="page-wrap py-16 max-w-3xl mx-auto">
      <h1 className="font-display text-3xl text-white mb-8">About SPEKD</h1>
      <div className="space-y-6 text-sm text-white/60 leading-relaxed">
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
        <h2 className="font-display text-xl text-white pt-4">Our Mission</h2>
        <p>
          We believe the furniture sourcing process is overdue for modernization. Designers spend
          countless hours searching through individual vendor sites, catalogs, and showrooms. SPEKD
          consolidates this workflow into a single intelligent search — saving time so designers can
          focus on what they do best: creating beautiful spaces.
        </p>
        <h2 className="font-display text-xl text-white pt-4">For the Trade</h2>
        <p>
          SPEKD is built exclusively for the trade. Every product links directly to the vendor's
          own page with real images, real pricing, and real availability. We don't sell furniture —
          we help you find it faster.
        </p>
        <div className="pt-8">
          <Link
            to={createPageUrl("Search")}
            className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-all hover:brightness-110"
            style={{
              background: "linear-gradient(135deg, rgba(196,168,130,0.25), rgba(196,168,130,0.15))",
              border: "1px solid rgba(196,168,130,0.3)",
              color: "#c4a882",
            }}
          >
            Start Searching
          </Link>
        </div>
      </div>
    </div>
  );
}
