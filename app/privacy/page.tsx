import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Footer } from "@/components/footer"
import { HeaderNav } from "@/components/header-nav"

export const metadata = {
  title: "Privacy Policy - BTC Market Today",
  description: "Privacy Policy for the BTC Market Today platform",
}

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        </div>

        <div className="prose prose-invert max-w-none">
          <p className="text-lg text-muted-foreground mb-6">Last updated: {new Date().toLocaleDateString()}</p>

          <h2>1. Introduction</h2>
          <p>
            BTC Market Today ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy
            explains how we collect, use, disclose, and safeguard your information when you use our cryptocurrency
            analysis platform.
          </p>

          <h2>2. Information We Collect</h2>
          <p>We may collect information about you in various ways, including:</p>
          <ul>
            <li>
              <strong>Usage Data:</strong> Information on how you access and use our Service, including your IP address,
              browser type, pages viewed, time spent on pages, and referring website address.
            </li>
            <li>
              <strong>Device Data:</strong> Information about your device, such as device type, operating system, and
              browser.
            </li>
            <li>
              <strong>Cookies and Similar Technologies:</strong> We use cookies and similar tracking technologies to
              track activity on our Service and hold certain information.
            </li>
          </ul>

          <h2>3. How We Use Your Information</h2>
          <p>We may use the information we collect for various purposes, including:</p>
          <ul>
            <li>To provide and maintain our Service</li>
            <li>To improve our Service and user experience</li>
            <li>To monitor usage of our Service</li>
            <li>To detect, prevent, and address technical issues</li>
            <li>To comply with legal obligations</li>
          </ul>

          <h2>4. Disclosure of Your Information</h2>
          <p>We may share your information in the following situations:</p>
          <ul>
            <li>
              <strong>With Service Providers:</strong> We may share your information with third-party vendors, service
              providers, and other third parties who perform services for us.
            </li>
            <li>
              <strong>For Business Transfers:</strong> We may share or transfer your information in connection with, or
              during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion
              of our business.
            </li>
            <li>
              <strong>With Your Consent:</strong> We may disclose your information for any other purpose with your
              consent.
            </li>
            <li>
              <strong>Legal Requirements:</strong> We may disclose your information where required to do so by law or in
              response to valid requests by public authorities.
            </li>
          </ul>

          <h2>5. Security of Your Information</h2>
          <p>
            We use administrative, technical, and physical security measures to protect your personal information.
            However, no method of transmission over the Internet or electronic storage is 100% secure, so we cannot
            guarantee absolute security.
          </p>

          <h2>6. Your Data Protection Rights</h2>
          <p>Depending on your location, you may have certain rights regarding your personal information, such as:</p>
          <ul>
            <li>The right to access, update, or delete your information</li>
            <li>The right to rectification if your information is inaccurate or incomplete</li>
            <li>The right to object to our processing of your personal information</li>
            <li>The right to request restriction of processing of your personal information</li>
            <li>The right to data portability</li>
          </ul>

          <h2>7. Changes to This Privacy Policy</h2>
          <p>
            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new
            Privacy Policy on this page and updating the "Last updated" date.
          </p>

          <h2>8. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at contact@btcintradaypredictor.com.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  )
}
