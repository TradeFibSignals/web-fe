import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { testBinanceEndpoints } from "@/lib/binance-api"

export async function GET(request: NextRequest) {
  try {
    // Perform the endpoint tests
    const testResults = await testBinanceEndpoints();
    
    // Return the results
    return NextResponse.json({
      success: true,
      message: "Endpoint test completed successfully",
      bestEndpoint: testResults.bestEndpoint,
      results: testResults.endpointStats
    });
  } catch (error) {
    console.error("Error testing endpoints:", error);
    return NextResponse.json(
      {
        error: "Failed to test endpoints",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
