export default function Terms() {
  return (
    <div className="page-wrap py-16 max-w-3xl mx-auto">
      <h1 className="font-display text-3xl mb-8" style={{ color: "#2C3E2D" }}>Terms of Service</h1>
      <div className="space-y-6 text-sm leading-relaxed" style={{ color: "#6B6560" }}>
        <p className="text-xs" style={{ color: "#9B9590" }}>Last updated: March 19, 2026</p>

        <h2 className="font-display text-xl pt-4" style={{ color: "#2C3E2D" }}>1. Acceptance of Terms</h2>
        <p>
          By accessing or using SPEKD ("the Service"), you agree to be bound by these
          Terms of Service. If you do not agree to these terms, you may not use the Service.
        </p>

        <h2 className="font-display text-xl pt-4" style={{ color: "#2C3E2D" }}>2. Description of Service</h2>
        <p>
          SPEKD is a furniture discovery and sourcing platform for interior design professionals.
          The Service provides AI-powered search across trade vendor catalogs, quote building tools,
          and related functionality. SPEKD does not sell furniture directly — all purchases are made
          through the respective vendors.
        </p>

        <h2 className="font-display text-xl pt-4" style={{ color: "#2C3E2D" }}>3. User Accounts</h2>
        <p>
          You are responsible for maintaining the confidentiality of your account credentials
          and for all activities that occur under your account. You must provide accurate and
          complete information when creating an account.
        </p>

        <h2 className="font-display text-xl pt-4" style={{ color: "#2C3E2D" }}>4. Acceptable Use</h2>
        <p>
          You agree to use the Service only for lawful purposes related to furniture sourcing
          and interior design. You may not use the Service to scrape data, redistribute vendor
          content, or engage in any activity that interferes with the Service's operation.
        </p>

        <h2 className="font-display text-xl pt-4" style={{ color: "#2C3E2D" }}>5. Intellectual Property</h2>
        <p>
          All product images, descriptions, and pricing information displayed on SPEKD are the
          property of their respective vendors. SPEKD's own branding, software, and AI technology
          are proprietary. You may not copy, modify, or distribute any part of the Service.
        </p>

        <h2 className="font-display text-xl pt-4" style={{ color: "#2C3E2D" }}>6. Pricing and Accuracy</h2>
        <p>
          While we strive to display accurate pricing and product information, all data is
          sourced from vendor catalogs and may not reflect real-time availability or pricing.
          Always confirm details directly with the vendor before placing orders.
        </p>

        <h2 className="font-display text-xl pt-4" style={{ color: "#2C3E2D" }}>7. Limitation of Liability</h2>
        <p>
          SPEKD is provided "as is" without warranties of any kind. We are not liable for any
          damages arising from your use of the Service, including but not limited to purchasing
          decisions made based on information displayed on our platform.
        </p>

        <h2 className="font-display text-xl pt-4" style={{ color: "#2C3E2D" }}>8. Changes to Terms</h2>
        <p>
          We reserve the right to modify these terms at any time. Continued use of the Service
          after changes constitutes acceptance of the updated terms.
        </p>

        <h2 className="font-display text-xl pt-4" style={{ color: "#2C3E2D" }}>9. Contact</h2>
        <p>
          For questions about these terms, contact us at{" "}
          <a
            href="mailto:support@spekd.ai"
            className="transition-colors"
            style={{ color: "#B8956A" }}
            onMouseEnter={(e) => e.target.style.color = "#2C3E2D"}
            onMouseLeave={(e) => e.target.style.color = "#B8956A"}
          >
            support@spekd.ai
          </a>.
        </p>
      </div>
    </div>
  );
}
