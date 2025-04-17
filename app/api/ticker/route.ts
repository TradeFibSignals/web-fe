import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { fetchBinanceTicker } from "@/lib/binance-api";

export async function GET(request: NextRequest) {
  try {
    // Get the symbol parameter from the URL
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get("symbol");

    // Validate that a symbol was provided
    if (!symbol) {
      return NextResponse.json({ error: "Symbol parameter is required" }, { status: 400 });
    }

    try {
      // Fetch ticker data from Binance
      const tickerData = await fetchBinanceTicker(symbol);

      // Format response in standardized structure
      const response = {
        symbol: tickerData.symbol,
        price: tickerData.lastPrice,
        priceChangePercent: tickerData.priceChangePercent,
        volume: tickerData.quoteVolume || tickerData.volume,
        high24h: tickerData.highPrice,
        low24h: tickerData.lowPrice,
        source: "binance-api",
        timestamp: Date.now()
      };

      // Return the formatted ticker data
      return NextResponse.json(response);
    } catch (error) {
      console.error(`Error fetching ticker data for ${symbol}:`, error);
      return NextResponse.json({ 
        error: "Failed to fetch ticker data", 
        details: error instanceof Error ? error.message : String(error) 
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error in ticker API route:", error);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
