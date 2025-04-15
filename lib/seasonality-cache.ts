import { supabase } from "./supabase-client"
import { historicalMonthlyReturns } from "./seasonality-data"

// Cache TTL in seconds (7 days)
const CACHE_TTL = 60 * 60 * 24 * 7

// Table name for caching
const CACHE_TABLE = "seasonality_cache"

// Flag to track if we've already checked for table existence
let tableChecked = false
let tableExists = false

// Check if the cache table exists
async function checkTableExists(): Promise<boolean> {
  if (tableChecked) return tableExists

  try {
    // Check if we're in a browser environment
    if (typeof window !== "undefined") {
      // In browser, assume table doesn't exist to avoid CORS issues
      tableChecked = true
      tableExists = false
      return false
    }

    // Check if the table exists
    const { data, error } = await supabase.from(CACHE_TABLE).select("key").limit(1)

    if (error) {
      if (error.code === "42P01") {
        // Table doesn't exist
        console.log("Cache table doesn't exist, using direct calculation")
        tableChecked = true
        tableExists = false
        return false
      } else {
        // Other error
        console.error("Error checking if cache table exists:", error)
        tableChecked = true
        tableExists = false
        return false
      }
    }

    // Table exists
    tableChecked = true
    tableExists = true
    return true
  } catch (error) {
    console.error("Error checking if cache table exists:", error)
    tableChecked = true
    tableExists = false
    return false
  }
}

// Get data from cache or calculate
async function getFromCacheOrCalculate<T>(key: string, calculateFn: () => T): Promise<T> {
  try {
    // Check if Supabase is available
    if (!supabase) {
      console.log(`Supabase not available, using direct calculation for ${key}`)
      return calculateFn()
    }

    // Check if table exists
    const exists = await checkTableExists()
    if (!exists) {
      // Table doesn't exist, use direct calculation
      return calculateFn()
    }

    // Try to get from cache
    const { data, error } = await supabase.from(CACHE_TABLE).select("value, updated_at").eq("key", key).single()

    if (error) {
      // If error is not "not found", log it
      if (error.code !== "PGRST116") {
        console.error(`Error getting ${key} from cache:`, error)
      }
      // Use direct calculation
      return calculateFn()
    }

    if (data) {
      // Check if cache is still valid
      const updatedAt = new Date(data.updated_at)
      const now = new Date()
      const diffSeconds = (now.getTime() - updatedAt.getTime()) / 1000

      if (diffSeconds < CACHE_TTL) {
        console.log(`${key} retrieved from Supabase cache`)
        return data.value as T
      } else {
        console.log(`${key} cache expired, recalculating...`)
      }
    }

    // Calculate if not in cache or expired
    console.log(`Calculating ${key}...`)
    const value = calculateFn()

    // Try to store in Supabase if table exists
    if (exists) {
      try {
        const { error: upsertError } = await supabase.from(CACHE_TABLE).upsert({
          key,
          value,
          updated_at: new Date().toISOString(),
        })

        if (upsertError) {
          console.error(`Error storing ${key} in cache:`, upsertError)
        }
      } catch (storeError) {
        console.error(`Error storing ${key} in cache:`, storeError)
      }
    }

    return value
  } catch (error) {
    console.error(`Error in cache operation for ${key}:`, error)
    // Fallback to direct calculation if cache fails
    return calculateFn()
  }
}

// Calculate monthly averages and store in Supabase
export async function getMonthlyAverages(): Promise<Record<number, number>> {
  return getFromCacheOrCalculate<Record<number, number>>("monthly_averages", calculateMonthlyAveragesFallback)
}

// Calculate positive probability and store in Supabase
export async function getMonthlyPositiveProb(): Promise<Record<number, number>> {
  return getFromCacheOrCalculate<Record<number, number>>("monthly_probabilities", calculateMonthlyProbabilitiesFallback)
}

// Get detailed monthly stats from Supabase or calculate
export async function getMonthlyStats(month: number) {
  return getFromCacheOrCalculate(`monthly_stats_${month}`, () => calculateMonthlyStatsFallback(month))
}

// Invalidate all seasonality caches
export async function invalidateSeasonalityCache() {
  try {
    // Check if table exists
    const exists = await checkTableExists()
    if (!exists) {
      // Table doesn't exist, nothing to invalidate
      return true
    }

    // Delete all cache entries
    const { error } = await supabase.from(CACHE_TABLE).delete().like("key", "monthly_%")

    if (error) {
      console.error("Error invalidating seasonality cache:", error)
      return false
    }

    console.log("Seasonality cache invalidated successfully")
    return true
  } catch (error) {
    console.error("Error invalidating seasonality cache:", error)
    return false
  }
}

// Fallback functions for direct calculation if cache fails
function calculateMonthlyAveragesFallback(): Record<number, number> {
  const averages: Record<number, number> = {}

  for (let month = 0; month < 12; month++) {
    const monthData = historicalMonthlyReturns[month as keyof typeof historicalMonthlyReturns]
    if (!monthData) continue

    const returns = Object.values(monthData)
    const average = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
    averages[month] = average
  }

  return averages
}

function calculateMonthlyProbabilitiesFallback(): Record<number, number> {
  const probabilities: Record<number, number> = {}

  for (let month = 0; month < 12; month++) {
    const monthData = historicalMonthlyReturns[month as keyof typeof historicalMonthlyReturns]
    if (!monthData) continue

    const returns = Object.values(monthData)
    const positiveCount = returns.filter((ret) => ret > 0).length
    const probability = (positiveCount / returns.length) * 100
    probabilities[month] = probability
  }

  return probabilities
}

function calculateMonthlyStatsFallback(month: number) {
  const monthData = historicalMonthlyReturns[month as keyof typeof historicalMonthlyReturns]

  if (!monthData) {
    return {
      positiveYears: 0,
      negativeYears: 0,
      averageReturn: 0,
      medianReturn: 0,
      bestYear: { year: 0, return: 0 },
      worstYear: { year: 0, return: 0 },
      returns: [],
      positiveProb: 0,
    }
  }

  const returns = Object.entries(monthData).map(([year, ret]) => ({
    year: Number.parseInt(year),
    return: ret as number,
  }))

  // Sort returns for median calculation
  const sortedReturns = [...returns].sort((a, b) => a.return - b.return)
  const middleIndex = Math.floor(sortedReturns.length / 2)
  const medianReturn =
    sortedReturns.length % 2 === 0
      ? (sortedReturns[middleIndex - 1].return + sortedReturns[middleIndex].return) / 2
      : sortedReturns[middleIndex].return

  const positiveYears = returns.filter((r) => r.return > 0).length
  const negativeYears = returns.filter((r) => r.return <= 0).length
  const totalYears = returns.length
  const averageReturn = returns.reduce((sum, r) => sum + r.return, 0) / totalYears
  const bestYear = returns.reduce((best, r) => (r.return > best.return ? r : best), {
    year: 0,
    return: Number.NEGATIVE_INFINITY,
  })
  const worstYear = returns.reduce((worst, r) => (r.return < worst.return ? r : worst), {
    year: 0,
    return: Number.POSITIVE_INFINITY,
  })
  const positiveProb = (positiveYears / totalYears) * 100

  return {
    positiveYears,
    negativeYears,
    averageReturn,
    medianReturn,
    bestYear,
    worstYear,
    returns: sortedReturns.reverse(), // Reverse to show highest returns first
    positiveProb,
  }
}
