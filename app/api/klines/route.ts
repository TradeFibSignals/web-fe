import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get parameters from query
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol') || 'BTCUSDT';
    const interval = searchParams.get('interval') || '15m';
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    // List of endpoints to try
    const endpoints = [
      'https://data-api.binance.vision/api/v3',
      'https://api.binance.com/api/v3',
      'https://api1.binance.com/api/v3',
      'https://fapi.binance.com/fapi/v1'
    ];

    let response = null;
    let error = null;

    // Try each endpoint until one succeeds
    for (const endpoint of endpoints) {
      try {
        // Build URL with parameters
        const url = `${endpoint}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        console.log(`Attempting to fetch klines from: ${url}`);
        
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          next: { revalidate: 30 } // Cache for 30 seconds
        });

        if (res.ok) {
          const data = await res.json();
          
          // Transform to our format
          const candles = data.map((item: any) => ({
            time: Math.floor(item[0] / 1000), // Convert milliseconds to seconds
            open: parseFloat(item[1]),
            high: parseFloat(item[2]),
            low: parseFloat(item[3]),
            close: parseFloat(item[4]),
            volume: parseFloat(item[5])
          }));
          
          return NextResponse.json({
            symbol,
            interval,
            candles,
            source: endpoint
          });
        }
      } catch (fetchError) {
        error = fetchError;
        console.error(`Error fetching klines from ${endpoint}:`, fetchError);
      }
    }

    // Return error if all attempts failed
    return NextResponse.json(
      { error: 'Failed to fetch klines from all endpoints', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  } catch (error) {
    console.error('Error in klines API:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
