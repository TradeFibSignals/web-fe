"use client"

import { useState, useEffect } from "react"
import { getMonthlyAverages, getMonthlyPositiveProb, getMonthlyStats } from "@/lib/seasonality-cache"

// Hook for monthly averages
export function useMonthlyAverages() {
  const [averages, setAverages] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getMonthlyAverages()
        setAverages(data)
        setError(null)
      } catch (err) {
        console.error("Error fetching monthly averages:", err)
        setError(err instanceof Error ? err : new Error("Unknown error"))
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { averages, loading, error }
}

// Hook for monthly probabilities
export function useMonthlyProbabilities() {
  const [probabilities, setProbabilities] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getMonthlyPositiveProb()
        setProbabilities(data)
        setError(null)
      } catch (err) {
        console.error("Error fetching monthly probabilities:", err)
        setError(err instanceof Error ? err : new Error("Unknown error"))
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { probabilities, loading, error }
}

// Hook for monthly stats
export function useMonthlyStats(month: number) {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getMonthlyStats(month)
        setStats(data)
        setError(null)
      } catch (err) {
        console.error(`Error fetching monthly stats for month ${month}:`, err)
        setError(err instanceof Error ? err : new Error("Unknown error"))
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [month])

  return { stats, loading, error }
}
