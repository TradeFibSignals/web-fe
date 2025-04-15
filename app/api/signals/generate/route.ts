import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-client"
import { generateSignalsForTimeframe } from "@/lib/signal-generator-service"

// Funkce pro ověření API klíče
const validateApiKey = (request: NextRequest) => {
  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false
  }

  const apiKey = authHeader.substring(7) // Odstranění 'Bearer ' z hlavičky
  const validApiKey = process.env.SIGNAL_GENERATOR_API_KEY

  return apiKey === validApiKey
}

export async function POST(request: NextRequest) {
  // Ověření API klíče
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Získání timeframe z query parametrů
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get("timeframe")

    if (!timeframe) {
      return NextResponse.json({ error: "Timeframe parameter is required" }, { status: 400 })
    }

    // Ověření platného timeframe
    const validTimeframes = ["5m", "15m", "30m", "1h"]
    if (!validTimeframes.includes(timeframe)) {
      return NextResponse.json({ error: "Invalid timeframe. Must be one of: 5m, 15m, 30m, 1h" }, { status: 400 })
    }

    // Inicializace Supabase klienta
    const supabase = createClient()

    // Generování signálů pro daný timeframe
    const result = await generateSignalsForTimeframe(timeframe, supabase)

    return NextResponse.json({
      success: true,
      message: `Signals generated successfully for timeframe: ${timeframe}`,
      data: result,
    })
  } catch (error) {
    console.error("Error generating signals:", error)
    return NextResponse.json(
      {
        error: "Failed to generate signals",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({ message: "Signal generator API is running. Use POST method to generate signals." })
}
