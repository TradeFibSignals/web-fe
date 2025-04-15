"use client"

import { useState } from "react"
import Link from "next/link"
import { Calendar } from "@/components/ui/calendar"

interface ArchiveCalendarProps {
  dates: string[]
}

export function ArchiveCalendar({ dates }: ArchiveCalendarProps) {
  const [date, setDate] = useState<Date | undefined>(new Date())

  // Convert string dates to Date objects
  const availableDates = dates.map((dateStr) => new Date(dateStr))

  // Format date for URL
  const formatDateForUrl = (date: Date): string => {
    return date.toISOString().split("T")[0] // YYYY-MM-DD
  }

  // Check if a date has archives
  const hasArchive = (date: Date): boolean => {
    return availableDates.some(
      (availableDate) => availableDate.toISOString().split("T")[0] === date.toISOString().split("T")[0],
    )
  }

  return (
    <div className="space-y-4">
      <Calendar
        mode="single"
        selected={date}
        onSelect={setDate}
        className="rounded-md border"
        modifiers={{
          hasArchive: availableDates,
        }}
        modifiersStyles={{
          hasArchive: {
            backgroundColor: "rgba(59, 130, 246, 0.2)",
            fontWeight: "bold",
          },
        }}
      />

      {date && hasArchive(date) && (
        <div className="flex justify-center">
          <Link href={`/archive/${formatDateForUrl(date)}`}>
            <button className="bg-primary text-white px-6 py-2 rounded-md hover:bg-primary/80 transition-colors">
              View Archive for {date.toLocaleDateString()}
            </button>
          </Link>
        </div>
      )}

      {date && !hasArchive(date) && (
        <p className="text-center text-muted-foreground">No archives available for {date.toLocaleDateString()}</p>
      )}
    </div>
  )
}
