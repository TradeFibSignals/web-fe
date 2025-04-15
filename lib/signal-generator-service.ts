import { supabase } from "./supabase-client"
import { fetchTimeframeCandles } from "./binance-api"
import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchCandlestickData } from "./binance-api"
import { analyzeLiquidityLevels } from "./liquidity-levels"
import { generateSignals } from "./signals-service"

// Typy timeframe, které budeme zpracovávat
const TIMEFRAMES = ["5m", "15m", "30m", "1h"]

// Historická data pro sezónnost (stejná jako v signals-panel.tsx)
const historicalMonthlyReturns = {
  0: {
    // January
    2011: 66.67,
    2012: 10.0,
    2013: 15.38,
    2014: -14.29,
    2015: -33.33,
    2016: 11.11,
    2017: 15.79,
    2018: -14.29,
    2019: 2.7,
    2020: 4.73,
    2021: 10.37,
    2022: -2.17,
    2023: 25.0,
    2024: 0.72,
  },
  // ... další měsíce (zkráceno pro přehlednost)
}

// Rozhraní pro signál
interface GeneratedSignal {
  signal_id: string
  signal_type: "long" | "short"
  entry_price: number
  stop_loss: number
  take_profit: number
  pair: string
  timeframe: string
  signal_source: string
  major_level?: number
  peak_price?: number
  peak_time?: Date
  fib_levels?: any
  risk_reward_ratio: number
  seasonality: "bullish" | "bearish" | "neutral"
  positive_probability: number
}

// Typy pro signály
export interface Signal {
  id: string
  pair: string
  timeframe: string
  direction: "long" | "short"
  entryPrice: number
  stopLoss: number
  takeProfit: number
  timestamp: number
  status: "active" | "completed" | "expired"
  entryHit?: boolean
  tpHit?: boolean
  slHit?: boolean
}

// Funkce pro získání aktuální sezónnosti
function getCurrentSeasonality(): { seasonality: "bullish" | "bearish" | "neutral"; probability: number } {
  const currentMonth = new Date().getMonth()
  const monthData = historicalMonthlyReturns[currentMonth as keyof typeof historicalMonthlyReturns]

  if (monthData) {
    const returns = Object.values(monthData)
    const positiveCount = returns.filter((ret) => ret > 0).length
    const probability = (positiveCount / returns.length) * 100

    // Určení sezónnosti na základě pravděpodobnosti pozitivních výnosů
    if (probability >= 60) {
      return { seasonality: "bullish", probability }
    } else if (probability <= 40) {
      return { seasonality: "bearish", probability }
    } else {
      return { seasonality: "neutral", probability }
    }
  }

  return { seasonality: "neutral", probability: 50 }
}

// Hlavní funkce pro generování signálů pro konkrétní timeframe
// export async function generateSignalsForTimeframe(timeframe: string): Promise<void> {
//   try {
//     console.log(`Starting signal generation for ${timeframe} timeframe...`)

//     // Získání dostupných párů
//     const availablePairs = await fetchAvailablePairs()

//     // Omezení na top páry pro snížení zátěže (můžete upravit podle potřeby)
//     const topPairs = availablePairs.slice(0, 20)

//     console.log(`Generating signals for ${topPairs.length} pairs on ${timeframe} timeframe...`)

//     // Získání aktuální sezónnosti
//     const { seasonality, probability } = getCurrentSeasonality()
//     console.log(`Current seasonality: ${seasonality} (${probability.toFixed(2)}%)`)

//     // Pro každý pár vygenerujeme signály pro daný timeframe
//     for (const pair of topPairs) {
//       try {
//         console.log(`Generating signals for ${pair} on ${timeframe} timeframe...`)

//         // Získání historických svíček
//         const historicalCandles = await fetchHistoricalCandles(pair, timeframe as any, 3) // 3 dny dat

//         if (!historicalCandles || historicalCandles.length === 0) {
//           console.log(`No historical data available for ${pair} on ${timeframe}`)
//           continue
//         }

//         // Výpočet úrovní likvidity
//         const { bsl, ssl } = calculateLiquidityLevels(historicalCandles, {
//           swingStrength: 5,
//           majorThreshold: 0.3,
//           reqThreshold: 2.0,
//         })

//         // Nalezení všech major úrovní
//         const majorBSL = bsl.filter((level) => level.isMajor)
//         const majorSSL = ssl.filter((level) => level.isMajor)

//         // Určení typu signálu na základě sezónnosti
//         const signalType = seasonality === "bearish" ? "short" : "long"

//         // Nalezení vhodné major úrovně na základě typu signálu
//         let relevantLevel = null

//         if (signalType === "long") {
//           // Pro LONG signály hledáme nejnižší major SSL level
//           const sortedSSL = [...majorSSL].sort((a, b) => a.price - b.price)
//           relevantLevel = sortedSSL.length > 0 ? sortedSSL[0] : null

//           // Pokud nenajdeme žádný SSL level, zkusíme použít BSL level v neutrální sezónnosti
//           if (!relevantLevel && seasonality === "neutral" && majorBSL.length > 0) {
//             relevantLevel = majorBSL.sort((a, b) => a.price - b.price)[0]
//           }
//         } else {
//           // Pro SHORT signály hledáme nejvyšší major BSL level
//           const sortedBSL = [...majorBSL].sort((a, b) => b.price - a.price)
//           relevantLevel = sortedBSL.length > 0 ? sortedBSL[0] : null

//           // Pokud nenajdeme žádný BSL level, zkusíme použít SSL level v neutrální sezónnosti
//           if (!relevantLevel && seasonality === "neutral" && majorSSL.length > 0) {
//             relevantLevel = majorSSL.sort((a, b) => b.price - a.price)[0]
//           }
//         }

//         // Pokud jsme nenašli relevantní úroveň, přeskočíme
//         if (!relevantLevel) {
//           console.log(`No relevant major level found for ${pair} on ${timeframe}`)
//           continue
//         }

//         // Získání všech svíček po vytvoření major úrovně
//         const candlesAfterLevel = historicalCandles.filter((candle) => candle.time > relevantLevel.time)

//         if (candlesAfterLevel.length < 5) {
//           console.log(`Not enough candles after major level for ${pair} on ${timeframe}`)
//           continue
//         }

//         // Generování signálu podle typu
//         let signal: GeneratedSignal | null = null

//         if (signalType === "long") {
//           // LONG signál - hledáme první lokální vrchol po major úrovni
//           let peakFound = false
//           let peakIndex = -1
//           let peakPrice = 0
//           let peakTime = 0

//           // Procházíme svíčky po major úrovni a hledáme první lokální vrchol
//           for (let i = 2; i < candlesAfterLevel.length - 3; i++) {
//             if (
//               candlesAfterLevel[i].high > candlesAfterLevel[i - 1].high &&
//               candlesAfterLevel[i].high > candlesAfterLevel[i - 2].high
//             ) {
//               if (
//                 candlesAfterLevel[i + 1].high < candlesAfterLevel[i].high &&
//                 candlesAfterLevel[i + 2].high < candlesAfterLevel[i].high &&
//                 candlesAfterLevel[i + 3].high < candlesAfterLevel[i].high
//               ) {
//                 peakFound = true
//                 peakIndex = i
//                 peakPrice = candlesAfterLevel[i].high
//                 peakTime = candlesAfterLevel[i].time
//                 break
//               }
//             }
//           }

//           // Pokud jsme nenašli lokální vrchol, zkusíme najít absolutní maximum
//           if (!peakFound) {
//             for (let i = 0; i < candlesAfterLevel.length; i++) {
//               if (candlesAfterLevel[i].high > peakPrice) {
//                 peakPrice = candlesAfterLevel[i].high
//                 peakTime = candlesAfterLevel[i].time
//                 peakIndex = i
//               }
//             }
//           }

//           // Pokud jsme našli vrchol, vypočítáme Fibonacci úrovně
//           if (peakIndex !== -1) {
//             const startPrice = relevantLevel.price
//             const endPrice = peakPrice
//             const priceDiff = endPrice - startPrice

//             // Výpočet pouze potřebných Fibonacci úrovní (0%, 61.8%, 100%)
//             const fibLevels = [0, 61.8, 100].map((level) => {
//               // Pro LONG signály: 0% na high, 100% na major úrovni
//               const fibPrice = endPrice - (priceDiff * level) / 100

//               return {
//                 level,
//                 price: fibPrice,
//               }
//             })

//             // Vstup na 61.8% retracement
//             const entryLevel = fibLevels.find((level) => level.level === 61.8)
//             if (!entryLevel) continue

//             // Stop loss těsně za major úrovní
//             const stopLossBuffer = priceDiff * 0.01 // 1% pohybu
//             const stopLoss = startPrice - stopLossBuffer

//             // Výpočet rizika
//             const risk = Math.abs(entryLevel.price - stopLoss)

//             // Výpočet take profit na základě 3:1 RRR
//             const takeProfit = entryLevel.price + risk * 3

//             // Vytvoření signálu
//             signal = {
//               signal_id: uuidv4(),
//               signal_type: signalType,
//               entry_price: entryLevel.price,
//               stop_loss: stopLoss,
//               take_profit: takeProfit,
//               pair,
//               timeframe,
//               signal_source: "fibonacci",
//               major_level: startPrice,
//               peak_price: endPrice,
//               peak_time: new Date(peakTime),
//               fib_levels: fibLevels,
//               risk_reward_ratio: 3,
//               seasonality,
//               positive_probability: probability,
//             }
//           }
//         } else {
//           // SHORT signál - hledáme první lokální dno po major úrovni
//           let troughFound = false
//           let troughIndex = -1
//           let troughPrice = Number.MAX_VALUE
//           let troughTime = 0

//           // Procházíme svíčky po major úrovni a hledáme první lokální dno
//           for (let i = 2; i < candlesAfterLevel.length - 3; i++) {
//             if (
//               candlesAfterLevel[i].low < candlesAfterLevel[i - 1].low &&
//               candlesAfterLevel[i].low < candlesAfterLevel[i - 2].low
//             ) {
//               if (
//                 candlesAfterLevel[i + 1].low > candlesAfterLevel[i].low &&
//                 candlesAfterLevel[i + 2].low > candlesAfterLevel[i].low &&
//                 candlesAfterLevel[i + 3].low > candlesAfterLevel[i].low
//               ) {
//                 troughFound = true
//                 troughIndex = i
//                 troughPrice = candlesAfterLevel[i].low
//                 troughTime = candlesAfterLevel[i].time
//                 break
//               }
//             }
//           }

//           // Pokud jsme nenašli lokální dno, zkusíme najít absolutní minimum
//           if (!troughFound) {
//             for (let i = 0; i < candlesAfterLevel.length; i++) {
//               if (candlesAfterLevel[i].low < troughPrice) {
//                 troughPrice = candlesAfterLevel[i].low
//                 troughTime = candlesAfterLevel[i].time
//                 troughIndex = i
//               }
//             }
//           }

//           // Pokud jsme našli dno, vypočítáme Fibonacci úrovně
//           if (troughIndex !== -1) {
//             const startPrice = relevantLevel.price
//             const endPrice = troughPrice
//             const priceDiff = startPrice - endPrice

//             // Výpočet pouze potřebných Fibonacci úrovní (0%, 61.8%, 100%)
//             const fibLevels = [0, 61.8, 100].map((level) => {
//               // Pro SHORT signály: 0% na low, 100% na major úrovni
//               const fibPrice = endPrice + (priceDiff * level) / 100

//               return {
//                 level,
//                 price: fibPrice,
//               }
//             })

//             // Vstup na 61.8% retracement
//             const entryLevel = fibLevels.find((level) => level.level === 61.8)
//             if (!entryLevel) continue

//             // Stop loss těsně za major úrovní
//             const stopLossBuffer = priceDiff * 0.01 // 1% pohybu
//             const stopLoss = startPrice + stopLossBuffer

//             // Výpočet rizika
//             const risk = Math.abs(entryLevel.price - stopLoss)

//             // Výpočet take profit na základě 3:1 RRR
//             const takeProfit = entryLevel.price - risk * 3

//             // Vytvoření signálu
//             signal = {
//               signal_id: uuidv4(),
//               signal_type: signalType,
//               entry_price: entryLevel.price,
//               stop_loss: stopLoss,
//               take_profit: takeProfit,
//               pair,
//               timeframe,
//               signal_source: "fibonacci",
//               major_level: startPrice,
//               peak_price: endPrice,
//               peak_time: new Date(troughTime),
//               fib_levels: fibLevels,
//               risk_reward_ratio: 3,
//               seasonality,
//               positive_probability: probability,
//             }
//           }
//         }

//         // Pokud jsme vygenerovali signál, uložíme ho do databáze
//         if (signal) {
//           console.log(`Generated ${signal.signal_type} signal for ${pair} on ${timeframe}`)
//           await saveSignalToDatabase(signal)
//         } else {
//           console.log(`No signal generated for ${pair} on ${timeframe}`)
//         }
//       } catch (error) {
//         console.error(`Error generating signal for ${pair} on ${timeframe}:`, error)
//       }
//     }

//     console.log(`Signal generation completed for ${timeframe} timeframe`)

//     // Aktualizace cache pro daný timeframe
//     await updateSignalCacheForTimeframe(timeframe)

//     // Kontrola a aktualizace stavu signálů pro daný timeframe
//     await checkAndUpdateSignalStatuses(timeframe)
//   } catch (error) {
//     console.error(`Error in signal generation process for ${timeframe}:`, error)
//   }
// }

export async function generateSignalsForTimeframe(timeframe: string, supabase: SupabaseClient) {
  console.log(`Generating signals for timeframe: ${timeframe}`)

  // Seznam párů, pro které chceme generovat signály
  const pairs = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT"]
  const results = []

  for (const pair of pairs) {
    try {
      console.log(`Processing pair: ${pair} with timeframe: ${timeframe}`)

      // Získání dat svíček z Binance API
      const candlestickData = await fetchCandlestickData(pair, timeframe, 100)

      // Analýza úrovní likvidity
      const liquidityLevels = analyzeLiquidityLevels(candlestickData)

      // Generování signálů na základě úrovní likvidity
      const signals = generateSignals(pair, timeframe, candlestickData, liquidityLevels)

      // Uložení signálů do databáze
      for (const signal of signals) {
        const { data, error } = await supabase.from("generated_signals").upsert(
          {
            id: signal.id,
            pair: signal.pair,
            timeframe: signal.timeframe,
            direction: signal.direction,
            entry_price: signal.entryPrice,
            stop_loss: signal.stopLoss,
            take_profit: signal.takeProfit,
            timestamp: new Date(signal.timestamp).toISOString(),
            status: signal.status,
            entry_hit: signal.entryHit || false,
            tp_hit: signal.tpHit || false,
            sl_hit: signal.slHit || false,
          },
          {
            onConflict: "id",
          },
        )

        if (error) {
          console.error(`Error saving signal for ${pair}:`, error)
        } else {
          console.log(`Signal saved for ${pair}: ${signal.id}`)
        }
      }

      // Aktualizace cache pro rychlý přístup
      await updateSignalCacheForTimeframe(pair, timeframe, signals, supabase)

      results.push({
        pair,
        signalsGenerated: signals.length,
      })
    } catch (error) {
      console.error(`Error processing ${pair}:`, error)
      results.push({
        pair,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Čištění starých záznamů v cache
  await cleanupOldCacheEntriesForTimeframe(timeframe, supabase)

  return results
}

// Funkce pro uložení signálu do databáze
async function saveSignalToDatabase(signal: GeneratedSignal): Promise<void> {
  try {
    // Nejprve zkontrolujeme, zda podobný signál již neexistuje
    const { data: existingSignals, error: checkError } = await supabase
      .from("generated_signals")
      .select("*")
      .eq("pair", signal.pair)
      .eq("timeframe", signal.timeframe)
      .eq("signal_type", signal.signal_type)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)

    if (checkError) {
      console.error("Error checking for existing signals:", checkError)
      return
    }

    // Pokud existuje aktivní signál pro stejný pár, timeframe a typ, přeskočíme
    if (existingSignals && existingSignals.length > 0) {
      const existingSignal = existingSignals[0]

      // Pokud je existující signál velmi podobný (v rámci 1% od entry), přeskočíme
      const entryDiffPercent = (Math.abs(existingSignal.entry_price - signal.entry_price) / signal.entry_price) * 100
      if (entryDiffPercent < 1) {
        console.log(`Similar active signal already exists for ${signal.pair} on ${signal.timeframe}, skipping...`)
        return
      }
    }

    // Uložení nového signálu
    const { error } = await supabase.from("generated_signals").insert({
      signal_id: signal.signal_id,
      signal_type: signal.signal_type,
      entry_price: signal.entry_price,
      stop_loss: signal.stop_loss,
      take_profit: signal.take_profit,
      pair: signal.pair,
      timeframe: signal.timeframe,
      signal_source: signal.signal_source,
      major_level: signal.major_level,
      peak_price: signal.peak_price,
      peak_time: signal.peak_time,
      fib_levels: signal.fib_levels,
      risk_reward_ratio: signal.risk_reward_ratio,
      seasonality: signal.seasonality,
      positive_probability: signal.positive_probability,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (error) {
      console.error("Error saving signal to database:", error)
    } else {
      console.log(`Signal saved to database for ${signal.pair} on ${signal.timeframe}`)
    }
  } catch (error) {
    console.error("Error saving signal to database:", error)
  }
}

// Funkce pro aktualizaci cache signálů pro konkrétní timeframe
// export async function updateSignalCacheForTimeframe(timeframe: string): Promise<void> {
//   try {
//     console.log(`Updating signal cache for ${timeframe} timeframe...`)

//     // Získání všech aktivních signálů pro daný timeframe
//     const { data: activeSignals, error } = await supabase
//       .from("generated_signals")
//       .select("*")
//       .eq("status", "active")
//       .eq("timeframe", timeframe)
//       .order("created_at", { ascending: false })

//     if (error) {
//       console.error(`Error fetching active signals for ${timeframe} cache:`, error)
//       return
//     }

//     // Seskupení signálů podle páru
//     const signalsByPair: Record<string, string[]> = {}

//     activeSignals?.forEach((signal) => {
//       const key = `${signal.pair}_${signal.timeframe}`
//       if (!signalsByPair[key]) {
//         signalsByPair[key] = []
//       }
//       signalsByPair[key].push(signal.signal_id)
//     })

//     // Aktualizace cache pro každý pár
//     for (const [key, signalIds] of Object.entries(signalsByPair)) {
//       // Omezení na maximálně 10 signálů v cache pro každý pár a timeframe
//       const limitedSignalIds = signalIds.slice(0, 10)

//       // Upsert do cache tabulky
//       const { error: upsertError } = await supabase.from("signal_cache").upsert({
//         cache_key: key,
//         signal_ids: limitedSignalIds,
//         last_updated: new Date().toISOString(),
//       })

//       if (upsertError) {
//         console.error(`Error updating cache for ${key}:`, upsertError)
//       } else {
//         console.log(`Cache updated for ${key} with ${limitedSignalIds.length} signals`)
//       }
//     }

//     // Vyčištění starých záznamů v cache pro daný timeframe
//     await cleanupOldCacheEntriesForTimeframe(timeframe)
//   } catch (error) {
//     console.error(`Error updating signal cache for ${timeframe}:`, error)
//   }
// }

async function updateSignalCacheForTimeframe(
  pair: string,
  timeframe: string,
  signals: Signal[],
  supabase: SupabaseClient,
) {
  try {
    // Nejprve odstraníme staré záznamy pro tento pár a timeframe
    const { error: deleteError } = await supabase.from("signal_cache").delete().match({ pair, timeframe })

    if (deleteError) {
      console.error(`Error clearing cache for ${pair} ${timeframe}:`, deleteError)
      return
    }

    // Přidáme nové signály do cache
    if (signals.length > 0) {
      const cacheEntries = signals.map((signal) => ({
        signal_id: signal.id,
        pair: signal.pair,
        timeframe: signal.timeframe,
        cached_at: new Date().toISOString(),
      }))

      const { error: insertError } = await supabase.from("signal_cache").insert(cacheEntries)

      if (insertError) {
        console.error(`Error updating cache for ${pair} ${timeframe}:`, insertError)
      } else {
        console.log(`Cache updated for ${pair} ${timeframe}: ${signals.length} signals`)
      }
    }
  } catch (error) {
    console.error(`Error in updateSignalCacheForTimeframe:`, error)
  }
}

// Funkce pro vyčištění starých záznamů v cache pro konkrétní timeframe
// async function cleanupOldCacheEntriesForTimeframe(timeframe: string): Promise<void> {
//   try {
//     // Získání všech záznamů v cache pro daný timeframe
//     const { data: cacheEntries, error } = await supabase
//       .from("signal_cache")
//       .select("*")
//       .like("cache_key", `%_${timeframe}`)

//     if (error) {
//       console.error(`Error fetching cache entries for ${timeframe}:`, error)
//       return
//     }

//     // Kontrola každého záznamu v cache
//     for (const entry of cacheEntries || []) {
//       // Získání signálů podle ID
//       const signalIds = entry.signal_ids as string[]

//       if (!signalIds || signalIds.length === 0) {
//         // Pokud nejsou žádná ID, smažeme záznam
//         await supabase.from("signal_cache").delete().eq("cache_key", entry.cache_key)
//         continue
//       }

//       // Kontrola, zda signály stále existují a jsou aktivní
//       const { data: existingSignals, error: checkError } = await supabase
//         .from("generated_signals")
//         .select("signal_id")
//         .in("signal_id", signalIds)
//         .eq("status", "active")

//       if (checkError) {
//         console.error(`Error checking signals for cache key ${entry.cache_key}:`, checkError)
//         continue
//       }

//       // Získání ID existujících aktivních signálů
//       const existingIds = existingSignals?.map((s) => s.signal_id) || []

//       if (existingIds.length === 0) {
//         // Pokud nejsou žádné aktivní signály, smažeme záznam
//         await supabase.from("signal_cache").delete().eq("cache_key", entry.cache_key)
//       } else if (existingIds.length !== signalIds.length) {
//         // Pokud se počet signálů změnil, aktualizujeme záznam
//         await supabase
//           .from("signal_cache")
//           .update({
//             signal_ids: existingIds,
//             last_updated: new Date().toISOString(),
//           })
//           .eq("cache_key", entry.cache_key)
//       }
//     }
//   } catch (error) {
//     console.error(`Error cleaning up old cache entries for ${timeframe}:`, error)
//   }
// }

async function cleanupOldCacheEntriesForTimeframe(timeframe: string, supabase: SupabaseClient) {
  try {
    // Určení časového limitu pro staré záznamy (24 hodin)
    const cutoffTime = new Date()
    cutoffTime.setHours(cutoffTime.getHours() - 24)

    const { error } = await supabase
      .from("signal_cache")
      .delete()
      .match({ timeframe })
      .lt("cached_at", cutoffTime.toISOString())

    if (error) {
      console.error(`Error cleaning up old cache entries for ${timeframe}:`, error)
    } else {
      console.log(`Old cache entries cleaned up for ${timeframe}`)
    }
  } catch (error) {
    console.error(`Error in cleanupOldCacheEntriesForTimeframe:`, error)
  }
}

// Funkce pro kontrolu a aktualizaci stavu signálů pro konkrétní timeframe
export async function checkAndUpdateSignalStatuses(timeframe?: string): Promise<void> {
  try {
    console.log(`Checking and updating signal statuses${timeframe ? ` for ${timeframe} timeframe` : ""}...`)

    // Získání všech aktivních signálů
    let query = supabase.from("generated_signals").select("*").eq("status", "active")

    // Pokud je specifikován timeframe, filtrujeme podle něj
    if (timeframe) {
      query = query.eq("timeframe", timeframe)
    }

    const { data: activeSignals, error } = await query

    if (error) {
      console.error("Error fetching active signals:", error)
      return
    }

    // Seskupení signálů podle páru
    const signalsByPair: Record<string, any[]> = {}

    activeSignals?.forEach((signal) => {
      if (!signalsByPair[signal.pair]) {
        signalsByPair[signal.pair] = []
      }
      signalsByPair[signal.pair].push(signal)
    })

    // Zpracování signálů pro každý pár
    for (const [pair, signals] of Object.entries(signalsByPair)) {
      try {
        // Získání aktuální ceny a historických svíček pro pár
        const currentPriceData = await fetchTimeframeCandles(pair, "1m", 1)

        if (!currentPriceData || currentPriceData.length === 0) {
          console.log(`No current price data available for ${pair}, skipping...`)
          continue
        }

        const currentPrice = currentPriceData[0].close

        // Kontrola každého signálu
        for (const signal of signals) {
          // Kontrola, zda byl signál již aktivován (entry hit)
          let entryHit = signal.entry_hit
          let entryHitTime = signal.entry_hit_time
          let status = signal.status
          let isCompleted = false
          let exitType: string | null = null
          let exitPrice: number | null = null
          let exitTime: Date | null = null

          // Nejprve zkontrolujeme, zda byla dosažena vstupní cena (pokud ještě nebyla)
          if (!entryHit) {
            if (signal.signal_type === "long") {
              // Pro long pozice - cena musí klesnout na nebo pod vstupní cenu
              if (currentPrice <= signal.entry_price) {
                entryHit = true
                entryHitTime = new Date().toISOString()
                status = "active"
                console.log(`Entry hit for ${pair} ${signal.timeframe} LONG signal at ${currentPrice}`)
              }
            } else {
              // Pro short pozice - cena musí vzrůst na nebo nad vstupní cenu
              if (currentPrice >= signal.entry_price) {
                entryHit = true
                entryHitTime = new Date().toISOString()
                status = "active"
                console.log(`Entry hit for ${pair} ${signal.timeframe} SHORT signal at ${currentPrice}`)
              }
            }
          }

          // Pokud je signál aktivní (vstupní cena byla dosažena), zkontrolujeme TP/SL
          if (entryHit) {
            if (signal.signal_type === "long") {
              // Pro long pozice
              if (currentPrice >= signal.take_profit) {
                isCompleted = true
                exitType = "tp"
                exitPrice = signal.take_profit
                exitTime = new Date()
                status = "completed"
                console.log(`Take profit hit for ${pair} ${signal.timeframe} LONG signal at ${currentPrice}`)
              } else if (currentPrice <= signal.stop_loss) {
                isCompleted = true
                exitType = "sl"
                exitPrice = signal.stop_loss
                exitTime = new Date()
                status = "completed"
                console.log(`Stop loss hit for ${pair} ${signal.timeframe} LONG signal at ${currentPrice}`)
              }
            } else {
              // Pro short pozice
              if (currentPrice <= signal.take_profit) {
                isCompleted = true
                exitType = "tp"
                exitPrice = signal.take_profit
                exitTime = new Date()
                status = "completed"
                console.log(`Take profit hit for ${pair} ${signal.timeframe} SHORT signal at ${currentPrice}`)
              } else if (currentPrice >= signal.stop_loss) {
                isCompleted = true
                exitType = "sl"
                exitPrice = signal.stop_loss
                exitTime = new Date()
                status = "completed"
                console.log(`Stop loss hit for ${pair} ${signal.timeframe} SHORT signal at ${currentPrice}`)
              }
            }
          }

          // Kontrola expirace signálu (pokud je starší než 7 dní a nebyl aktivován)
          const signalAge = Date.now() - new Date(signal.created_at).getTime()
          const maxSignalAge = 7 * 24 * 60 * 60 * 1000 // 7 dní v milisekundách

          if (!entryHit && signalAge > maxSignalAge) {
            isCompleted = true
            exitType = "expired"
            exitPrice = currentPrice
            exitTime = new Date()
            status = "expired"
            console.log(`Signal expired for ${pair} ${signal.timeframe} ${signal.signal_type} signal`)
          }

          // Aktualizace signálu v databázi, pokud došlo ke změně
          if (entryHit !== signal.entry_hit || status !== signal.status || isCompleted) {
            const updateData: any = {
              entry_hit: entryHit,
              status,
            }

            if (entryHit && !signal.entry_hit) {
              updateData.entry_hit_time = entryHitTime
            }

            if (isCompleted) {
              updateData.exit_type = exitType
              updateData.exit_price = exitPrice
              updateData.exit_time = exitTime

              // Výpočet P&L
              let profitLoss = 0

              if (signal.signal_type === "long") {
                profitLoss = exitPrice! - signal.entry_price
              } else {
                profitLoss = signal.entry_price - exitPrice!
              }

              updateData.profit_loss = profitLoss
              updateData.profit_loss_percent = (profitLoss / signal.entry_price) * 100
            }

            // Aktualizace v databázi
            const { error: updateError } = await supabase
              .from("generated_signals")
              .update(updateData)
              .eq("signal_id", signal.signal_id)

            if (updateError) {
              console.error(`Error updating signal ${signal.signal_id}:`, updateError)
            } else {
              console.log(`Signal ${signal.signal_id} updated successfully`)
            }
          }
        }
      } catch (error) {
        console.error(`Error processing signals for ${pair}:`, error)
      }
    }

    console.log("Signal status check completed")
  } catch (error) {
    console.error("Error checking signal statuses:", error)
  }
}

// Funkce pro získání signálů z cache
export async function getSignalsFromCache(pair: string, timeframe: string): Promise<any[]> {
  try {
    const cacheKey = `${pair}_${timeframe}`

    // Pokus o získání signálů z cache
    const { data: cacheEntry, error: cacheError } = await supabase
      .from("signal_cache")
      .select("*")
      .eq("cache_key", cacheKey)
      .single()

    if (cacheError) {
      console.log(`No cache entry found for ${cacheKey}, fetching from database`)

      // Pokud není v cache, získáme přímo z databáze
      const { data: signals, error } = await supabase
        .from("generated_signals")
        .select("*")
        .eq("pair", pair)
        .eq("timeframe", timeframe)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(10)

      if (error) {
        console.error(`Error fetching signals for ${pair} on ${timeframe}:`, error)
        return []
      }

      return signals || []
    }

    // Získání signálů podle ID z cache
    const signalIds = cacheEntry.signal_ids as string[]

    if (!signalIds || signalIds.length === 0) {
      return []
    }

    const { data: signals, error } = await supabase
      .from("generated_signals")
      .select("*")
      .in("signal_id", signalIds)
      .order("created_at", { ascending: false })

    if (error) {
      console.error(`Error fetching signals from cache for ${cacheKey}:`, error)
      return []
    }

    return signals || []
  } catch (error) {
    console.error("Error getting signals from cache:", error)
    return []
  }
}
