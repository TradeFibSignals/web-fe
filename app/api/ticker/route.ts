import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get symbol from query parameters
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol') || 'BTCUSDT';

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
        const url = `${endpoint}/ticker/price?symbol=${symbol}`;
        console.log(`Attempting to fetch from: ${url}`);
        
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          next: { revalidate: 10 } // Cache for 10 seconds
        });

        if (res.ok) {
          const data = await res.json();
          response = {
            symbol: data.symbol,
            price: data.price,
            priceChangePercent: "0.00", // Default value as ticker endpoint doesn't include this
            source: endpoint
          };
          break;
        }
      } catch (fetchError) {
        error = fetchError;
        console.error(`Error fetching from ${endpoint}:`, fetchError);
      }
    }

    if (response) {
      return NextResponse.json(response);
    }

    // If all endpoints failed, try to get 24hr ticker for more data
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        next: { revalidate: 30 } // Cache for 30 seconds
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({
          symbol: data.symbol,
          price: data.lastPrice,
          priceChangePercent: data.priceChangePercent,
          volume: data.volume,
          source: 'api.binance.com/24hr'
        });
      }
    } catch (fallbackError) {
      console.error('Error in fallback endpoint:', fallbackError);
    }

    // Return error if all attempts failed
    return NextResponse.json(
      { error: 'Failed to fetch data from all endpoints', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  } catch (error) {
    console.error('Error in ticker API:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
