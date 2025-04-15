"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface ArchiveArticle {
  id: number
  title: string
  excerpt: string
  source_url: string
  category: string
  tags: string
  published_at: string
  archived_at: string
  display_date: string
  sentiment: string
}

interface ArchiveArticleListProps {
  articles: ArchiveArticle[]
}

export function ArchiveArticleList({ articles }: ArchiveArticleListProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const articlesPerPage = 10

  // Calculate total pages
  const totalPages = Math.ceil(articles.length / articlesPerPage)

  // Get current articles
  const indexOfLastArticle = currentPage * articlesPerPage
  const indexOfFirstArticle = indexOfLastArticle - articlesPerPage
  const currentArticles = articles.slice(indexOfFirstArticle, indexOfLastArticle)

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Get sentiment badge
  const getSentimentBadge = (sentiment: string) => {
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

  return (
    <div className="space-y-6">
      {/* Articles list */}
      <div className="space-y-4">
        {currentArticles.map((article) => (
          <Card key={article.id} className="crypto-news-item">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <a
                    href={article.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lg font-bold hover:text-primary transition-colors"
                  >
                    {article.title}
                  </a>

                  {article.excerpt && <p className="text-sm text-muted-foreground mt-2">{article.excerpt}</p>}
                </div>

                <div className="ml-4 flex flex-col items-end space-y-2">
                  {getSentimentBadge(article.sentiment)}
                  <span className="text-xs text-muted-foreground">{formatDate(article.published_at)}</span>
                </div>
              </div>

              <div className="mt-2 flex items-center text-xs text-muted-foreground">
                <span className="bg-[#121826] px-2 py-1 rounded">{article.category}</span>

                {article.tags && (
                  <span className="ml-2">
                    {article.tags.split(",").map((tag) => (
                      <span key={tag} className="ml-1 bg-[#121826] px-2 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded bg-[#121826] disabled:opacity-50"
            >
              Previous
            </button>

            <div className="flex items-center space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded ${
                    currentPage === page ? "bg-primary text-white" : "bg-[#121826] hover:bg-[#1a2436]"
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded bg-[#121826] disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
