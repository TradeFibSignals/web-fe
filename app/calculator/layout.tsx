import type React from "react"
import { HeaderNav } from "@/components/header-nav"
import { Footer } from "@/components/footer"

export default function CalculatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#1a1f2e]">
      <HeaderNav />
      <div className="container mx-auto px-4 py-6">{children}</div>
      <Footer />
    </div>
  )
}
