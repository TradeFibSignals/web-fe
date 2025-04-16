import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-client"
import * as signalGeneratorService from "@/lib/signal-generator-service"

// Function to validate API key
const validateApiKey = (request: NextRequest) => {
  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false
  }

  const apiKey = authHeader.substring(7) // Remove 'Bearer ' from header
  const validApiKey = process.env.SIGNAL_GENERATOR_API_KEY

  return apiKey === validApiKey
}

export async function POST(request: NextRequest) {
  // Authenticate the request
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get timeframe from query params
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get("timeframe")

    if (!timeframe) {
      return NextResponse.json({ error: "Timeframe parameter is required" }, { status: 400 })
    }

    // Verify valid timeframe
    const validTimeframes = ["5m", "15m", "30m", "1h"]
    if (!validTimeframes.includes(timeframe)) {
      return NextResponse.json({ error: "Invalid timeframe. Must be one of: 5m, 15m, 30m, 1h" }, { status: 400 })
    }

    // Initialize Supabase client
    const supabase = createClient()

    // Generate signals for the specified timeframe
    const result = await signalGeneratorService.generateSignalsForTimeframe(timeframe, supabase)

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

export async function GET(request: NextRequest) {
  // Authenticate the request
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get timeframe from query params
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get("timeframe")

    // If no timeframe, just return a status message
    if (!timeframe) {
      return NextResponse.json({ 
        message: "Signal generator API is running. Use with timeframe parameter to check signals." 
      })
    }

    // Verify valid timeframe
    const validTimeframes = ["5m", "15m", "30m", "1h"]
    if (!validTimeframes.includes(timeframe)) {
      return NextResponse.json({ error: "Invalid timeframe. Must be one of: 5m, 15m, 30m, 1h" }, { status: 400 })
    }

    // Initialize Supabase client
    const supabase = createClient()

    // Check signals for the specified timeframe
    await signalGeneratorService.checkAndUpdateSignalStatuses(timeframe)

    return NextResponse.json({
      success: true,
      message: `Signals checked and updated for timeframe: ${timeframe}`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error checking signals:", error)
    return NextResponse.json(
      {
        error: "Failed to check signals",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
