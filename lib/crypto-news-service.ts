// Types for crypto news
import crypto from "crypto"
import { articleExists, insertArticle, initializeDatabase } from "./db-service"
import { createClient } from "@supabase/supabase-js"

// Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

export interface CryptoNewsItem {
  id: string
  title: string
  url: string
  source: string
  publishedAt: Date
  sentiment: "bullish" | "bearish" | "neutral"
  summary?: string
}

// Initialize database on module load
if (typeof window === "undefined") {
  // Only run on server-side if Supabase is available
  if (supabase) {
    initializeDatabase().catch(console.error)
  } else {
    console.warn("Supabase client not available. Database features will be disabled.")
  }
}

// Generate MD5 hash for duplicate detection
function generateHash(text: string): string {
  return crypto.createHash("md5").update(text).digest("hex")
}

// Updated fetchCryptoNews function that tries multiple sources and archives articles
export async function fetchCryptoNews(): Promise<CryptoNewsItem[]> {
  try {
    let newsItems: CryptoNewsItem[] = []

    // Try multiple API sources in sequence
    newsItems = (await fetchFromCryptoCompare()) || (await fetchFromCoinGecko()) || (await fetchFromCoinpaprika()) || []

    // Archive articles if we're on the server side
    if (typeof window === "undefined" && newsItems.length > 0) {
      await archiveArticles(newsItems)
    }

    return newsItems
  } catch (error) {
    console.error("Error fetching crypto news:", error)
    return []
  }
}

// Update the archiveArticles function to handle missing Supabase client

// Function to archive articles
async function archiveArticles(articles: CryptoNewsItem[]): Promise<void> {
  try {
    // Skip archiving if database is not available
    if (typeof window !== "undefined" || !supabase) {
      return
    }

    console.log(`Attempting to archive ${articles.length} articles...`)
    let archivedCount = 0
    let duplicateCount = 0

    for (const article of articles) {
      const hash = generateHash(article.title + article.url)

      // Check if article already exists
      const exists = await articleExists(hash)
      if (exists) {
        duplicateCount++
        continue
      }

      // Insert article into database
      await insertArticle({
        title: article.title,
        excerpt: article.summary,
        source_url: article.url,
        category: "crypto",
        tags: "",
        published_at: article.publishedAt,
        hash,
        sentiment: article.sentiment,
      })
      archivedCount++
    }

    console.log(`Successfully archived ${archivedCount} articles, ${duplicateCount} duplicates skipped`)
  } catch (error) {
    console.error("Error archiving articles:", error)
  }
}

// Function to fetch from CryptoCompare
async function fetchFromCryptoCompare(): Promise<CryptoNewsItem[] | null> {
  try {
    console.log("Fetching news from CryptoCompare...")
    const response = await fetch(
      "https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=popular&excludeCategories=Sponsored",
    )

    if (response.ok) {
      const data = await response.json()
      console.log(`Retrieved ${data.Data?.length || 0} articles from CryptoCompare`)
      return data.Data.slice(0, 14).map((item: any) => ({
        id: item.id.toString(),
        title: item.title,
        url: item.url,
        source: item.source_info?.name || item.source || "CryptoCompare",
        publishedAt: new Date(item.published_on * 1000),
        sentiment: analyzeSentiment(item.title, item.body),
        summary: item.body?.substring(0, 200) + "..." || "",
      }))
    }
  } catch (error) {
    console.log("CryptoCompare API fetch failed, trying alternative source")
  }

  return null
}

// Function to fetch from CoinGecko
async function fetchFromCoinGecko(): Promise<CryptoNewsItem[] | null> {
  try {
    console.log("Fetching news from CoinGecko...")
    const response = await fetch("https://api.coingecko.com/api/v3/news")

    if (response.ok) {
      const data = await response.json()
      console.log(`Retrieved ${data?.length || 0} articles from CoinGecko`)
      return data.slice(0, 14).map((item: any) => ({
        id: item.id || Math.random().toString(36).substring(2),
        title: item.title,
        url: item.url,
        source: item.source || "CoinGecko",
        publishedAt: new Date(item.published_at || Date.now()),
        sentiment: analyzeSentiment(item.title, item.description),
        summary: item.description?.substring(0, 200) + "..." || "",
      }))
    }
  } catch (error) {
    console.log("CoinGecko API fetch failed, trying another source")
  }

  return null
}

// Function to fetch from Coinpaprika
async function fetchFromCoinpaprika(): Promise<CryptoNewsItem[] | null> {
  try {
    console.log("Fetching news from Coinpaprika...")
    const response = await fetch("https://api.coinpaprika.com/v1/coins/btc-bitcoin/events")

    if (response.ok) {
      const data = await response.json()
      console.log(`Retrieved ${data?.length || 0} articles from Coinpaprika`)
      return data.slice(0, 14).map((item: any) => ({
        id: item.id || Math.random().toString(36).substring(2),
        title: item.name || item.description.substring(0, 60) + "...",
        url: item.link || "https://coinpaprika.com/",
        source: "Coinpaprika",
        publishedAt: new Date(item.date || Date.now()),
        sentiment: analyzeSentiment(item.name, item.description),
        summary: item.description?.substring(0, 200) + "..." || "",
      }))
    }
  } catch (error) {
    console.log("Coinpaprika API fetch failed")
  }

  return null
}

// Function to analyze sentiment based on title and content
function analyzeSentiment(title: string, content?: string): "bullish" | "bearish" | "neutral" {
  const text = (title + " " + (content || "")).toLowerCase()

  // Bullish keywords
  const bullishTerms = [
    "surge",
    "soar",
    "rally",
    "jump",
    "gain",
    "rise",
    "climb",
    "bullish",
    "uptrend",
    "breakout",
    "all-time high",
    "ath",
    "moon",
    "positive",
    "growth",
    "adoption",
    "institutional",
    "buy",
    "accumulate",
    "strong",
    "momentum",
    "outperform",
    "recover",
    "rebound",
    "support",
    "confidence",
  ]

  // Bearish keywords
  const bearishTerms = [
    "crash",
    "plunge",
    "drop",
    "fall",
    "decline",
    "bearish",
    "downtrend",
    "correction",
    "sell-off",
    "dump",
    "weak",
    "loss",
    "negative",
    "fear",
    "risk",
    "warning",
    "concern",
    "bubble",
    "overvalued",
    "resistance",
    "struggle",
    "tumble",
    "slump",
    "collapse",
    "vulnerability",
    "panic",
  ]

  // Count occurrences of bullish and bearish terms
  let bullishCount = 0
  let bearishCount = 0

  bullishTerms.forEach((term) => {
    const regex = new RegExp(`\\b${term}\\b`, "gi")
    const matches = text.match(regex)
    if (matches) bullishCount += matches.length
  })

  bearishTerms.forEach((term) => {
    const regex = new RegExp(`\\b${term}\\b`, "gi")
    const matches = text.match(regex)
    if (matches) bearishCount += matches.length
  })

  // Determine sentiment based on counts
  if (bullishCount > bearishCount + 1) return "bullish"
  if (bearishCount > bullishCount + 1) return "bearish"
  return "neutral"
}
