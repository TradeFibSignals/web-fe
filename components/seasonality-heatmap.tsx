"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MonthlySeasonalityDetail } from "./monthly-seasonality-detail"
import { monthNames } from "@/lib/seasonality-data"
import { useMonthlyAverages, useMonthlyProbabilities } from "@/hooks/use-seasonality-data"
import { Skeleton } from "@/components/ui/skeleton"

export function SeasonalityHeatmap() {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  // Use Redis-cached data
  const { averages: monthlyAverages, loading: loadingAverages } = useMonthlyAverages()
  const { probabilities: monthlyProbabilities, loading: loadingProbabilities } = useMonthlyProbabilities()
  
  const isLoading = loadingAverages || loadingProbabilities

  // Get color based on average return
  const getReturnColor = (average: number) => {
    if (average >= 20) return "bg-green-600"
    if (average >= 10) return "bg-green-500"
    if (average >= 5) return "bg-green-400"
    if (average > 0) return "bg-green-300"
    if (average === 0) return "bg-gray-500"
    if (average >= -5) return "bg-red-300"
    if (average >= -10) return "bg-red-400"
    if (average >= -20) return "bg-red-500"
    return "bg-red-600"
  }

  const handleMonthClick = (month: number) => {
    setSelectedMonth(month)
    setIsDialogOpen(true)
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-4 md:grid-cols-6">
        {Array.from({ length: 12 }).map((_, month) => (
          <Card
            key={month}
            className={`p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${
              isLoading ? "bg-gray-700" : getReturnColor(monthlyAverages[month] || 0)
            }`}
            onClick={() => handleMonthClick(month)}
          >
            <div className="text-center">
              <div className="font-bold text-white">{monthNames[month]}</div>
              {isLoading ? (
                <>
                  <Skeleton className="h-6 w-16 mx-auto my-1 bg-gray-600" />
                  <Skeleton className="h-4 w-12 mx-auto bg-gray-600" />
                </>
              ) : (
                <>
                  <div className="text-lg font-bold text-white">
                    {monthlyAverages[month] > 0 ? "+" : ""}
                    {(monthlyAverages[month] || 0).toFixed(1)}%
                  </div>
                  <div className="text-xs text-white/80">{(monthlyProbabilities[month] || 0).toFixed(0)}% positive</div>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedMonth !== null ? monthNames[selectedMonth] : ""} Performance History</DialogTitle>
          </DialogHeader>
          {selectedMonth !== null && <MonthlySeasonalityDetail month={selectedMonth} />}
        </DialogContent>
      </Dialog>
    </>
  )
}
