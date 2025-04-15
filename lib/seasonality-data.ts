"use client"

// Cache for seasonality data and calculations
import { useMemo } from "react"

// Historical monthly returns data
export const historicalMonthlyReturns = {
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
  1: {
    // February
    2011: 100.0,
    2012: 0.0,
    2013: 33.33,
    2014: -16.67,
    2015: 25.0,
    2016: 20.0,
    2017: 18.18,
    2018: -16.67,
    2019: 5.26,
    2020: 20.0,
    2021: 40.63,
    2022: -11.11,
    2023: 8.0,
    2024: 43.76,
  },
  2: {
    // March
    2011: 400.0,
    2012: 9.09,
    2013: 50.0,
    2014: -10.0,
    2015: 0.0,
    2016: 8.33,
    2017: 7.69,
    2018: -10.0,
    2019: 25.0,
    2020: -16.67,
    2021: 33.33,
    2022: -12.5,
    2023: 5.56,
    2024: 16.62,
  },
  3: {
    // April
    2011: 10.0,
    2012: 0.0,
    2013: 733.33,
    2014: 33.33,
    2015: 0.0,
    2016: 7.69,
    2017: 28.57,
    2018: -11.11,
    2019: 20.0,
    2020: 20.0,
    2021: 6.67,
    2022: -8.57,
    2023: 2.79,
    2024: -15.0,
  },
  4: {
    // May
    2011: 81.82,
    2012: 0.0,
    2013: -40.0,
    2014: -8.33,
    2015: 8.0,
    2016: 7.14,
    2017: 11.11,
    2018: -12.5,
    2019: 33.33,
    2020: 5.56,
    2021: -14.06,
    2022: -9.38,
    2023: -6.87,
    2024: 11.35,
  },
  5: {
    // June
    2011: 200.0,
    2012: -8.33,
    2013: -20.0,
    2014: -9.09,
    2015: 7.41,
    2016: 20.0,
    2017: -25.0,
    2018: -14.29,
    2019: 25.0,
    2020: 5.26,
    2021: -9.09,
    2022: -13.79,
    2023: 11.97,
    2024: -7.13,
  },
  6: {
    // July
    2011: -33.33,
    2012: 0.0,
    2013: 8.33,
    2014: -20.0,
    2015: -13.79,
    2016: -5.56,
    2017: -6.67,
    2018: 16.67,
    2019: 10.0,
    2020: 5.0,
    2021: -10.0,
    2022: 20.0,
    2023: -4.09,
    2024: 3.1,
  },
  7: {
    // August
    2011: -25.0,
    2012: 9.09,
    2013: -7.69,
    2014: -12.5,
    2015: 4.0,
    2016: -5.88,
    2017: 7.14,
    2018: -14.29,
    2019: -13.64,
    2020: 14.29,
    2021: 11.11,
    2022: -6.67,
    2023: -11.29,
    2024: -8.75,
  },
  8: {
    // September
    2011: -33.33,
    2012: 0.0,
    2013: 8.33,
    2014: -14.29,
    2015: 7.69,
    2016: -6.25,
    2017: 33.33,
    2018: -16.67,
    2019: -10.53,
    2020: -8.33,
    2021: -20.0,
    2022: -3.57,
    2023: 3.99,
    2024: 7.39,
  },
  9: {
    // October
    2011: 0.0,
    2012: 8.33,
    2013: 53.85,
    2014: -16.67,
    2015: 7.14,
    2016: 6.67,
    2017: 50.0,
    2018: -10.0,
    2019: -5.88,
    2020: 9.09,
    2021: 50.0,
    2022: -3.7,
    2023: 28.55,
    2024: 10.87,
  },
  10: {
    // November
    2011: -30.0,
    2012: 7.69,
    2013: 400.0,
    2014: -20.0,
    2015: 33.33,
    2016: 12.5,
    2017: 133.33,
    2018: -11.11,
    2019: -12.5,
    2020: 53.19,
    2021: 15.0,
    2022: -3.85,
    2023: 8.81,
    2024: 37.36,
  },
  11: {
    // December
    2011: -28.57,
    2012: 92.14,
    2013: -30.0,
    2014: 50.0,
    2015: 12.5,
    2016: 5.56,
    2017: 100.0,
    2018: -7.5,
    2019: 0.0,
    2020: 57.72,
    2021: -33.33,
    2022: -20.0,
    2023: 12.06,
    2024: -3.14,
  },
}

// Month names
export const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

// Pre-calculated monthly averages
const _monthlyAverages: Record<number, number> = {}
const _monthlyProbabilities: Record<number, number> = {}

// Calculate monthly averages once
export function calculateMonthlyAverages() {
  // Return cached results if already calculated
  if (Object.keys(_monthlyAverages).length === 12) {
    return _monthlyAverages
  }

  for (let month = 0; month < 12; month++) {
    const monthData = historicalMonthlyReturns[month as keyof typeof historicalMonthlyReturns]
    if (!monthData) continue

    const returns = Object.values(monthData)
    const average = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
    _monthlyAverages[month] = average
  }

  return _monthlyAverages
}

// Calculate positive probability once
export function calculateMonthlyPositiveProb() {
  // Return cached results if already calculated
  if (Object.keys(_monthlyProbabilities).length === 12) {
    return _monthlyProbabilities
  }

  for (let month = 0; month < 12; month++) {
    const monthData = historicalMonthlyReturns[month as keyof typeof historicalMonthlyReturns]
    if (!monthData) continue

    const returns = Object.values(monthData)
    const positiveCount = returns.filter((ret) => ret > 0).length
    const probability = (positiveCount / returns.length) * 100
    _monthlyProbabilities[month] = probability
  }

  return _monthlyProbabilities
}

// Custom hook for monthly stats
export function useMonthlyStats(month: number) {
  return useMemo(() => {
    const monthData = historicalMonthlyReturns[month as keyof typeof historicalMonthlyReturns]
    if (!monthData) {
      return {
        positiveYears: 0,
        negativeYears: 0,
        averageReturn: 0,
        medianReturn: 0,
        bestYear: { year: 0, return: 0 },
        worstYear: { year: 0, return: 0 },
        returns: [],
        positiveProb: 0,
      }
    }

    const returns = Object.entries(monthData).map(([year, ret]) => ({
      year: Number.parseInt(year),
      return: ret as number,
    }))

    // Sort returns for median calculation
    const sortedReturns = [...returns].sort((a, b) => a.return - b.return)
    const middleIndex = Math.floor(sortedReturns.length / 2)
    const medianReturn =
      sortedReturns.length % 2 === 0
        ? (sortedReturns[middleIndex - 1].return + sortedReturns[middleIndex].return) / 2
        : sortedReturns[middleIndex].return

    const positiveYears = returns.filter((r) => r.return > 0).length
    const negativeYears = returns.filter((r) => r.return <= 0).length
    const totalYears = returns.length
    const averageReturn = returns.reduce((sum, r) => sum + r.return, 0) / totalYears
    const bestYear = returns.reduce((best, r) => (r.return > best.return ? r : best), {
      year: 0,
      return: Number.NEGATIVE_INFINITY,
    })
    const worstYear = returns.reduce((worst, r) => (r.return < worst.return ? r : worst), {
      year: 0,
      return: Number.POSITIVE_INFINITY,
    })
    const positiveProb = (positiveYears / totalYears) * 100

    return {
      positiveYears,
      negativeYears,
      averageReturn,
      medianReturn,
      bestYear,
      worstYear,
      returns: sortedReturns.reverse(), // Reverse to show highest returns first
      positiveProb,
    }
  }, [month])
}

// Initialize calculations on module load to cache the results
calculateMonthlyAverages()
calculateMonthlyPositiveProb()
