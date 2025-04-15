import { SeasonalityHeatmap } from "@/components/seasonality-heatmap"
import { MonthlySeasonalityDetail } from "@/components/monthly-seasonality-detail"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { HeaderNav } from "@/components/header-nav"

export default function SeasonalityPage() {
  return (
    <div className="min-h-screen bg-[#1a1f2e]">
      <HeaderNav />
      <div className="p-4">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center">
            <Link href="/">
              <Button variant="outline" size="sm" className="mr-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Bitcoin Seasonality Analysis</h1>
          </div>

          <div className="grid gap-6">
            {/* Current month detail */}
            <div className="bg-[#1e2538] rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Current Month Performance</h2>
              <MonthlySeasonalityDetail />
            </div>

            {/* Heatmap for all months */}
            <div className="bg-[#1e2538] rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Annual Seasonality Heatmap</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Click on any month to view detailed historical performance
              </p>
              <SeasonalityHeatmap />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
