import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase-client"

export async function POST(request: Request) {
  try {
    const signal = await request.json()

    if (!supabase) {
      return NextResponse.json({ error: "Supabase client not available" }, { status: 500 })
    }

    const { error } = await supabase.from("completed_signals").insert({
      signal_id: crypto.randomUUID(),
      signal_type: signal.type,
      entry_price: signal.entry,
      stop_loss: signal.stopLoss,
      take_profit: signal.takeProfit,
      exit_price: signal.exitPrice,
      exit_type: signal.exitType,
      entry_time: signal.entryTime,
      exit_time: signal.exitTime,
      pair: signal.pair,
      timeframe: signal.timeframe,
      profit_loss: signal.profitLoss,
      profit_loss_percent: signal.profitLossPercent,
      risk_reward_ratio: signal.riskRewardRatio,
      signal_source: signal.source,
      notes: signal.notes || null,
    })

    if (error) {
      console.error("Error saving completed signal:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error processing request:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
