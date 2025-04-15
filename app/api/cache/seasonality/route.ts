import { NextResponse } from "next/server"
import {
  getMonthlyAverages,
  getMonthlyPositiveProb,
  getMonthlyStats,
  invalidateSeasonalityCache,
} from "@/lib/seasonality-cache"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const action = url.searchParams.get("action")

    if (action === "invalidate") {
      // Invalidate all seasonality caches
      await invalidateSeasonalityCache()
      return NextResponse.json({ success: true, message: "Seasonality cache invalidated" })
    }

    // Warm up the cache by pre-calculating values
    const averages = await getMonthlyAverages()
    const probabilities = await getMonthlyPositiveProb()

    // Warm up monthly stats for all months
    const monthlyStats = []
    for (let month = 0; month < 12; month++) {
      const stats = await getMonthlyStats(month)
      monthlyStats.push(stats)
    }

    return NextResponse.json({
      success: true,
      message: "Seasonality data calculated",
      data: {
        averagesCount: Object.keys(averages).length,
        probabilitiesCount: Object.keys(probabilities).length,
        monthlyStatsCount: monthlyStats.length,
      },
    })
  } catch (error) {
    console.error("Error calculating seasonality data:", error)
    return NextResponse.json({ success: false, error: "Failed to calculate data" }, { status: 500 })
  }
}
