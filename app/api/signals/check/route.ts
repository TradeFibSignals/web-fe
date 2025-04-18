import { NextResponse } from "next/server"
import { type NextRequest } from "next/server"
import * as signalGeneratorService from "@/lib/signal-generator-service"
import { supabase } from "@/lib/supabase-client"

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

export async function GET(request: NextRequest) {
  // Authenticate the request
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  try {
    // Get timeframe and pair from query params
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get("timeframe")
    const pair = searchParams.get("pair")
    
    // Validate timeframe if provided
    if (timeframe) {
      const validTimeframes = ["5m", "15m", "30m", "1h"]
      if (!validTimeframes.includes(timeframe)) {
        return NextResponse.json({ error: "Invalid timeframe. Must be one of: 5m, 15m, 30m, 1h" }, { status: 400 })
      }
    }
    
    // Check if Supabase client is available
    if (!supabase) {
      return NextResponse.json({ error: "Supabase client not available" }, { status: 500 })
    }
    
    // Start time for performance tracking
    const startTime = Date.now()
    
    // Call the function to check and update signal statuses
    // Pass the pair parameter if provided
    const result = await signalGeneratorService.checkAndUpdateSignalStatuses(timeframe || undefined, pair || undefined)
    
    // Calculate execution time
    const executionTime = Date.now() - startTime
    
    return NextResponse.json({
      success: true,
      message: `Signals checked and updated${timeframe ? ` for timeframe: ${timeframe}` : ''}${pair ? ` and pair: ${pair}` : ''}`,
      result,
      executionTime,
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
