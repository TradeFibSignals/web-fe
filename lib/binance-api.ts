// Binance API client for fetching BTCUSDT perpetual futures data
// Enhanced with endpoint selection to handle HTTP 451 errors

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

// API endpoints to try in order of preference
const BINANCE_ENDPOINTS = [
  { name: 'binance-api-v3', url: 'https://api.binance.com/api/v3' },
  { name: 'binance-spot-v3', url: 'https://api1.binance.com/api/v3' },
  { name: 'binance-api-eu', url: 'https://api-eu.binance.com/api/v3' },
  { name: 'binance-api-tr', url: 'https://api-tr.binance.com/api/v3' },
  { name: 'binance-futures-fapi-v1', url: 'https://fapi.binance.com/fapi/v1' },
  { name: 'binance-futures-dapi-v1', url: 'https://dapi.binance.com/dapi/v1' }
];

// Alternative data source (CoinGecko)
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Configuration for API requests
const CONFIG = {
  ENDPOINT_TEST_TIMEOUT: 2000, // 2-second timeout for endpoint testing
  API_TIMEOUT: 5000,           // 5-second timeout for normal API calls
  MAX_PARALLEL_TESTS: 3        // Max parallel endpoint tests
};

// Track working endpoints in memory
let workingEndpoints = new Map<string, {
  url: string,
  lastTested: number,
  responseTime: number
}>();

// Last fetched data cache (in-memory)
const dataCache = new Map<string, {
  data: any,
  timestamp: number
}>();

// Convert timeframe to interval parameter for Binance API
export function timeframeToInterval(timeframe: string): string {
  switch (timeframe) {
    case "5m":
      return "5m"
    case "15m":
      return "15m"
    case "30m":
      return "30m"
    case "1h":
      return "1h"
    case "4h":
      return "4h"
    case "1d":
      return "1d"
    default:
      return "30m"
  }
}

// Helper function to quickly find a working Binance endpoint
async function findWorkingBinanceEndpoint(): Promise<string | null> {
  console.log('Finding working Binance endpoint...');

  // If we have a working endpoint in memory and it's not too old, use it
  const now = Date.now();
  let bestEndpoint: { url: string, responseTime: number } | null = null;
  const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

  for (const [name, data] of workingEndpoints.entries()) {
    if (now - data.lastTested < CACHE_DURATION) {
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
            // Test the endpoint with a simple BTC price query
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.ENDPOINT_TEST_TIMEOUT);

            const response = await fetch(`${endpoint.url}/ticker/price?symbol=BTCUSDT`, {
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
            console.log(`Endpoint ${endpoint.name} failed: ${error.message}`);
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
    console.error('Error testing Binance endpoints:', error);
    return null;
  }
}

async function fetchKlines(
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
    
    // Check cache first
    const cached = dataCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < cacheExpiry)) {
      console.log(`Using cached kline data for ${symbol} ${interval}`);
      return cached.data;
    }

    // First try our internal API
    try {
      // Build URL with proper parameters for historical data
      let url = `/api/klines?symbol=${normalizedSymbol}&interval=${interval}&limit=${limit}`;

      // Add end time if provided
      if (endTime) {
        url += `&endTime=${endTime}`;
      }

      // Calculate start time based on interval and limit to ensure we get enough historical data
      const timeStep = getTimeStepSeconds(interval);
      const startTime = endTime 
        ? endTime - limit * timeStep 
        : Math.floor(Date.now() / 1000) - limit * timeStep;
      url += `&startTime=${startTime}`;

      console.log(`Fetching klines from internal API: ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const candles = await response.json();

      // Check if we received valid data
      if (!Array.isArray(candles) || candles.length === 0) {
        throw new Error("Invalid response from API");
      }

      // Cache the result
      dataCache.set(cacheKey, {
        data: candles,
        timestamp: Date.now()
      });

      return candles;
    } catch (error) {
      console.error("Error fetching klines from internal API:", error);
      
      // Fall back to direct Binance API call
      try {
        const binanceEndpoint = await findWorkingBinanceEndpoint();
        
        if (binanceEndpoint) {
          console.log(`Fetching data directly from Binance: ${symbol}`);
          
          // Prepare URL parameters for Binance
          const params = new URLSearchParams({
            symbol: symbol,
            interval: interval,
            limit: limit.toString(),
          });
          
          // Add time parameters if provided
          if (endTime) {
            params.append('endTime', (endTime * 1000).toString()); // Convert to milliseconds for Binance
          }
          
          // Set a timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);
          
          // Make the request
          const response = await fetch(`${binanceEndpoint}/klines?${params.toString()}`, {
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const data = await response.json();
            
            // Check that data has the correct format
            if (Array.isArray(data) && data.length > 0) {
              // Convert Binance format to our standard format
              const result = data.map((item: any) => ({
                time: Math.floor(item[0] / 1000), // Convert ms to s
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: parseFloat(item[5])
              }));
              
              // Cache the result
              dataCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
              });
              
              return result;
            }
          }
        }
      } catch (binanceError) {
        console.error('Error fetching directly from Binance:', binanceError);
      }
      
      // Try CoinGecko as a last resort
      try {
        const baseSymbol = symbol.replace(/USDT$|USD$/, "").toLowerCase();
        console.log(`Trying CoinGecko for ${baseSymbol}...`);
        
        // Map our symbol to CoinGecko ID
        const coinId = getCoinGeckoId(baseSymbol);
        
        if (coinId) {
          const days = interval === '1d' ? 30 : 
                      (interval === '4h' || interval === '1h') ? 7 : 2;
                      
          // Create URL for CoinGecko API
          const url = `${COINGECKO_API}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
          
          // Set a timeout for the request
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);
          
          const response = await fetch(url, {
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const data = await response.json();
            
            if (data && data.prices && Array.isArray(data.prices)) {
              const prices = data.prices;
              const volumes = data.total_volumes || [];
              
              // Convert CoinGecko data to candle format
              const candles: CandleData[] = [];
              
              // The target interval in seconds
              const targetInterval = getTimeStepSeconds(interval);
              const targetIntervalMs = targetInterval * 1000;
              
              // Group prices by target interval
              const groupedPrices: Map<number, number[]> = new Map();
              const groupedVolumes: Map<number, number> = new Map();
              
              // Process prices
              for (const [timestamp, price] of prices) {
                const bucketTime = Math.floor(timestamp / targetIntervalMs) * targetIntervalMs;
                if (!groupedPrices.has(bucketTime)) {
                  groupedPrices.set(bucketTime, []);
                }
                groupedPrices.get(bucketTime)!.push(price);
              }
              
              // Process volumes
              for (const [timestamp, volume] of volumes) {
                const bucketTime = Math.floor(timestamp / targetIntervalMs) * targetIntervalMs;
                groupedVolumes.set(bucketTime, (groupedVolumes.get(bucketTime) || 0) + volume);
              }
              
              // Create candles from aggregated data
              for (const [bucketTime, prices] of groupedPrices.entries()) {
                if (prices.length > 0) {
                  const open = prices[0];
                  const close = prices[prices.length - 1];
                  const high = Math.max(...prices);
                  const low = Math.min(...prices);
                  const volume = groupedVolumes.get(bucketTime) || 0;
                  
                  candles.push({
                    time: Math.floor(bucketTime / 1000),  // Convert to seconds
                    open: open,
                    high: high,
                    low: low,
                    close: close,
                    volume: volume
                  });
                }
              }
              
              // Sort by time and return requested number of candles
              candles.sort((a, b) => a.time - b.time);
              const result = candles.slice(-limit);
              
              if (result.length > 0) {
                // Cache the result
                dataCache.set(cacheKey, {
                  data: result,
                  timestamp: Date.now()
                });
                
                return result;
              }
            }
          }
        }
      } catch (coingeckoError) {
        console.error('Error fetching from CoinGecko:', coingeckoError);
      }
    }

    // If all APIs fail, return mock data as a last resort
    console.warn(`All APIs failed for ${symbol}, generating mock data`);
    return generateHistoricalMockCandles(interval, limit, symbol, endTime);
  } catch (error) {
    console.error("Error fetching klines:", error);
    return generateHistoricalMockCandles(interval, limit, symbol, endTime);
  }
}

// Binance API client for fetching BTCUSDT perpetual futures data
// Enhanced with endpoint selection to handle HTTP 451 errors

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

// API endpoints to try in order of preference
const BINANCE_ENDPOINTS = [
  { name: 'binance-api-v3', url: 'https://api.binance.com/api/v3' },
  { name: 'binance-spot-v3', url: 'https://api1.binance.com/api/v3' },
  { name: 'binance-api-eu', url: 'https://api-eu.binance.com/api/v3' },
  { name: 'binance-api-tr', url: 'https://api-tr.binance.com/api/v3' },
  { name: 'binance-futures-fapi-v1', url: 'https://fapi.binance.com/fapi/v1' },
  { name: 'binance-futures-dapi-v1', url: 'https://dapi.binance.com/dapi/v1' }
];

// Alternative data source (CoinGecko)
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Configuration for API requests
const CONFIG = {
  ENDPOINT_TEST_TIMEOUT: 2000, // 2-second timeout for endpoint testing
  API_TIMEOUT: 5000,           // 5-second timeout for normal API calls
  MAX_PARALLEL_TESTS: 3        // Max parallel endpoint tests
};

// Track working endpoints in memory
let workingEndpoints = new Map<string, {
  url: string,
  lastTested: number,
  responseTime: number
}>();

// Last fetched data cache (in-memory)
const dataCache = new Map<string, {
  data: any,
  timestamp: number
}>();

// Convert timeframe to interval parameter for Binance API
export function timeframeToInterval(timeframe: string): string {
  switch (timeframe) {
    case "5m":
      return "5m"
    case "15m":
      return "15m"
    case "30m":
      return "30m"
    case "1h":
      return "1h"
    case "4h":
      return "4h"
    case "1d":
      return "1d"
    default:
      return "30m"
  }
}

// Helper function to quickly find a working Binance endpoint
async function findWorkingBinanceEndpoint(): Promise<string | null> {
  console.log('Finding working Binance endpoint...');

  // If we have a working endpoint in memory and it's not too old, use it
  const now = Date.now();
  let bestEndpoint: { url: string, responseTime: number } | null = null;
  const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

  for (const [name, data] of workingEndpoints.entries()) {
    if (now - data.lastTested < CACHE_DURATION) {
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
            // Test the endpoint with a simple BTC price query
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.ENDPOINT_TEST_TIMEOUT);

            const response = await fetch(`${endpoint.url}/ticker/price?symbol=BTCUSDT`, {
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
            console.log(`Endpoint ${endpoint.name} failed: ${error.message}`);
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
    console.error('Error testing Binance endpoints:', error);
    return null;
  }
}

async function fetchKlines(
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

    // Check cache first
    const cached = dataCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < cacheExpiry)) {
      console.log(`Using cached kline data for ${symbol} ${interval}`);
      return cached.data;
    }

    // First try our internal API
    try {
      // Build URL with proper parameters for historical data
      let url = `/api/klines?symbol=${normalizedSymbol}&interval=${interval}&limit=${limit}`;

      // Add end time if provided
      if (endTime) {
        url += `&endTime=${endTime}`;
      }

      // Calculate start time based on interval and limit to ensure we get enough historical data
      const timeStep = getTimeStepSeconds(interval);
      const startTime = endTime
        ? endTime - limit * timeStep
        : Math.floor(Date.now() / 1000) - limit * timeStep;
      url += `&startTime=${startTime}`;

      console.log(`Fetching klines from internal API: ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const candles = await response.json();

      // Check if we received valid data
      if (!Array.isArray(candles) || candles.length === 0) {
        throw new Error("Invalid response from API");
      }

      // Cache the result
      dataCache.set(cacheKey, {
        data: candles,
        timestamp: Date.now()
      });

      return candles;
    } catch (error) {
      console.error("Error fetching klines from internal API:", error);

      // Fall back to direct Binance API call
      try {
        const binanceEndpoint = await findWorkingBinanceEndpoint();

        if (binanceEndpoint) {
          console.log(`Fetching data directly from Binance: ${symbol}`);

          // Prepare URL parameters for Binance
          const params = new URLSearchParams({
            symbol: symbol,
            interval: interval,
            limit: limit.toString(),
          });

          // Add time parameters if provided
          if (endTime) {
            params.append('endTime', (endTime * 1000).toString()); // Convert to milliseconds for Binance
          }

          // Set a timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);

          // Make the request
          const response = await fetch(`${binanceEndpoint}/klines?${params.toString()}`, {
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            },
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();

            // Check that data has the correct format
            if (Array.isArray(data) && data.length > 0) {
              // Convert Binance format to our standard format
              const result = data.map((item: any) => ({
                time: Math.floor(item[0] / 1000), // Convert ms to s
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: parseFloat(item[5])
              }));

              // Cache the result
              dataCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
              });

              return result;
            }
          }
        }
      } catch (binanceError) {
        console.error('Error fetching directly from Binance:', binanceError);
      }

      // Try CoinGecko as a last resort
      try {
        const baseSymbol = symbol.replace(/USDT$|USD$/, "").toLowerCase();
        console.log(`Trying CoinGecko for ${baseSymbol}...`);

        // Map our symbol to CoinGecko ID
        const coinId = getCoinGeckoId(baseSymbol);

        if (coinId) {
          const days = interval === '1d' ? 30 :
                      (interval === '4h' || interval === '1h') ? 7 : 2;

          // Create URL for CoinGecko API
          const url = `${COINGECKO_API}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;

          // Set a timeout for the request
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);

          const response = await fetch(url, {
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            },
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();

            if (data && data.prices && Array.isArray(data.prices)) {
              const prices = data.prices;
              const volumes = data.total_volumes || [];

              // Convert CoinGecko data to candle format
              const candles: CandleData[] = [];

              // The target interval in seconds
              const targetInterval = getTimeStepSeconds(interval);
              const targetIntervalMs = targetInterval * 1000;

              // Group prices by target interval
              const groupedPrices: Map<number, number[]> = new Map();
              const groupedVolumes: Map<number, number> = new Map();

              // Process prices
              for (const [timestamp, price] of prices) {
                const bucketTime = Math.floor(timestamp / targetIntervalMs) * targetIntervalMs;
                if (!groupedPrices.has(bucketTime)) {
                  groupedPrices.set(bucketTime, []);
                }
                groupedPrices.get(bucketTime)!.push(price);
              }

              // Process volumes
              for (const [timestamp, volume] of volumes) {
                const bucketTime = Math.floor(timestamp / targetIntervalMs) * targetIntervalMs;
                groupedVolumes.set(bucketTime, (groupedVolumes.get(bucketTime) || 0) + volume);
              }

              // Create candles from aggregated data
              for (const [bucketTime, prices] of groupedPrices.entries()) {
                if (prices.length > 0) {
                  const open = prices[0];
                  const close = prices[prices.length - 1];
                  const high = Math.max(...prices);
                  const low = Math.min(...prices);
                  const volume = groupedVolumes.get(bucketTime) || 0;

                  candles.push({
                    time: Math.floor(bucketTime / 1000),  // Convert to seconds
                    open: open,
                    high: high,
                    low: low,
                    close: close,
                    volume: volume
                  });
                }
              }

              // Sort by time and return requested number of candles
              candles.sort((a, b) => a.time - b.time);
              const result = candles.slice(-limit);

              if (result.length > 0) {
                // Cache the result
                dataCache.set(cacheKey, {
                  data: result,
                  timestamp: Date.now()
                });

                return result;
              }
            }
          }
        }
      } catch (coingeckoError) {
        console.error('Error fetching from CoinGecko:', coingeckoError);
      }
    }

    // If all APIs fail, return mock data as a last resort
    console.warn(`All APIs failed for ${symbol}, generating mock data`);
    return generateHistoricalMockCandles(interval, limit, symbol, endTime);
  } catch (error) {
    console.error("Error fetching klines:", error);
    return generateHistoricalMockCandles(interval, limit, symbol, endTime);
  }
}
