// Binance API client for fetching cryptocurrency data
// With compatibility for both client and server environments

export interface KlineData {
  openTime: number
  open: string
  high: string
  low: string
  close: string
  volume: string
  closeTime: number
  quoteAssetVolume: string
  trades: number
  takerBuyBaseAssetVolume: string
  takerBuyQuoteAssetVolume: string
  ignored: string
}

export interface CandleData {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface TickerData {
  symbol: string
  price: string
  priceChangePercent: string
  volume?: string
  source?: string
}

// API endpoints to try in order of preference - only including confirmed working endpoints
const BINANCE_ENDPOINTS = [
  // primary
  { name: 'binance-data-api', url: 'https://data-api.binance.vision/api/v3' },
  // fallback 
  { name: 'binance-futures-fapi-v1', url: 'https://fapi.binance.com/fapi/v1' },
  { name: 'binance-api-v3', url: 'https://api.binance.com/api/v3' },
  { name: 'binance-spot-v3', url: 'https://api1.binance.com/api/v3' },
];

// Alternative data source
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Configuration constants
const CONFIG = {
  ENDPOINT_TEST_TIMEOUT: 2000,  // 2-second timeout for endpoint testing
  API_TIMEOUT: 5000,            // 5-second timeout for normal API calls
  MAX_PARALLEL_TESTS: 3,        // Max parallel endpoint tests
  CACHE_DURATION: 30 * 60 * 1000, // 30 minutes cache duration
};

// Helper to check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Track working endpoints in memory
let workingEndpoints: Map<string, {
  url: string,
  lastTested: number,
  responseTime: number
}> = new Map();

// Last fetched data cache (in-memory)
const dataCache: Map<string, {
  data: any,
  timestamp: number
}> = new Map();

// Convert timeframe to interval parameter for Binance API
export function timeframeToInterval(timeframe: string): string {
  switch (timeframe) {
    case "5m": return "5m"
    case "15m": return "15m"
    case "30m": return "30m"
    case "1h": return "1h"
    case "4h": return "4h"
    case "1d": return "1d"
    default: return "30m"
  }
}

// Helper function to quickly find a working Binance endpoint
async function findWorkingBinanceEndpoint(): Promise<string | null> {
  console.log('Finding working Binance endpoint...');

  // If we have a working endpoint in memory and it's not too old, use it
  const now = Date.now();
  let bestEndpoint: { url: string, responseTime: number } | null = null;

  for (const [name, data] of workingEndpoints.entries()) {
    if (now - data.lastTested < CONFIG.CACHE_DURATION) {
      if (!bestEndpoint || data.responseTime < bestEndpoint.responseTime) {
        bestEndpoint = {
          url: data.url,
          responseTime: data.responseTime
        };
      }
    }
  }

  if (bestEndpoint) {
    console.log(`Using previously verified endpoint: ${bestEndpoint.url}`);
    return bestEndpoint.url;
  }

  // Need to test endpoints (in smaller batches to limit parallelism)
  try {
    const results = new Map<string, number>();
    const testPromises = [];

    // Test all endpoints with a simple BTC price request
    for (let i = 0; i < BINANCE_ENDPOINTS.length; i += CONFIG.MAX_PARALLEL_TESTS) {
      const batch = BINANCE_ENDPOINTS.slice(i, i + CONFIG.MAX_PARALLEL_TESTS);
      
      const batchPromises = batch.map(endpoint => {
        return new Promise<void>(async resolve => {
          const startTime = Date.now();
          try {
            // Test the endpoint with a request that's appropriate for the endpoint type
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.ENDPOINT_TEST_TIMEOUT);
            
            // Use different test endpoints for spot vs futures
            const isSpotEndpoint = endpoint.url.includes('/api/v3');
            const testUrl = isSpotEndpoint 
              ? `${endpoint.url}/ticker/price?symbol=BTCUSDT` 
              : `${endpoint.url}/ticker/price?symbol=BTCUSDT`;
              
            const response = await fetch(testUrl, {
              signal: controller.signal,
              headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
              }
            });

            clearTimeout(timeoutId);

            if (response.ok) {
              const responseTime = Date.now() - startTime;
              results.set(endpoint.name, responseTime);
              
              // Store info about this endpoint
              workingEndpoints.set(endpoint.name, {
                url: endpoint.url,
                lastTested: Date.now(),
                responseTime
              });
              
              console.log(`Endpoint ${endpoint.name} is working! Response time: ${responseTime}ms`);
            } else {
              console.log(`Endpoint ${endpoint.name} returned status ${response.status}`);
            }
          } catch (error) {
            console.log(`Endpoint ${endpoint.name} failed: ${error instanceof Error ? error.message : String(error)}`);
          }
          resolve();
        });
      });

      // Wait for this batch to complete before starting next batch
      testPromises.push(Promise.all(batchPromises));
    }

    // Wait for all tests to complete
    await Promise.all(testPromises);

    // Find the fastest working endpoint
    let bestEndpointName: string | null = null;
    let bestResponseTime = Infinity;

    for (const [name, responseTime] of results.entries()) {
      if (responseTime < bestResponseTime) {
        bestResponseTime = responseTime;
        bestEndpointName = name;
      }
    }

    // Return the URL of the best endpoint or null if none are working
    if (bestEndpointName) {
      const endpoint = BINANCE_ENDPOINTS.find(e => e.name === bestEndpointName);
      if (endpoint) {
        console.log(`Best endpoint: ${endpoint.name} (${bestResponseTime}ms)`);
        return endpoint.url;
      }
    }

    console.log('No working Binance endpoints found');
    return null;
  } catch (error) {
    console.error('Error testing Binance endpoints:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

// Create a fetchWithTimeout utility that works consistently in both environments
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number = CONFIG.API_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Helper function to get time step in seconds for an interval
function getTimeStepSeconds(interval: string): number {
  switch (interval) {
    case "5m": return 300
    case "15m": return 900
    case "30m": return 1800
    case "1h": return 3600
    case "4h": return 14400
    case "1d": return 86400
    default: return 1800
  }
}

// Map symbols to CoinGecko IDs
function getCoinGeckoId(symbol: string): string | null {
  const mapping: Record<string, string> = {
    'btc': 'bitcoin',
    'eth': 'ethereum',
    'sol': 'solana',
    'bnb': 'binancecoin',
    'xrp': 'ripple',
    'doge': 'dogecoin',
    'ada': 'cardano',
    'avax': 'avalanche-2',
    'dot': 'polkadot',
    'matic': 'matic-network',
    'link': 'chainlink',
    'ltc': 'litecoin'
  };
  
  return mapping[symbol] || null;
}

// Safe local storage helper (works in both browser and server environments)
const safeStorage = {
  getItem: (key: string): string | null => {
    if (isBrowser) {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        return null;
      }
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    if (isBrowser) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        // Ignore localStorage errors
      }
    }
  }
};

// Function to test all Binance endpoints and find the most reliable ones
export async function testBinanceEndpoints() {
  console.log('Testing all Binance endpoints...');
  
  const endpointStats: Record<string, { 
    success: boolean, 
    responseTime: number | null,
    error?: string 
  }> = {};
  
  // Test all endpoints
  for (const endpoint of BINANCE_ENDPOINTS) {
    try {
      console.log(`Testing endpoint: ${endpoint.name} (${endpoint.url})`);
      
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      // Use different test paths based on endpoint type
      const isFuturesEndpoint = endpoint.url.includes('/fapi/v1');
      const testPath = isFuturesEndpoint ? '/time' : '/time';
      
      const response = await fetch(`${endpoint.url}${testPath}`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        const responseTime = Date.now() - startTime;
        
        console.log(`✅ Endpoint ${endpoint.name} responded in ${responseTime}ms`);
        endpointStats[endpoint.name] = { 
          success: true, 
          responseTime 
        };
        
        // Store this working endpoint
        workingEndpoints.set(endpoint.name, {
          url: endpoint.url,
          lastTested: Date.now(),
          responseTime
        });
      } else {
        console.log(`❌ Endpoint ${endpoint.name} returned status ${response.status}`);
        endpointStats[endpoint.name] = { 
          success: false, 
          responseTime: null,
          error: `HTTP ${response.status}` 
        };
      }
    } catch (error) {
      console.log(`❌ Endpoint ${endpoint.name} failed: ${error instanceof Error ? error.message : String(error)}`);
      endpointStats[endpoint.name] = { 
        success: false, 
        responseTime: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  // Find the best endpoint
  let bestEndpointName: string | null = null;
  let bestResponseTime = Infinity;
  
  Object.entries(endpointStats).forEach(([name, stats]) => {
    if (stats.success && stats.responseTime && stats.responseTime < bestResponseTime) {
      bestResponseTime = stats.responseTime;
      bestEndpointName = name;
    }
  });
  
  // Get the URL for the best endpoint
  const bestEndpoint = bestEndpointName 
    ? BINANCE_ENDPOINTS.find(e => e.name === bestEndpointName)?.url || null 
    : null;
  
  return {
    bestEndpoint,
    endpointStats
  };
}

// Fetch klines with error handling and fallback options
export async function fetchKlines(
  interval: string,
  limit = 100,
  endTime?: number,
  symbol = "BTCUSDT",
): Promise<CandleData[]> {
  try {
    // Normalize the symbol - remove USDT/USD suffix for our API
    const normalizedSymbol = symbol.replace(/USDT$|USD$/, "");

    // Try to use a known working endpoint first
    const cacheKey = `klines_${symbol}_${interval}_${limit}_${endTime || 'latest'}`;
    const cacheExpiry = 5 * 60 * 1000; // 5 minutes
    
    // Check cache if available
    if (typeof dataCache !== 'undefined' && dataCache.get && dataCache.has(cacheKey)) {
      const cached = dataCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < cacheExpiry)) {
        console.log(`Using cached kline data for ${symbol} ${interval}`);
        return cached.data;
      }
    }

    // When in browser, try our local API first
    if (isBrowser) {
      try {
        console.log(`Fetching candles from local API for ${symbol} ${interval}`);
        const params = new URLSearchParams();
        params.append('symbol', symbol);
        params.append('interval', interval);
        params.append('limit', limit.toString());
        
        if (endTime) {
          params.append('endTime', endTime.toString());
        }

        const response = await fetch(`/api/candles?${params.toString()}`, {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data && Array.isArray(data) && data.length > 0) {
            // Cache the result
            if (typeof dataCache !== 'undefined' && dataCache.set) {
              dataCache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
              });
            }
            return data;
          }
        }
      } catch (localApiError) {
        console.error("Error fetching from local API:", localApiError);
        // Continue to direct Binance fetching if local API fails
      }
    }

    // Try Binance API directly - this will work on the server side
    try {
      // Get working Binance endpoint 
      const binanceEndpoint = await findWorkingBinanceEndpoint();
      
      if (!binanceEndpoint) {
        throw new Error("No working Binance endpoints available");
      }
      
      console.log(`Fetching data directly from Binance for ${symbol}`);
      
      // Prepare URL parameters
      const params = new URLSearchParams();
      params.append('symbol', symbol);
      params.append('interval', interval);
      params.append('limit', limit.toString());
      
      // Add time parameters if provided
      if (endTime) {
        params.append('endTime', (endTime * 1000).toString()); // Convert to milliseconds for Binance
      }
      
      // Set up request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      // Use the correct path based on whether it's a spot or futures endpoint
      const isSpotEndpoint = binanceEndpoint.includes('/api/v3');
      const url = `${binanceEndpoint}/klines?${params.toString()}`;
      console.log(`Making request to: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Binance returned status: ${response.status}`);
      }
      
      // Get response as text first for better error handling
      const text = await response.text();
      
      if (!text || text.trim() === '') {
        throw new Error('Empty response from Binance');
      }
      
      // Safely parse JSON
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        throw new Error(`Failed to parse Binance response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
      
      // Validate the response format
      if (!Array.isArray(data)) {
        throw new Error(`Expected array from Binance, got: ${typeof data}`);
      }
      
      // Transform to our format
      const result = data.map((item: any) => ({
        time: Math.floor(item[0] / 1000), // Convert ms to s
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5])
      }));
      
      // Cache the result if cache is available
      if (typeof dataCache !== 'undefined' && dataCache.set) {
        dataCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
      }
      
      return result;
      
    } catch (binanceError) {
      console.error('Error fetching directly from Binance:', binanceError instanceof Error ? binanceError.message : String(binanceError));
      throw new Error(`Failed to fetch data for ${symbol}`);
    }
  } catch (error) {
    console.error("Error fetching klines:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Add a function to validate ticker data
export function isValidTickerData(data: TickerData | null): boolean {
  if (!data) return false
  if (!data.price || data.price === "0" || data.price === "0.00") return false
  if (!data.priceChangePercent) return false
  return true
}

export async function fetchTickerData(symbol = "BTCUSDT"): Promise<TickerData> {
  // Ensure symbol is properly formatted
  if (!symbol.endsWith("USDT") && !symbol.endsWith("USD")) {
    symbol = `${symbol}USDT`
  }

  // In browser, use our internal API route first
  if (isBrowser) {
    try {
      const response = await fetchWithTimeout(
        `/api/ticker?symbol=${symbol}`, 
        {
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          }
        }, 
        5000
      );

      if (response.ok) {
        const data = await response.json();

        // Check if we got valid data
        if (data && data.price) {
          // Store the data in localStorage for future fallback
          safeStorage.setItem(`last${symbol}Price`, data.price);
          safeStorage.setItem(`last${symbol}Change`, data.priceChangePercent || "0.00");

          return {
            symbol: data.symbol || symbol,
            price: data.price,
            priceChangePercent: data.priceChangePercent || "0.00",
            volume: data.volume || "0",
            source: data.source || "api",
          };
        }
      }
    } catch (apiError) {
      console.error("Error fetching ticker data from API:", apiError instanceof Error ? apiError.message : String(apiError));
    }
  }

  // If internal API fails or we're on server side, try Binance directly
  try {
    const binanceEndpoint = await findWorkingBinanceEndpoint();
    
    if (binanceEndpoint) {
      const response = await fetchWithTimeout(
        `${binanceEndpoint}/ticker/24hr?symbol=${symbol}`, 
        {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        },
        CONFIG.API_TIMEOUT
      );
      
      if (response.ok) {
        const data = await response.json();
        
        if (data && data.lastPrice) {
          const result = {
            symbol: data.symbol,
            price: data.lastPrice,
            priceChangePercent: data.priceChangePercent,
            volume: data.volume,
            source: 'binance'
          };
          
          // Store for future fallback
          safeStorage.setItem(`last${symbol}Price`, data.lastPrice);
          safeStorage.setItem(`last${symbol}Change`, data.priceChangePercent);
          
          return result;
        }
      }
    }
  } catch (binanceError) {
    console.error('Error fetching ticker data from Binance:', binanceError instanceof Error ? binanceError.message : String(binanceError));
  }
  
  // If Binance fails, try CoinGecko
  try {
    const baseSymbol = symbol.replace(/USDT$|USD$/, "").toLowerCase();
    const coinId = getCoinGeckoId(baseSymbol);
    
    if (coinId) {
      const response = await fetchWithTimeout(
        `${COINGECKO_API}/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true`, 
        {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        },
        CONFIG.API_TIMEOUT
      );
      
      if (response.ok) {
        const data = await response.json();
        
        if (data && data[coinId]) {
          const coinData = data[coinId];
          const result = {
            symbol: symbol,
            price: coinData.usd.toString(),
            priceChangePercent: (coinData.usd_24h_change || 0).toString(),
            volume: (coinData.usd_24h_vol || 0).toString(),
            source: 'coingecko'
          };
          
          // Store for future fallback
          safeStorage.setItem(`last${symbol}Price`, coinData.usd.toString());
          safeStorage.setItem(`last${symbol}Change`, (coinData.usd_24h_change || 0).toString());
          
          return result;
        }
      }
    }
  } catch (coingeckoError) {
    console.error('Error fetching ticker data from CoinGecko:', coingeckoError instanceof Error ? coingeckoError.message : String(coingeckoError));
  }

  // Try to get the last known price from localStorage
  const storedPrice = safeStorage.getItem(`last${symbol}Price`);
  const storedChange = safeStorage.getItem(`last${symbol}Change`);

  if (storedPrice && storedChange) {
    // Return previously stored data
    return {
      symbol: symbol,
      price: storedPrice,
      priceChangePercent: storedChange,
      volume: "0",
      source: "stored-data",
    };
  }

  // If all sources fail, throw an error
  throw new Error(`Failed to fetch ticker data for ${symbol} from all available sources`);
}

// Fetch ticker data from Binance
export async function fetchBinanceTicker(symbol = "BTCUSDT"): Promise<any> {
  const binanceEndpoint = await findWorkingBinanceEndpoint();
  if (!binanceEndpoint) {
    throw new Error("No working Binance endpoint available");
  }
  
  const response = await fetchWithTimeout(
    `${binanceEndpoint}/ticker/24hr?symbol=${symbol}`, 
    {
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      }
    }, 
    5000
  );

  if (!response.ok) {
    throw new Error(`Binance API returned ${response.status}`);
  }

  return await response.json();
}

// Fetch candle data from Binance
export async function fetchBinanceCandles(
  symbol = "BTCUSDT",
  interval = "4h",
  limit = 100,
  startTime?: number,
  endTime?: number,
): Promise<CandleData[]> {
  // Ensure proper symbol format
  if (!symbol.endsWith("USDT") && !symbol.endsWith("USD")) {
    symbol = `${symbol}USDT`;
  }

  // Get working endpoint
  const binanceEndpoint = await findWorkingBinanceEndpoint();
  if (!binanceEndpoint) {
    throw new Error("No working Binance endpoint available");
  }

  // Build URL with proper parameters
  const params = new URLSearchParams({
    symbol: symbol,
    interval: interval,
    limit: limit.toString(),
  });

  // Add time parameters if provided
  if (startTime) {
    params.append('startTime', (startTime * 1000).toString());
  }

  if (endTime) {
    params.append('endTime', (endTime * 1000).toString());
  }

  console.log(`Fetching Binance candles: ${binanceEndpoint}/klines?${params.toString()}`);

  const response = await fetchWithTimeout(
    `${binanceEndpoint}/klines?${params.toString()}`, 
    {
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      }
    }, 
    5000
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Binance API returned ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error(`Invalid response from Binance API: ${JSON.stringify(data)}`);
  }

  // Transform Binance data to our format
  return data.map((item: any) => ({
    time: Math.floor(item[0] / 1000), // Convert milliseconds to seconds
    open: Number.parseFloat(item[1]),
    high: Number.parseFloat(item[2]),
    low: Number.parseFloat(item[3]),
    close: Number.parseFloat(item[4]),
    volume: Number.parseFloat(item[5]),
  }));
}

// WebSocket functions - only available in browser environment
// Export conditional implementations that check for browser environment

// Create a ticker WebSocket connection
export function createTickerWebSocket(
  symbol = "BTC",
  onMessage: (data: TickerData) => void,
  onError?: (error: Event) => void,
): WebSocket | null {
  // Check if we're in a browser environment
  if (!isBrowser) {
    console.log("WebSocket not created - not in browser environment")
    return null;
  }

  let socket: WebSocket | null = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  const symbolPair = `${symbol}usdt`;

  const connect = () => {
    try {
      // Use the futures WebSocket endpoint
      socket = new WebSocket(`wss://fstream.binance.com/ws/${symbolPair}@ticker`);

      socket.onopen = () => {
        console.log(`Ticker WebSocket connected for ${symbol}`);
        reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Validate the data before passing it to the callback
          if (isValidTickerData(data)) {
            onMessage(data as TickerData);
          } else {
            console.warn("Received invalid ticker data:", data);
          }
        } catch (error) {
          console.error("Error processing ticker WebSocket message:", error);
        }
      };

      socket.onerror = (error) => {
        console.error("Ticker WebSocket error:", error);
        if (onError) {
          onError(error);
        }
      };

      // Add reconnection logic
      socket.onclose = (event) => {
        console.log(`Ticker WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);

        // Only attempt to reconnect if we haven't exceeded max attempts
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff with 30s max
          console.log(
            `Attempting to reconnect in ${delay / 1000}s... (Attempt ${reconnectAttempts}/${maxReconnectAttempts})`,
          );

          setTimeout(() => {
            console.log("Reconnecting ticker WebSocket...");
            connect();
          }, delay);
        } else {
          console.log("Maximum reconnection attempts reached. Giving up.");
        }
      };
    } catch (error) {
      console.error("Error creating WebSocket:", error);
      return null;
    }

    return socket;
  };

  return connect();
}

// Create a WebSocket connection for real-time kline updates
export function createKlineWebSocket(
  timeframe: string,
  onMessage: (data: CandleData) => void,
  onError?: (error: Event) => void,
  symbol = "BTC",
): WebSocket | null {
  // Check if we're in a browser environment
  if (!isBrowser) {
    console.log("WebSocket not created - not in browser environment");
    return null;
  }

  const interval = timeframeToInterval(timeframe);
  const symbolPair = `${symbol.toLowerCase()}usdt`;
  let socket: WebSocket | null = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;

  const connect = () => {
    try {
      // Close existing socket if it exists
      if (socket) {
        try {
          socket.close();
        } catch (e) {
          console.error("Error closing existing socket:", e);
        }
      }

      socket = new WebSocket(`wss://fstream.binance.com/ws/${symbolPair}@kline_${interval}`);

      socket.onopen = () => {
        console.log(`Kline WebSocket connected for ${symbol} ${interval} timeframe`);
        reconnectAttempts = 0;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.k) {
            const kline = data.k;
            const candle: CandleData = {
              time: kline.t / 1000, // Convert to seconds for chart library
              open: Number.parseFloat(kline.o),
              high: Number.parseFloat(kline.h),
              low: Number.parseFloat(kline.l),
              close: Number.parseFloat(kline.c),
              volume: Number.parseFloat(kline.v),
            };
            onMessage(candle);
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
        }
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        if (onError) {
          onError(error);
        }

        // Try to reconnect on error
        if (socket) {
          try {
            socket.close();
          } catch (e) {
            console.error("Error closing socket after error:", e);
          }
        }
      };

      socket.onclose = (event) => {
        console.log(`Kline WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);

        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(
            `Attempting to reconnect in ${delay / 1000}s... (Attempt ${reconnectAttempts}/${maxReconnectAttempts})`,
          );

          setTimeout(() => {
            console.log("Reconnecting kline WebSocket...");
            connect();
          }, delay);
        } else {
          console.log("Maximum reconnection attempts reached. Not retrying further.");
        }
      };
    } catch (error) {
      console.error("Error creating WebSocket:", error);
      return null;
    }

    return socket;
  };

  return connect();
}

// Function for fetching historical candles with specialized error handling
export async function fetchHistoricalCandles(
  symbol = "BTCUSDT",
  timeframe = "15m",
  limit = 100
): Promise<CandleData[]> {
  // Convert timeframe to interval for Binance API
  const interval = timeframeToInterval(timeframe);
  
  try {
    // Use the previously implemented fetchKlines function
    return await fetchKlines(interval, limit, undefined, symbol);
  } catch (error) {
    console.error(`Error fetching candles for ${symbol} ${timeframe}:`, error);
    throw error;
  }
}

// Function for fetching candlestick data with robust error handling
export async function fetchCandlestickData(
  symbol: string,
  timeframe: string,
  limit = 100
): Promise<CandleData[]> {
  try {
    return await fetchTimeframeCandles(symbol, timeframe, limit);
  } catch (error) {
    console.error(`Error in fetchCandlestickData for ${symbol} ${timeframe}:`, error);
    throw error;
  }
}

// This function matches fetchHistoricalCandles, but is named differently - needed for backward compatibility
export async function fetchTimeframeCandles(
  symbol = "BTCUSDT",
  timeframe = "15m",
  limit = 100
): Promise<CandleData[]> {
  const interval = timeframeToInterval(timeframe);
  try {
    return await fetchKlines(interval, limit, undefined, symbol);
  } catch (error) {
    console.error(`Error in fetchTimeframeCandles for ${symbol} ${timeframe}:`, error);
    throw error;
  }
}

// Main function to fetch comprehensive data for UI display
export async function fetchBinanceData(
  timeframe: string = "15m",
  symbol: string = "BTCUSDT",
  useStableData: boolean = false
): Promise<{
  liquidationData: any[];
  priceData: any[];
  currentPrice: number;
  priceChangePercent: number;
  lpi: number;
  lio: number;
}> {
  try {
    // Fetch historical candles
    const candles = await fetchTimeframeCandles(symbol, timeframe, 100);
    
    // Get current price from the latest candle
    const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
    
    // Get ticker data for price change percentage
    const ticker = await fetchTickerData(symbol);
    const priceChangePercent = parseFloat(ticker.priceChangePercent);
    
    // Create simple price data from candles
    const priceData = candles.map(candle => ({
      price: candle.close,
      time: candle.time * 1000 // Convert back to milliseconds for UI
    }));
    
    // In real implementation, you would fetch liquidation data from liquidation API
    // For now, return an empty array as we don't have the liquidation data source
    const liquidationData: any[] = [];
    
    // Return fake LPI/LIO values - these should come from real calculations in production
    const lpi = 50; // Liquidation Pressure Index
    const lio = 50; // Liquidation Imbalance Oscillator
    
    return {
      liquidationData,
      priceData,
      currentPrice,
      priceChangePercent,
      lpi,
      lio
    };
  } catch (error) {
    console.error(`Error in fetchBinanceData for ${symbol} ${timeframe}:`, error);
    throw error;
  }
}

// Fetch available trading pairs
export async function fetchAvailablePairs(): Promise<string[]> {
  try {
    // In browser, try our local API first to avoid CORS issues
    if (isBrowser) {
      try {
        const response = await fetch('/api/pairs', {
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data && Array.isArray(data.pairs) && data.pairs.length > 0) {
            return data.pairs;
          }
        }
      } catch (localApiError) {
        console.error("Error fetching pairs from local API:", localApiError);
      }
    }
    
    // Server-side or fallback - try direct Binance API
    const binanceEndpoint = await findWorkingBinanceEndpoint();
    
    if (!binanceEndpoint) {
      throw new Error("No working Binance endpoints available");
    }
    
    // Decide which endpoint path to use based on spot vs futures
    const isFuturesEndpoint = binanceEndpoint.includes('/fapi/v1');
    const exchangeInfoPath = isFuturesEndpoint ? '/exchangeInfo' : '/exchangeInfo';
    
    const response = await fetchWithTimeout(
      `${binanceEndpoint}${exchangeInfoPath}`, 
      {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      },
      CONFIG.API_TIMEOUT
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch exchange info: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.symbols || !Array.isArray(data.symbols)) {
      throw new Error("Invalid exchange info response");
    }
    
    // Extract pairs ending with USDT for perpetuals
    const pairs = data.symbols
      .filter((symbol: any) => 
        symbol.symbol.endsWith('USDT') && 
        (isFuturesEndpoint ? symbol.contractType === 'PERPETUAL' : true)
      )
      .map((symbol: any) => symbol.symbol);
    
    return pairs;
  } catch (error) {
    console.error("Error fetching available pairs:", error instanceof Error ? error.message : String(error));
    
    // Return default pairs as fallback
    return [
      "BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "SOLUSDT", 
      "DOTUSDT", "DOGEUSDT", "MATICUSDT", "LINKUSDT", "AVAXUSDT"
    ];
  }
}
