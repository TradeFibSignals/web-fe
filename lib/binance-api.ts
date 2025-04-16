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

// Constants for retry logic
const RETRY_WAIT_TIME = 5000 // 5 second base wait time
const MAX_RETRIES = 3 // Maximum number of retries per endpoint

// Prioritized Binance API endpoints
const BINANCE_ENDPOINTS = [
  // Prioritize api3.binance.com first as it often works better for avoiding geo-restrictions
  "https://api3.binance.com/api/v3",
  "https://api.binance.com/api/v3",
  "https://api1.binance.com/api/v3",
  "https://api2.binance.com/api/v3",
  "https://data-api.binance.vision/api/v3",
  // Futures API endpoints
  "https://fapi.binance.com/fapi/v1",
  "https://dapi.binance.com/dapi/v1",
]

// Function to test different Binance endpoints and find the most reliable one
export async function testBinanceEndpoints() {
  // Define endpoints to test - prioritize api3.binance.com first
  const endpoints = [
    {
      name: "binance-api3-v3",
      url: "https://api3.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=1",
    },
    {
      name: "binance-api-v3",
      url: "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=1",
    },
    {
      name: "binance-spot-v3",
      url: "https://api1.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=1",
    },
    {
      name: "binance-futures-fapi-v1",
      url: "https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=1",
    },
    {
      name: "binance-futures-dapi-v1", 
      url: "https://dapi.binance.com/dapi/v1/klines?symbol=BTCUSD_PERP&interval=1h&limit=1",
    }
  ];

  const endpointStats: Record<string, any> = {};
  let bestEndpoint = null;
  let bestResponseTime = Number.MAX_SAFE_INTEGER;
  let allFailed = true;

  // Test each endpoint
  for (const endpoint of endpoints) {
    const startTime = Date.now();
    
    try {
      const response = await fetch(endpoint.url, {
        method: "GET",
        headers: {
          "User-Agent": "TradeFibSignals/1.0.0",
          "Accept": "application/json"
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
    bestEndpoint = "binance-api3-v3"; // Default to api3 if all fail
  }

  return {
    bestEndpoint,
    endpointStats
  };
}

// Function to get the best Binance endpoint URL
export function getBestBinanceEndpoint(): string {
  // Default to api3.binance.com as it's often the most reliable
  return "https://api3.binance.com/api/v3";
}

// Function to fetch available perpetual pairs from Binance with improved retry logic
export async function fetchAvailablePairs(): Promise<string[]> {
  console.log("Fetching available pairs from Binance...");
  
  // Try multiple endpoints with retry logic
  for (const baseEndpoint of BINANCE_ENDPOINTS) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        console.log(`Trying endpoint ${baseEndpoint} (attempt ${attempt + 1}/${MAX_RETRIES})...`);
        
        const endpoint = baseEndpoint.includes("fapi") || baseEndpoint.includes("dapi") 
          ? `${baseEndpoint}/exchangeInfo` 
          : `${baseEndpoint}/exchangeInfo`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(endpoint, {
          headers: {
            'User-Agent': 'TradeFibSignals/1.0.0',
            'Accept': 'application/json'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const statusText = await response.text();
          console.warn(`Endpoint ${baseEndpoint} failed: ${response.status} ${statusText}`);
          continue;
        }
        
        const data = await response.json();
        
        // Extract USDT perpetual pairs
        const pairs = data.symbols
          .filter(
            (symbol: any) =>
              symbol.status === "TRADING" && 
              (symbol.quoteAsset === "USDT" || (symbol.contractType === "PERPETUAL" && symbol.quoteAsset === "USDT"))
          )
          .map((symbol: any) => symbol.symbol);
        
        console.log(`Successfully fetched ${pairs.length} pairs from ${baseEndpoint}`);
        return pairs;
      } catch (error) {
        console.warn(`Error fetching pairs from ${baseEndpoint} (attempt ${attempt + 1}): ${error instanceof Error ? error.message : String(error)}`);
        
        if (attempt < MAX_RETRIES - 1) {
          console.log(`Waiting ${RETRY_WAIT_TIME / 1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_WAIT_TIME));
        }
      }
    }
  }
  
  // Fallback to default pairs if all endpoints fail
  console.warn("All endpoints failed when fetching pairs. Using default pairs.");
  return ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];
}

// Improved function to fetch historical candles with multiple endpoints and retry logic
export async function fetchTimeframeCandles(symbol: string, timeframe: string, limit = 20): Promise<CandleData[]> {
  console.log(`Fetching ${limit} candles for ${symbol} on ${timeframe} timeframe...`);
  
  // Map timeframe to Binance interval format if needed
  let interval: string;
  switch (timeframe) {
    case "1d":
      interval = "1d";
      break;
    case "1M":
      interval = "1M";
      break;
    default:
      interval = timeframe;
  }
  
  // Try multiple endpoints with retry logic
  for (const baseEndpoint of BINANCE_ENDPOINTS) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Adjust endpoint for futures vs spot
        const endpoint = baseEndpoint.includes("fapi") || baseEndpoint.includes("dapi") 
          ? `${baseEndpoint}/klines` 
          : `${baseEndpoint}/klines`;
        
        const url = `${endpoint}?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        console.log(`Trying endpoint: ${url} (attempt ${attempt + 1}/${MAX_RETRIES})...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'TradeFibSignals/1.0.0',
            'Accept': 'application/json'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const statusText = await response.text();
          console.warn(`Endpoint ${url} failed: ${response.status} ${statusText}`);
          
          // If we get 451 Unavailable for Legal Reasons, quickly move to next endpoint
          if (response.status === 451) {
            console.warn(`Geo-restriction detected (451). Switching to next endpoint.`);
            break; // Move to next endpoint immediately
          }
          
          // For other errors, continue with retry logic
          continue;
        }
        
        const data = await response.json();
        
        // Validate data
        if (!Array.isArray(data)) {
          console.warn(`Invalid data format from ${url}: expected array, got ${typeof data}`);
          continue;
        }
        
        if (data.length === 0) {
          console.warn(`Empty data array from ${url}`);
          continue;
        }
        
        // Convert to CandleData format
        console.log(`Successfully fetched ${data.length} candles from ${url}`);
        return data.map((kline: any) => ({
          time: Number(kline[0]), // Open time
          open: Number.parseFloat(kline[1]),
          high: Number.parseFloat(kline[2]),
          low: Number.parseFloat(kline[3]),
          close: Number.parseFloat(kline[4]),
          volume: Number.parseFloat(kline[5]), // Volume
        }));
      } catch (error) {
        const isTimeout = error instanceof Error && error.name === 'AbortError';
        console.warn(`Error fetching candles from ${baseEndpoint} (attempt ${attempt + 1}): ${error instanceof Error ? error.message : String(error)}`);
        
        if (isTimeout) {
          console.warn(`Request timeout. Switching to next endpoint.`);
          break; // Move to next endpoint immediately on timeout
        }
        
        if (attempt < MAX_RETRIES - 1) {
          const waitTime = RETRY_WAIT_TIME * Math.pow(1.5, attempt); // Exponential backoff
          console.log(`Waiting ${waitTime / 1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
  }
  
  // If all endpoints fail, try with a smaller limit as a last resort
  if (limit > 10) {
    console.warn(`All endpoints failed. Trying with reduced limit (10 candles)...`);
    return fetchTimeframeCandles(symbol, timeframe, 10);
  }
  
  console.error(`Failed to fetch candles after trying all endpoints. Returning empty array.`);
  return [];
}

// Improved function to fetch BinanceData with multiple endpoints
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
    console.log(`Fetching data for ${symbol} with timeframe ${timeframe}...`);
    
    // 1. Fetch current price and ticker data using multiple endpoints
    let tickerData: any = null;
    let currentPrice = 0;
    let priceChangePercent = 0;
    
    // Try ticker endpoints
    for (const baseEndpoint of BINANCE_ENDPOINTS) {
      if (tickerData) break; // Stop if we already have ticker data
      
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          // Adjust endpoint for futures vs spot
          const endpoint = baseEndpoint.includes("fapi") || baseEndpoint.includes("dapi") 
            ? `${baseEndpoint}/ticker/24hr` 
            : `${baseEndpoint}/ticker/24hr`;
          
          const url = `${endpoint}?symbol=${symbol}`;
          console.log(`Trying ticker endpoint: ${url} (attempt ${attempt + 1}/${MAX_RETRIES})...`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'TradeFibSignals/1.0.0',
              'Accept': 'application/json'
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            if (response.status === 451) {
              console.warn(`Geo-restriction detected. Switching to next endpoint.`);
              break;
            }
            continue;
          }
          
          tickerData = await response.json();
          currentPrice = Number.parseFloat(tickerData.lastPrice);
          priceChangePercent = Number.parseFloat(tickerData.priceChangePercent);
          
          console.log(`Successfully fetched ticker data from ${url}: price=${currentPrice}, change=${priceChangePercent}%`);
          break;
        } catch (error) {
          console.warn(`Error fetching ticker from ${baseEndpoint} (attempt ${attempt + 1}): ${error instanceof Error ? error.message : String(error)}`);
          
          if (error instanceof Error && error.name === 'AbortError') {
            break; // Move to next endpoint on timeout
          }
          
          if (attempt < MAX_RETRIES - 1) {
            await new Promise(resolve => setTimeout(resolve, RETRY_WAIT_TIME));
          }
        }
      }
    }
    
    // If we couldn't get ticker data, throw error
    if (!tickerData) {
      throw new Error(`Failed to fetch ticker data for ${symbol} after trying all endpoints.`);
    }
    
    // 2. Fetch historical candles
    // We'll use the improved fetchTimeframeCandles function
    const candles = await fetchTimeframeCandles(symbol, timeframe, 50);
    
    if (candles.length === 0) {
      throw new Error(`Failed to fetch historical candles for ${symbol} after trying all endpoints.`);
    }
    
    // Format price data for chart
    const priceData = candles.map(candle => ({
      time: candle.time,
      price: candle.close
    }));
    
    // If we only need price data, return early
    if (priceDataOnly) {
      return {
        liquidationData: [],
        priceData,
        currentPrice,
        priceChangePercent,
      };
    }
    
    // 3. Generate liquidation data
    // Since Binance doesn't provide liquidation data in public API, we'll generate synthetic data
    const liquidationData = generateLiquidationData(
      priceData,
      currentPrice,
      currentPrice * 0.95, // Long liquidation center (5% below current price)
      currentPrice * 1.05, // Short liquidation center (5% above current price)
      symbol,
      timeframe
    );
    
    return {
      liquidationData,
      priceData,
      currentPrice,
      priceChangePercent,
    };
  } catch (error) {
    console.error(`Error fetching data for ${symbol}:`, error);
    throw error;
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

// Improved function to fetch historical candle data
export async function fetchCandlestickData(
  symbol: string,
  timeframe: string,
  limit = 100
): Promise<CandleData[]> {
  try {
    console.log(`Fetching candlestick data for ${symbol} on ${timeframe} timeframe, limit: ${limit}`);
    
    // Use fetchTimeframeCandles with robust retry and fallback logic
    const candles = await fetchTimeframeCandles(symbol, timeframe, limit);
    
    // If we couldn't get enough candles, try with a smaller limit
    if (candles.length < Math.min(10, limit) && limit > 50) {
      console.log(`Received only ${candles.length} candles. Trying with reduced limit (50).`);
      return await fetchTimeframeCandles(symbol, timeframe, 50);
    }
    
    return candles;
  } catch (error) {
    console.error(`Error fetching candlestick data for ${symbol}:`, error);
    return [];
  }
}
