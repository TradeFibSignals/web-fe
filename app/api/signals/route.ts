import { NextResponse } from "next/server"
import { getSignalsFromCache } from "@/lib/signal-generator-service"
import { supabase } from "@/lib/supabase-client"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const pair = url.searchParams.get("pair")
    const timeframe = url.searchParams.get("timeframe")
    const status = url.searchParams.get("status") || "active"
    const limit = Number.parseInt(url.searchParams.get("limit") || "10")
    const offset = Number.parseInt(url.searchParams.get("offset") || "0")

    if (!pair || !timeframe) {
      return NextResponse.json({ error: "Missing required parameters: pair and timeframe" }, { status: 400 })
    }

    // Pokud požadujeme aktivní signály, zkusíme je získat z cache
    if (status === "active") {
      const cachedSignals = await getSignalsFromCache(pair, timeframe)

      if (cachedSignals.length > 0) {
        return NextResponse.json({
          success: true,
          data: cachedSignals,
          source: "cache",
        })
      }
    }

    // Pokud nejsou v cache nebo požadujeme jiný status, získáme je přímo z databáze
    let query = supabase
      .from("generated_signals")
      .select("*")
      .eq("pair", pair)
      .eq("timeframe", timeframe)
      .order("created_at", { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1)

    if (status !== "all") {
      query = query.eq("status", status)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching signals:", error)
      return NextResponse.json({ error: "Failed to fetch signals" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      source: "database",
    })
  } catch (error) {
    console.error("Error processing request:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
