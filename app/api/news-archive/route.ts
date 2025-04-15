import { type NextRequest, NextResponse } from "next/server"
import { getArticlesByDate, getAvailableArchiveDates } from "@/lib/db-service"

export async function GET(request: NextRequest) {
  try {
    // Get date from query parameters
    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get("date")

    // If no date is provided, return available dates
    if (!dateParam) {
      const dates = await getAvailableArchiveDates()
      return NextResponse.json({ dates })
    }

    // Parse date
    const date = new Date(dateParam)

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD." }, { status: 400 })
    }

    // Get articles for the specified date
    const articles = await getArticlesByDate(date)

    return NextResponse.json({
      date: dateParam,
      articles,
    })
  } catch (error) {
    console.error("Error in news archive API:", error)
    return NextResponse.json({ error: "Failed to fetch archive data" }, { status: 500 })
  }
}
