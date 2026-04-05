export default function Privacy() {
  return (
    <div className="page-wrap py-16 max-w-3xl mx-auto">
      <h1 className="font-display text-3xl mb-8" style={{ color: "white", fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}>Privacy Policy</h1>
      <div className="space-y-6 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)", fontFamily: "'Barlow', sans-serif" }}>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Last updated: March 19, 2026</p>

        <h2 className="font-display text-xl pt-4" style={{ color: "white", fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}>1. Information We Collect</h2>
        <p>
          When you create an account, we collect your name, email address, and company name.
          When you use our search features, we collect search queries and interaction data to
          improve our service. We do not sell your personal information to third parties.
        </p>

        <h2 className="font-display text-xl pt-4" style={{ color: "white", fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}>2. How We Use Your Information</h2>
        <p>
          We use the information we collect to provide and improve our services, personalize
          your experience, send relevant communications, and maintain the security of our platform.
          Search queries are used to train and improve our AI search algorithms.
        </p>

        <h2 className="font-display text-xl pt-4" style={{ color: "white", fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}>3. Data Storage and Security</h2>
        <p>
          Your data is stored securely using industry-standard encryption. We implement
          appropriate technical and organizational measures to protect your personal information
          against unauthorized access, alteration, or destruction.
        </p>

        <h2 className="font-display text-xl pt-4" style={{ color: "white", fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}>4. Cookies and Tracking</h2>
        <p>
          We use cookies and similar technologies to maintain your session, remember your
          preferences, and analyze usage patterns. You can control cookie settings through
          your browser preferences.
        </p>

        <h2 className="font-display text-xl pt-4" style={{ color: "white", fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}>5. Third-Party Services</h2>
        <p>
          Our platform links to third-party vendor websites. We are not responsible for
          the privacy practices of these external sites. We encourage you to review their
          privacy policies independently.
        </p>

        <h2 className="font-display text-xl pt-4" style={{ color: "white", fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}>6. Your Rights</h2>
        <p>
          You may request access to, correction of, or deletion of your personal data at
          any time by contacting us at support@spekd.ai. We will respond to your request
          within 30 days.
        </p>

        <h2 className="font-display text-xl pt-4" style={{ color: "white", fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}>7. Contact</h2>
        <p>
          For questions about this privacy policy, contact us at{" "}
          <a
            href="mailto:support@spekd.ai"
            className="transition-colors"
            style={{ color: "rgba(255,255,255,0.65)" }}
            onMouseEnter={(e) => e.target.style.color = "white"}
            onMouseLeave={(e) => e.target.style.color = "rgba(255,255,255,0.65)"}
          >
            support@spekd.ai
          </a>.
        </p>
      </div>
    </div>
  );
}
