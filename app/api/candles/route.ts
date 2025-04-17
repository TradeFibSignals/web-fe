import { NextResponse } from "next/server"
import { type NextRequest } from "next/server"
import { fetchKlines, timeframeToInterval } from "@/lib/binance-api"

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const symbol = searchParams.get("symbol")
    const interval = searchParams.get("interval")
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit") as string) : 100
    const endTime = searchParams.get("endTime") ? parseInt(searchParams.get("endTime") as string) : undefined
    
    // Validate required parameters
    if (!symbol) {
      return NextResponse.json({ error: "Symbol parameter is required" }, { status: 400 })
    }
    
    if (!interval) {
      return NextResponse.json({ error: "Interval parameter is required" }, { status: 400 })
    }
    
    try {
      // Fetch candle data from Binance API
      const candles = await fetchKlines(interval, limit, endTime, symbol)
      
      // Return the candle data
      return NextResponse.json(candles)
    } catch (error) {
      console.error(`Error fetching candles for ${symbol} ${interval}:`, error)
      return NextResponse.json({ 
        error: "Failed to fetch candle data", 
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500 })
    }
  } catch (error) {
    console.error("Error in candles API route:", error)
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 })
  }
}
