import type { Metadata } from "next";
import Link from "next/link";
import { paypalMode } from "@/lib/paypal";
import "./globals.css";

export const metadata: Metadata = {
  title: "SplitSense — one payment, split correctly",
  description:
    "A creator payment arrives once. SplitSense reads the deal, splits it across collaborators and tax, and pays everyone through PayPal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const mode = paypalMode();

  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="brand" aria-label="SplitSense home">
              <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
                <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M16 16V4a12 12 0 0 1 10.4 6z" fill="currentColor" />
                <path d="M16 16l-6-10.4A12 12 0 0 0 4 16z" fill="currentColor" opacity=".45" />
              </svg>
              <span className="brand-text">
                Split<span>Sense</span>
              </span>
            </Link>
            <nav className="header-nav" aria-label="Main">
              <Link href="/#deals">Deals</Link>
              <Link href="/#how">How it works</Link>
              <Link href="/deals/new">New split</Link>
            </nav>
            <div className="header-actions">
              <span className={`mode-chip ${mode === "live" ? "mode-live" : "mode-mock"}`}>
                <span className="mode-dot" />
                {mode === "live" ? "PayPal sandbox" : "Demo mode"}
              </span>
              <Link href="/deals/new" className="btn btn-primary btn-sm">
                Split a payment
              </Link>
            </div>
          </div>
        </header>

        {children}

        <footer className="site-footer">
          <div className="container footer-inner">
            <p>SplitSense — one payment, split correctly. Built for the PayPal AI Hackathon.</p>
            <p className="footer-fine">
              MIT · AI reads the rules; the server does the math; a human confirms · Reconciliation by
              AG Grid
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
