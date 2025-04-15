import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Footer } from "@/components/footer"
import { HeaderNav } from "@/components/header-nav"

export const metadata = {
  title: "Terms of Service - BTC Market Today",
  description: "Terms of Service for the BTC Market Today platform",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#1a1f2e] flex flex-col">
      <HeaderNav />
      <div className="container mx-auto px-4 py-8 flex-grow">
        <div className="mb-6">
          <Link href="/">
            <Button variant="outline" size="sm" className="mb-6">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
        </div>

        <div className="prose prose-invert max-w-none">
          <p className="text-lg text-muted-foreground mb-6">Last updated: {new Date().toLocaleDateString()}</p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using the BTC Market Today platform ("Service"), you agree to be bound by these Terms of
            Service. If you disagree with any part of the terms, you may not access the Service.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            BTC Market Today provides cryptocurrency market analysis, liquidation data visualization, and trading
            signals. The Service is provided "as is" and "as available" without warranties of any kind.
          </p>

          <h2>3. Use of the Service</h2>
          <p>
            You agree to use the Service only for lawful purposes and in accordance with these Terms. You are prohibited
            from:
          </p>
          <ul>
            <li>Using the Service for any illegal activity</li>
            <li>Attempting to gain unauthorized access to any portion of the Service</li>
            <li>Interfering with or disrupting the Service or servers</li>
            <li>Scraping or collecting data from the Service without explicit permission</li>
            <li>Using the Service to transmit malware or other harmful code</li>
          </ul>

          <h2>4. Financial Disclaimer</h2>
          <p>
            The information provided by the Service is for informational purposes only and does not constitute financial
            advice. Trading cryptocurrencies involves significant risk. You should always conduct your own research and
            consult with a qualified financial advisor before making any investment decisions.
          </p>

          <h2>5. Intellectual Property</h2>
          <p>
            The Service and its original content, features, and functionality are owned by BTC Market Today and are
            protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
          </p>

          <h2>6. Limitation of Liability</h2>
          <p>
            In no event shall BTC Market Today, its directors, employees, partners, agents, suppliers, or affiliates be
            liable for any indirect, incidental, special, consequential, or punitive damages, including without
            limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to
            or use of or inability to access or use the Service.
          </p>

          <h2>7. Changes to Terms</h2>
          <p>
            We reserve the right to modify or replace these Terms at any time. If a revision is material, we will
            provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change
            will be determined at our sole discretion.
          </p>

          <h2>8. Contact Us</h2>
          <p>If you have any questions about these Terms, please contact us at contact@btcintradaypredictor.com.</p>
        </div>
      </div>
      <Footer />
    </div>
  )
}
