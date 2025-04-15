"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Minus, Newspaper, AlertTriangle, Archive, RefreshCw } from "lucide-react"
import { fetchCryptoNews, type CryptoNewsItem } from "@/lib/crypto-news-service"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export function CryptoNewsPanel() {
  const [news, setNews] = useState<CryptoNewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchNews = async () => {
    setLoading(true)
    setError(null)
    try {
      const newsData = await fetchCryptoNews()
      if (newsData && newsData.length > 0) {
        setNews(newsData)
        setLastUpdated(new Date())
      } else {
        throw new Error("No news data returned")
      }
    } catch (error) {
      console.error("Failed to fetch crypto news:", error)
      // Only show error if we have no existing news data
      if (news.length === 0) {
        setError("Unable to fetch news. Please try again later.")
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNews()

    // Set up auto-refresh every 5 minutes
    const intervalId = setInterval(fetchNews, 5 * 60 * 1000)

    return () => clearInterval(intervalId)
  }, [])

  // Format time ago
  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)

    if (diffDay > 0) return `${diffDay}d ago`
    if (diffHour > 0) return `${diffHour}h ago`
    if (diffMin > 0) return `${diffMin}m ago`
    return `${diffSec}s ago`
  }

  // Get sentiment badge
  const getSentimentBadge = (sentiment: "bullish" | "bearish" | "neutral") => {
    switch (sentiment) {
      case "bullish":
        return (
          <Badge variant="outline" className="bg-success/10 text-success">
            <TrendingUp className="mr-1 h-3 w-3" /> Bullish
          </Badge>
        )
      case "bearish":
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive">
            <TrendingDown className="mr-1 h-3 w-3" /> Bearish
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="bg-secondary/50 text-muted-foreground">
            <Minus className="mr-1 h-3 w-3" /> Neutral
          </Badge>
        )
    }
  }

  // Get today's date in YYYY-MM-DD format for archive link
  const getTodayDateString = () => {
    const today = new Date()
    return today.toISOString().split("T")[0]
  }

  // Get yesterday's date in YYYY-MM-DD format for archive link
  const getYesterdayDateString = () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday.toISOString().split("T")[0]
  }

  return (
    <Card className="w-full bg-[#1e2538]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Newspaper className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Crypto News</CardTitle>
              <CardDescription>Latest cryptocurrency news and updates</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/archive"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Archive className="h-4 w-4" />
              <span>Archive</span>
            </Link>
            <Link
              href={`/archive/${getTodayDateString()}`}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Today
            </Link>
            <Link
              href={`/archive/${getYesterdayDateString()}`}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Yesterday
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {loading && news.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse flex flex-col items-center">
              <div className="h-8 w-8 rounded-full bg-primary/20 mb-4"></div>
              <div className="h-4 w-48 bg-primary/20 rounded mb-2"></div>
              <div className="h-3 w-32 bg-primary/10 rounded"></div>
            </div>
          </div>
        ) : error || news.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-center">
            <div className="flex flex-col items-center">
              <AlertTriangle className="h-8 w-8 text-yellow-500 mb-2" />
              <p className="text-muted-foreground">
                {error || "No news available at the moment. Please try again later."}
              </p>
              {!loading && (
                <Button onClick={fetchNews} className="mt-4 flex items-center gap-2" variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4" /> Retry
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {/* Featured news (full width) */}
            {news.length > 0 && (
              <a href={news[0].url} target="_blank" rel="noopener noreferrer" className="block crypto-news-item p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold leading-tight">{news[0].title}</h3>
                  <div className="flex items-center gap-2 ml-4 shrink-0">{getSentimentBadge(news[0].sentiment)}</div>
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <span>{news[0].source}</span>
                  <span className="mx-2">•</span>
                  <span>{formatTimeAgo(news[0].publishedAt)}</span>
                </div>
              </a>
            )}

            {/* Grid of news items */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {news.slice(1, 4).map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="crypto-news-item p-4 flex flex-col h-full"
                >
                  <div className="mb-2">
                    <h3 className="font-bold leading-tight">{item.title}</h3>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center text-xs text-muted-foreground">
                      <span>{item.source}</span>
                      <span className="mx-2">•</span>
                      <span>{formatTimeAgo(item.publishedAt)}</span>
                    </div>
                    {getSentimentBadge(item.sentiment)}
                  </div>
                </a>
              ))}
            </div>

            {/* List of remaining news items (max 10) */}
            <div className="grid gap-4">
              {news.slice(4, 14).map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="crypto-news-item p-4"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold">{item.title}</h3>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{formatTimeAgo(item.publishedAt)}</span>
                        {getSentimentBadge(item.sentiment)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{item.source}</div>
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
