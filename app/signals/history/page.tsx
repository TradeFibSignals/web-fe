import { SignalsHistory } from "@/components/signals-history"
import { HeaderNav } from "@/components/header-nav"
import { Footer } from "@/components/footer"

export const metadata = {
  title: "Signal History & Statistics | BTC Market Today",
  description: "View your trading signal history and performance statistics",
}

export default function SignalsHistoryPage() {
  return (
    <div className="min-h-screen bg-[#1a1f2e]">
      <HeaderNav />
      <div className="container mx-auto px-4 py-6">
        <SignalsHistory />
      </div>
      <Footer />
    </div>
  )
}
