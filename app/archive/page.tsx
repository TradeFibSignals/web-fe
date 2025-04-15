import { getAvailableArchiveDates } from "@/lib/db-service"
import { ArchiveCalendar } from "@/components/archive-calendar"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { HeaderNav } from "@/components/header-nav"
import { Footer } from "@/components/footer"

export const metadata = {
  title: "Crypto News Archive",
  description: "Archive of cryptocurrency news articles organized by date",
  openGraph: {
    title: "Crypto News Archive",
    description: "Browse our comprehensive archive of cryptocurrency news articles",
    type: "website",
  },
  alternates: {
    canonical: "/archive",
  },
}

export default async function ArchivePage() {
  // Get available dates from the database
  const dates = await getAvailableArchiveDates()

  return (
    <div className="min-h-screen bg-[#1a1f2e]">
      <HeaderNav />
      <div className="p-4">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center">
            <Link href="/">
              <Button variant="outline" size="sm" className="mr-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Crypto News Archive</h1>
          </div>

          <div className="bg-[#1e2538] rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Available Archive Dates</h2>

            {dates.length > 0 ? (
              <ArchiveCalendar dates={dates} />
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No archived news available yet.</p>
                <p className="text-sm">Check back later as our system automatically archives news articles daily.</p>
                <Link href="/">
                  <Button className="mt-4">Return to Dashboard</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
