// WebSocket service for real-time price updates

type WebSocketCallback = (data: any) => void

export interface CandleData {
  open: number
  high: number
  low: number
  close: number
  time: number
  volume?: number
}

class BinanceWebSocketService {
  private socket: WebSocket | null = null
  private callbacks: Map<string, WebSocketCallback[]> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 3000 // 3 seconds
  private isConnecting = false

  // Connect to Binance WebSocket
  connect(symbol: string): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      console.log("WebSocket already connected or connecting")
      return
    }

    if (this.isConnecting) {
      console.log("WebSocket connection in progress")
      return
    }

    this.isConnecting = true

    try {
      // Use Binance Futures WebSocket endpoint for perpetual contracts
      this.socket = new WebSocket(`wss://fstream.binance.com/ws/${symbol.toLowerCase()}@ticker`)

      this.socket.onopen = () => {
        console.log("WebSocket connected")
        this.reconnectAttempts = 0
        this.isConnecting = false
      }

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          const eventType = data.e // Event type from Binance

          // Dispatch to all registered callbacks for this event type
          if (this.callbacks.has(eventType)) {
            this.callbacks.get(eventType)?.forEach((callback) => callback(data))
          }

          // Also dispatch to general callbacks
          if (this.callbacks.has("message")) {
            this.callbacks.get("message")?.forEach((callback) => callback(data))
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error)
        }
      }

      this.socket.onclose = (event) => {
        console.log(`WebSocket closed: ${event.code} ${event.reason}`)
        this.isConnecting = false

        // Attempt to reconnect if not closed cleanly
        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
          setTimeout(() => this.connect(symbol), this.reconnectDelay)
        }
      }

      this.socket.onerror = (error) => {
        console.error("WebSocket error:", error)
        this.isConnecting = false
      }
    } catch (error) {
      console.error("Error creating WebSocket:", error)
      this.isConnecting = false
    }
  }

  // Disconnect from WebSocket
  disconnect(): void {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
  }

  // Subscribe to WebSocket events
  subscribe(eventType: string, callback: WebSocketCallback): void {
    if (!this.callbacks.has(eventType)) {
      this.callbacks.set(eventType, [])
    }
    this.callbacks.get(eventType)?.push(callback)
  }

  // Unsubscribe from WebSocket events
  unsubscribe(eventType: string, callback: WebSocketCallback): void {
    if (this.callbacks.has(eventType)) {
      const callbacks = this.callbacks.get(eventType) || []
      const index = callbacks.indexOf(callback)
      if (index !== -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  // Check if WebSocket is connected
  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN
  }
}

// Create a singleton instance
export const binanceWebSocket = new BinanceWebSocketService()

// Function to test different Binance endpoints and find the most reliable one
export async function testBinanceEndpoints() {
  // Define endpoints to test - prioritize production endpoints
  const endpoints = [
    {
      name: "binance-api-v3",
      url: "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=1",
    },
    {
      name: "binance-spot-v3",
      url: "https://api3.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=1",
    },
    {
      name: "binance-futures-fapi-v1",
      url: "https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=1",
    },
    {
      name: "binance-futures-dapi-v1", // Lowest priority
      url: "https://dapi.binance.com/dapi/v1/klines?symbol=BTCUSD_PERP&interval=1h&limit=1",
    }
  ];

  const endpointStats: Record<string, any> = {};
  let bestEndpoint = null;
  let bestResponseTime = Number.MAX_SAFE_INTEGER;
  let allFailed = true;

  // Test each endpoint
  for (const endpoint of endpoints) {
    try {
      const startTime = Date.now();
      
      const response = await fetch(endpoint.url, {
        method: "GET",
        headers: {
          "User-Agent": "TradeFibSignals/1.0.0",
        },
        timeout: 5000 // 5 second timeout
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      if (response.ok) {
        // Store successful endpoint stats
        endpointStats[endpoint.name] = {
          name: endpoint.name,
          success: true,
          responseTime
        };

        // Check if this is the fastest endpoint
        if (responseTime < bestResponseTime) {
          bestResponseTime = responseTime;
          bestEndpoint = endpoint.name;
          allFailed = false;
        }

        console.log(`Endpoint ${endpoint.name} succeeded in ${responseTime}ms`);
      } else {
        endpointStats[endpoint.name] = {
          name: endpoint.name,
          success: false,
          responseTime,
          errorMessage: `HTTP error ${response.status}: ${response.statusText}`
        };
        console.log(`Endpoint ${endpoint.name} failed with status ${response.status}`);
      }
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      endpointStats[endpoint.name] = {
        name: endpoint.name,
        success: false,
        responseTime,
        errorMessage: error instanceof Error ? error.message : "Unknown error"
      };
      console.log(`Endpoint ${endpoint.name} error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  // If all endpoints failed, use the first one as default
  if (allFailed && Object.keys(endpointStats).length > 0) {
    bestEndpoint = endpoints[0].name;
  }

  return {
    bestEndpoint,
    endpointStats
  };
}

// Function to get the best Binance endpoint URL
export function getBestBinanceEndpoint(endpointName: string): string {
  // Map endpoint names to base URLs
  const endpointMap: Record<string, string> = {
    "binance-api-v3": "https://api.binance.com",
    "binance-spot-v3": "https://api3.binance.com",
    "binance-futures-fapi-v1": "https://fapi.binance.com",
    "binance-futures-dapi-v1": "https://dapi.binance.com"
  };

  // Return the base URL for the given endpoint name, or default to binance-api-v3
  return endpointMap[endpointName] || "https://api.binance.com";
}

// Function to fetch available perpetual pairs from Binance
export async function fetchAvailablePairs(): Promise<string[]> {
  try {
    // Try api3.binance.com first - this is often the most reliable for geo-restricted regions
    let response = await fetch("https://api3.binance.com/api/v3/exchangeInfo", {
      headers: {
        'User-Agent': 'TradeFibSignals/1.0.0',
      },
      timeout: 10000
    });

    // If that fails, try the regular API endpoint
    if (!response.ok) {
      response = await fetch("https://api.binance.com/api/v3/exchangeInfo", {
        headers: {
          'User-Agent': 'TradeFibSignals/1.0.0',
        },
        timeout: 10000
      });
    }

    // If regular endpoint also fails, try the futures API
    if (!response.ok) {
      response = await fetch("https://fapi.binance.com/fapi/v1/exchangeInfo", {
        headers: {
          'User-Agent': 'TradeFibSignals/1.0.0',
        },
        timeout: 10000
      });
    }

    const data = await response.json();
    
    if (!data || !data.symbols || !Array.isArray(data.symbols)) {
      console.error("Invalid response format from Binance API:", data);
      return [];
    }

    // Extract USDT perpetual pairs
    const pairs = data.symbols
      .filter(
        (symbol: any) =>
          symbol.status === "TRADING" && 
          (symbol.quoteAsset === "USDT" || (symbol.contractType === "PERPETUAL" && symbol.quoteAsset === "USDT"))
      )
      .map((symbol: any) => symbol.symbol)

    return pairs
  } catch (error) {
    console.error("Error fetching available pairs:", error)
    return []
  }
}

export async function fetchBinanceData(
  timeframe: string,
  symbol = "BTCUSDT",
  priceDataOnly = false,
): Promise<{
  liquidationData: any[]
  priceData: any[]
  currentPrice: number
  priceChangePercent: number
}> {
  try {
    // Get current time and calculate start time (1 day ago)
    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000 // 1 day in milliseconds

    // Fetch current price and 24h change - try api3.binance.com first
    let tickerResponse = await fetch(`https://api3.binance.com/api/v3/ticker/24hr?symbol=${symbol}`, {
      headers: {
        'User-Agent': 'TradeFibSignals/1.0.0',
      },
      timeout: 10000
    });

    // If that fails, try regular endpoint
    if (!tickerResponse.ok) {
      tickerResponse = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`, {
        headers: {
          'User-Agent': 'TradeFibSignals/1.0.0',
        },
        timeout: 10000
      });
    }

    // If that fails, try futures API
    if (!tickerResponse.ok) {
      tickerResponse = await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`, {
        headers: {
          'User-Agent': 'TradeFibSignals/1.0.0',
        },
        timeout: 10000
      });
    }

    const tickerData = await tickerResponse.json()
    const currentPrice = Number.parseFloat(tickerData.lastPrice)
    const priceChangePercent = Number.parseFloat(tickerData.priceChangePercent)

    // Determine appropriate kline interval based on timeframe
    // For each timeframe, we want enough data points to create a good chart
    let interval: string
    let limit: number

    switch (timeframe) {
      case "5m":
        interval = "5m"
        limit = 288 // 5 minutes × 288 = 1 day
        break
      case "15m":
        interval = "15m"
        limit = 96 // 15 minutes × 96 = 1 day
        break
      case "30m":
        interval = "30m"
        limit = 48 // 30 minutes × 48 = 1 day
        break
      case "1h":
        interval = "1h"
        limit = 24 // 1 hour × 24 = 1 day
        break
      default:
        interval = "15m"
        limit = 96
    }

    // Fetch kline/candlestick data for price chart - try api3.binance.com first
    let klinesResponse = await fetch(
      `https://api3.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${oneDayAgo}&limit=${limit}`,
      {
        headers: {
          'User-Agent': 'TradeFibSignals/1.0.0',
        },
        timeout: 10000
      }
    );

    // If that fails, try regular endpoint
    if (!klinesResponse.ok) {
      klinesResponse = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${oneDayAgo}&limit=${limit}`,
        {
          headers: {
            'User-Agent': 'TradeFibSignals/1.0.0',
          },
          timeout: 10000
        }
      );
    }

    // If that fails, try futures API
    if (!klinesResponse.ok) {
      klinesResponse = await fetch(
        `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&startTime=${oneDayAgo}&limit=${limit}`,
        {
          headers: {
            'User-Agent': 'TradeFibSignals/1.0.0',
          },
          timeout: 10000
        }
      );
    }

    const klinesData = await klinesResponse.json()

    const priceData: { time: number; price: number }[] = klinesData.map((kline: any) => ({
      time: kline[0], // Open time
      price: Number.parseFloat(kline[4]), // Close price
    }))

    // If we only need price data, return early
    if (priceDataOnly) {
      return {
        liquidationData: [], // Empty array as we're not generating new liquidation data
        priceData,
        currentPrice,
        priceChangePercent,
      }
    }

    // Generate liquidation data based on real price levels
    // Since Binance doesn't provide a public API for liquidation data,
    // we'll generate synthetic data but based on real price ranges

    // Find min and max price from real data
    const prices = priceData.map((d) => d.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)

    // Calculate price range for liquidation levels
    const priceRange = maxPrice - minPrice
    const longLiquidationCenter = currentPrice * 0.95 // 5% below current price
    const shortLiquidationCenter = currentPrice * 1.05 // 5% above current price

    // Generate liquidation data with consistent seed for the same symbol and timeframe
    const liquidationData = generateLiquidationData(
      priceData,
      currentPrice,
      longLiquidationCenter,
      shortLiquidationCenter,
      symbol,
      timeframe,
    )

    return {
      liquidationData,
      priceData,
      currentPrice,
      priceChangePercent,
    }
  } catch (error) {
    console.error(`Error fetching data for ${symbol} from Binance:`, error)
    throw error
  }
}

// Simple hash function for string
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

// Generate synthetic liquidation data based on real price levels
function generateLiquidationData(
  priceData: { time: number; price: number }[],
  currentPrice: number,
  longLiquidationCenter: number,
  shortLiquidationCenter: number,
  symbol: string,
  timeframe: string,
): { price: number; volume: number; time: number; type: "long" | "short" }[] {
  const liquidationData: { price: number; volume: number; time: number; type: "long" | "short" }[] = []

  // Use consistent seed for the same symbol and timeframe
  const seedKey = `${symbol}-${timeframe}`
  const seedCache: Record<string, number> = {}
  if (!seedCache[seedKey]) {
    seedCache[seedKey] = hashString(seedKey)
  }
  const seed = seedCache[seedKey]

  // Pseudo-random number generator with seed
  const seededRandom = (min: number, max: number, index: number): number => {
    const x = Math.sin(seed + index) * 10000
    const rand = x - Math.floor(x)
    return min + rand * (max - min)
  }

  // Find time range from price data
  const times = priceData.map((d) => d.time)
  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)

  // Calculate price volatility to adjust liquidation spread
  const prices = priceData.map((d) => d.price)
  const maxPrice = Math.max(...prices)
  const minPrice = Math.min(...prices)
  const priceRange = maxPrice - minPrice
  const volatilityFactor = priceRange / currentPrice // Normalized volatility

  // Adjust liquidation spreads based on volatility (min 2%, max 10%)
  const spreadFactor = Math.max(0.02, Math.min(0.1, volatilityFactor * 2))

  // Generate long liquidations (below current price)
  const longLiquidationSpread = currentPrice * spreadFactor

  for (let i = 0; i < 50; i++) {
    const price = longLiquidationCenter + seededRandom(-1, 1, i) * longLiquidationSpread
    const volume = seededRandom(0.5, 5.5, i + 100) // 0.5-5.5 units
    const time = minTime + seededRandom(0, 1, i + 200) * (maxTime - minTime)

    liquidationData.push({
      price,
      volume,
      time,
      type: "long",
    })
  }

  // Generate short liquidations (above current price)
  const shortLiquidationSpread = currentPrice * spreadFactor

  for (let i = 0; i < 50; i++) {
    const price = shortLiquidationCenter + seededRandom(-1, 1, i + 300) * shortLiquidationSpread
    const volume = seededRandom(0.5, 5.5, i + 400) // 0.5-5.5 units
    const time = minTime + seededRandom(0, 1, i + 500) * (maxTime - minTime)

    liquidationData.push({
      price,
      volume,
      time,
      type: "short",
    })
  }

  return liquidationData
}

// Updated fetchTimeframeCandles to prioritize api3.binance.com and handle errors better
export async function fetchTimeframeCandles(symbol: string, timeframe: string, limit = 20): Promise<CandleData[]> {
  // Track retries
  let retries = 0;
  const maxRetries = 3;
  const retryDelay = 1000; // ms
  
  while (retries <= maxRetries) {
    try {
      // Map timeframe to Binance interval format
      let interval: string
      switch (timeframe) {
        case "1d":
          interval = "1d"
          break
        case "1M":
          interval = "1M"
          break
        default:
          interval = timeframe
      }

      // Log each attempt for debugging
      console.log(`Fetching candles for ${symbol} on ${timeframe} (${interval}), attempt ${retries + 1}/${maxRetries + 1}`)
      
      // Try api3.binance.com first (this is the most reliable for avoiding geo-restrictions)
      let url = `https://api3.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
      console.log(`Requesting URL: ${url}`);
      
      let response = await fetch(url, {
        headers: {
          'User-Agent': 'TradeFibSignals/1.0.0',
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 seconds timeout
      });
      
      // If api3 endpoint fails, try regular API
      if (!response.ok) {
        console.log(`API3 endpoint failed with status ${response.status}, trying regular API as fallback`);
        url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        console.log(`Requesting URL: ${url}`);
        
        response = await fetch(url, {
          headers: {
            'User-Agent': 'TradeFibSignals/1.0.0',
            'Accept': 'application/json'
          },
          timeout: 10000 // 10 seconds timeout
        });
      }
      
      // If regular API fails, try futures API
      if (!response.ok) {
        console.log(`Regular API failed with status ${response.status}, trying futures API as fallback`);
        url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        console.log(`Requesting URL: ${url}`);
        
        response = await fetch(url, {
          headers: {
            'User-Agent': 'TradeFibSignals/1.0.0',
            'Accept': 'application/json'
          },
          timeout: 10000 // 10 seconds timeout
        });
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch ${timeframe} candles: ${response.status} - ${errorText}`)
      }

      const data = await response.json()

      // Additional validation of data format
      if (!Array.isArray(data)) {
        console.error(`Invalid data format - expected array but got:`, typeof data);
        console.error(`Response preview:`, JSON.stringify(data).substring(0, 200));
        throw new Error(`Invalid response format for ${symbol}: expected array, got ${typeof data}`);
      }
      
      if (data.length === 0) {
        console.warn(`Warning: Received empty array of candles for ${symbol}`);
        return [];
      }

      // Validate first candle format
      const firstCandle = data[0];
      if (!Array.isArray(firstCandle) || firstCandle.length < 6) {
        console.error(`Invalid candle format: ${JSON.stringify(firstCandle)}`);
        throw new Error(`Invalid candle format for ${symbol}`);
      }

      // Log successful request
      console.log(`Successfully fetched ${data.length} candles for ${symbol} on ${timeframe}`);

      // Convert to CandleData format
      return data.map((kline: any) => ({
        time: Number(kline[0]), // Open time
        open: Number.parseFloat(kline[1]),
        high: Number.parseFloat(kline[2]),
        low: Number.parseFloat(kline[3]),
        close: Number.parseFloat(kline[4]),
        volume: Number.parseFloat(kline[5]), // Volume
      }))
    } catch (error) {
      console.error(`Error fetching ${timeframe} candles for ${symbol} (attempt ${retries + 1}):`, error)
      
      retries++;
      if (retries <= maxRetries) {
        // Exponential backoff
        const delay = retryDelay * Math.pow(2, retries - 1);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`All retry attempts failed for ${symbol}`);
        return [];
      }
    }
  }
  
  return []; // Fallback if all retries fail
}

// Function to get historical high/low values
export async function getHighLowSinceTimestamp(
  symbol: string,
  startTime: number,
): Promise<{ high: number; low: number }> {
  try {
    // Get 1-minute candles from startTime to now
    // Use a smaller interval to capture short-term price spikes
    
    // Try api3.binance.com first
    let url = `https://api3.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&startTime=${startTime}&limit=1000`

    let response = await fetch(url, {
      headers: {
        'User-Agent': 'TradeFibSignals/1.0.0',
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 seconds timeout
    });
    
    // If api3 endpoint fails, try regular API
    if (!response.ok) {
      url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&startTime=${startTime}&limit=1000`
      
      response = await fetch(url, {
        headers: {
          'User-Agent': 'TradeFibSignals/1.0.0',
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 seconds timeout
      });
    }
    
    if (!response.ok) {
      throw new Error(`Failed to fetch historical data: ${response.statusText}`)
    }

    const data = await response.json()

    // Process data
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn("No historical data received")
      return { high: 0, low: Number.MAX_SAFE_INTEGER }
    }

    // Find highest high and lowest low from all candles
    let highestPrice = 0
    let lowestPrice = Number.MAX_SAFE_INTEGER

    for (const candle of data) {
      const high = Number.parseFloat(candle[2]) // high is at index 2
      const low = Number.parseFloat(candle[3]) // low is at index 3

      if (high > highestPrice) {
        highestPrice = high
      }

      if (low < lowestPrice) {
        lowestPrice = low
      }
    }

    console.log(
      `Historical price range since ${new Date(startTime).toISOString()}: High: ${highestPrice}, Low: ${lowestPrice}`,
    )

    return {
      high: highestPrice,
      low: lowestPrice,
    }
  } catch (error) {
    console.error("Error fetching historical high/low:", error)
    return { high: 0, low: Number.MAX_SAFE_INTEGER }
  }
}

// Add function to fetch candlestick data with more resilient error handling
export async function fetchCandlestickData(
  symbol: string,
  timeframe: string,
  limit = 100
): Promise<CandleData[]> {
  try {
    console.log(`Fetching candlestick data for ${symbol} on ${timeframe} timeframe, limit: ${limit}`);
    
    // Use existing fetchTimeframeCandles function with production endpoints prioritized
    const candles = await fetchTimeframeCandles(symbol, timeframe, limit);
    
    // Additional validation
    if (!candles || candles.length === 0) {
      console.warn(`No candlestick data returned for ${symbol} on ${timeframe}`);
      
      // Try with a smaller limit as fallback (Binance can sometimes reject large limit values)
      if (limit > 50) {
        console.log(`Retrying with reduced limit (50) for ${symbol}...`);
        return await fetchTimeframeCandles(symbol, timeframe, 50);
      }
    }
    
    return candles;
  } catch (error) {
    console.error(`Error fetching candlestick data for ${symbol}:`, error);
    // Instead of throwing, return empty array - this makes signal generation more resilient
    return [];
  }
}
