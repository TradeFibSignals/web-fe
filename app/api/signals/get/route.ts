import { NextResponse } from "next/server"
import { getSignalsFromCache } from "@/lib/signal-generator-service"

export async function GET(request: Request) {
  try {
    // Získání parametrů z URL
    const url = new URL(request.url)
    const pair = url.searchParams.get("pair")
    const timeframe = url.searchParams.get("timeframe")

    // Validace parametrů
    if (!pair || !timeframe) {
      return NextResponse.json({ error: "Pair and timeframe are required" }, { status: 400 })
    }

    // Validace timeframe
    const validTimeframes = ["5m", "15m", "30m", "1h"]
    if (!validTimeframes.includes(timeframe)) {
      return NextResponse.json({ error: "Invalid timeframe" }, { status: 400 })
    }

    // Získání signálů z cache
    const signals = await getSignalsFromCache(pair, timeframe)

    return NextResponse.json({
      success: true,
      signals,
    })
  } catch (error) {
    console.error("Error getting signals:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
