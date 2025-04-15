import { getArticlesByDate, getAvailableArchiveDates } from "@/lib/db-service"
import { ArrowLeft, ArrowRight, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { ArchiveArticleList } from "@/components/archive-article-list"
import { Button } from "@/components/ui/button"
import type { Metadata } from "next"
import { HeaderNav } from "@/components/header-nav"
import { Footer } from "@/components/footer"

interface ArchiveDatePageProps {
  params: {
    date: string // YYYY-MM-DD format
  }
}

// Generate static params for all available dates
export async function generateStaticParams() {
  const dates = await getAvailableArchiveDates()
  return dates.map((date) => ({
    date,
  }))
}

export async function generateMetadata({ params }: ArchiveDatePageProps): Promise<Metadata> {
  const { date } = params

  // Format date for display
  const displayDate = new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return {
    title: `Crypto News Archive - ${displayDate}`,
    description: `Archive of cryptocurrency news articles from ${displayDate}`,
    openGraph: {
      title: `Crypto News Archive - ${displayDate}`,
      description: `Browse cryptocurrency news articles from ${displayDate}`,
      type: "article",
      publishedTime: date,
    },
    alternates: {
      canonical: `/archive/${date}`,
    },
  }
}

export default async function ArchiveDatePage({ params }: ArchiveDatePageProps) {
  const { date } = params

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return (
      <div className="min-h-screen bg-[#1a1f2e]">
        <HeaderNav />
        <div className="p-4">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex items-center">
              <Link href="/archive">
                <Button variant="outline" size="sm" className="mr-4">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Archive
                </Button>
              </Link>
              <h1 className="text-2xl font-bold">Invalid Date Format</h1>
            </div>
            <div className="bg-[#1e2538] rounded-lg p-6 text-center">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Invalid Date Format</h2>
              <p className="text-muted-foreground">Please use the format YYYY-MM-DD for dates.</p>
              <Link href="/archive">
                <Button className="mt-4">Return to Archive</Button>
              </Link>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  // Get articles for the specified date
  const articles = await getArticlesByDate(new Date(date))

  // Format date for display
  const displayDate = new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  // Calculate previous and next day
  const currentDate = new Date(date)
  const prevDate = new Date(currentDate)
  prevDate.setDate(prevDate.getDate() - 1)
  const nextDate = new Date(currentDate)
  nextDate.setDate(nextDate.getDate() + 1)

  const formatDateForUrl = (date: Date): string => {
    return date.toISOString().split("T")[0] // YYYY-MM-DD
  }

  return (
    <div className="min-h-screen bg-[#1a1f2e]">
      <HeaderNav />
      <div className="p-4">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center">
              <Link href="/archive">
                <Button variant="outline" size="sm" className="mr-4">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Archive
                </Button>
              </Link>
              <h1 className="text-2xl font-bold">Crypto News Archive - {displayDate}</h1>
            </div>

            <div className="flex items-center space-x-2">
              <Link href={`/archive/${formatDateForUrl(prevDate)}`}>
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Previous Day
                </Button>
              </Link>

              <Link href="/">
                <Button variant="outline" size="sm">
                  Dashboard
                </Button>
              </Link>

              <Link href={`/archive/${formatDateForUrl(nextDate)}`}>
                <Button variant="outline" size="sm">
                  Next Day <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="bg-[#1e2538] rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Articles from {displayDate}</h2>

            {articles.length > 0 ? (
              <ArchiveArticleList articles={articles} />
            ) : (
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Articles Found</h3>
                <p className="text-muted-foreground mb-6">
                  There are no archived articles available for {displayDate}.
                </p>
                <div className="flex justify-center gap-4">
                  <Link href="/archive">
                    <Button variant="outline">Browse Archive</Button>
                  </Link>
                  <Link href="/">
                    <Button>Return to Dashboard</Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
