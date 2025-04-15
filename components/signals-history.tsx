"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowDown, ArrowUp, ArrowLeft, BarChart2, Calendar } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { getCompletedSignals, calculateSignalStats, type TradingSignal, type SignalStats } from "@/lib/signals-service"
import Link from "next/link"
import { DatePicker } from "@/components/ui/date-picker"

export function SignalsHistory() {
  const [signals, setSignals] = useState<TradingSignal[]>([])
  const [stats, setStats] = useState<SignalStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("history")
  const [pairFilter, setPairFilter] = useState<string>("all")
  const [timeframeFilter, setTimeframeFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [availablePairs, setAvailablePairs] = useState<string[]>([])
  const [availableTimeframes, setAvailableTimeframes] = useState<string[]>([])

  // Load signals and stats
  useEffect(() => {
    async function loadData() {
      setIsLoading(true)

      try {
        // Build filters
        const filters: any = {}

        if (pairFilter !== "all") {
          filters.pair = pairFilter
        }

        if (timeframeFilter !== "all") {
          filters.timeframe = timeframeFilter
        }

        if (typeFilter !== "all") {
          filters.signalType = typeFilter
        }

        if (dateFrom) {
          filters.dateFrom = dateFrom
        }

        if (dateTo) {
          filters.dateTo = dateTo
        }

        // Fetch signals
        const completedSignals = await getCompletedSignals(100, 0, filters)
        setSignals(completedSignals)

        // Extract available pairs and timeframes
        const pairs = new Set<string>()
        const timeframes = new Set<string>()

        completedSignals.forEach((signal) => {
          pairs.add(signal.pair)
          timeframes.add(signal.timeframe)
        })

        setAvailablePairs(Array.from(pairs))
        setAvailableTimeframes(Array.from(timeframes))

        // Calculate stats
        const signalStats = await calculateSignalStats(filters)
        setStats(signalStats)
      } catch (error) {
        console.error("Error loading signals data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [pairFilter, timeframeFilter, typeFilter, dateFrom, dateTo])

  // Format price with appropriate precision
  const formatPrice = (price: number) => {
    if (price >= 1000) {
      return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    } else if (price >= 1) {
      return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
    } else {
      return price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })
    }
  }

  // Format percentage
  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`
  }

  // Reset filters
  const resetFilters = () => {
    setPairFilter("all")
    setTimeframeFilter("all")
    setTypeFilter("all")
    setDateFrom(undefined)
    setDateTo(undefined)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Signal History & Statistics</h1>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Signal History
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            Performance Stats
          </TabsTrigger>
        </TabsList>

        {/* Filters */}
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Filters</CardTitle>
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Pair</label>
                <Select value={pairFilter} onValueChange={setPairFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Pairs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Pairs</SelectItem>
                    {availablePairs.map((pair) => (
                      <SelectItem key={pair} value={pair}>
                        {pair}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Timeframe</label>
                <Select value={timeframeFilter} onValueChange={setTimeframeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Timeframes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Timeframes</SelectItem>
                    {availableTimeframes.map((tf) => (
                      <SelectItem key={tf} value={tf}>
                        {tf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Type</label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="long">Long</SelectItem>
                    <SelectItem value="short">Short</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Date Range</label>
                <div className="flex gap-2">
                  <DatePicker date={dateFrom} setDate={setDateFrom} placeholder="From" />
                  <DatePicker date={dateTo} setDate={setDateTo} placeholder="To" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Completed Signals</CardTitle>
              <CardDescription>History of your completed trading signals</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : signals.length > 0 ? (
                <div className="space-y-4">
                  {signals.map((signal) => (
                    <div key={signal.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {signal.type === "long" ? (
                            <Badge variant="outline" className="bg-success/10 text-success">
                              <ArrowUp className="mr-1 h-3 w-3" /> LONG
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive">
                              <ArrowDown className="mr-1 h-3 w-3" /> SHORT
                            </Badge>
                          )}
                          <span className="font-medium">{signal.pair}</span>
                          <Badge variant="secondary">{signal.timeframe}</Badge>
                          <Badge variant="outline">{signal.source}</Badge>
                        </div>
                        <Badge variant={signal.profitLoss && signal.profitLoss > 0 ? "success" : "destructive"}>
                          {signal.profitLossPercent && signal.profitLossPercent > 0 ? "+" : ""}
                          {signal.profitLossPercent?.toFixed(2)}%
                        </Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="rounded bg-background/50 p-2">
                          <div className="text-xs text-muted-foreground">Entry</div>
                          <div className="font-medium">${formatPrice(signal.entry)}</div>
                        </div>
                        <div className="rounded bg-background/50 p-2">
                          <div className="text-xs text-muted-foreground">Exit</div>
                          <div className="font-medium">${formatPrice(signal.exitPrice || 0)}</div>
                        </div>
                        <div className="rounded bg-background/50 p-2">
                          <div className="text-xs text-muted-foreground">Exit Type</div>
                          <div className="font-medium capitalize">
                            {signal.exitType === "tp"
                              ? "Take Profit"
                              : signal.exitType === "sl"
                                ? "Stop Loss"
                                : "Manual"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          {signal.entryTime.toLocaleDateString()} - {signal.exitTime?.toLocaleDateString()}
                        </div>
                        <div className="text-sm">
                          P&L:{" "}
                          <span
                            className={signal.profitLoss && signal.profitLoss > 0 ? "text-success" : "text-destructive"}
                          >
                            {signal.profitLoss && signal.profitLoss > 0 ? "+" : ""}${signal.profitLoss?.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No completed signals found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Overview</CardTitle>
                <CardDescription>Summary of your trading performance</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : stats ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Win Rate</span>
                        <span className="text-sm font-medium">{formatPercent(stats.winRate)}</span>
                      </div>
                      <Progress
                        value={stats.winRate}
                        className="h-2"
                        indicatorColor={
                          stats.winRate >= 60 ? "bg-success" : stats.winRate >= 40 ? "bg-yellow-500" : "bg-destructive"
                        }
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{stats.winningSignals} winning trades</span>
                        <span>{stats.losingSignals} losing trades</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#121826] p-3 rounded-lg">
                        <div className="text-xs text-muted-foreground">Total Profit/Loss</div>
                        <div
                          className={`text-xl font-bold ${stats.totalProfitLoss > 0 ? "text-success" : "text-destructive"}`}
                        >
                          {stats.totalProfitLoss > 0 ? "+" : ""}${stats.totalProfitLoss.toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-[#121826] p-3 rounded-lg">
                        <div className="text-xs text-muted-foreground">Profit Factor</div>
                        <div className="text-xl font-bold">
                          {stats.profitFactor === Number.POSITIVE_INFINITY ? "∞" : stats.profitFactor.toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-[#121826] p-3 rounded-lg">
                        <div className="text-xs text-muted-foreground">Expectancy</div>
                        <div
                          className={`text-xl font-bold ${stats.expectancy > 0 ? "text-success" : "text-destructive"}`}
                        >
                          {stats.expectancy > 0 ? "+" : ""}
                          {stats.expectancy.toFixed(2)}%
                        </div>
                      </div>
                      <div className="bg-[#121826] p-3 rounded-lg">
                        <div className="text-xs text-muted-foreground">Average RRR</div>
                        <div className="text-xl font-bold">{stats.averageRRR.toFixed(2)}</div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-sm font-medium">Trade Metrics</h3>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Total Trades</span>
                          <span className="text-sm font-medium">{stats.totalSignals}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Average Win</span>
                          <span className="text-sm font-medium text-success">
                            +{formatPercent(stats.averageProfitPercent)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Average Loss</span>
                          <span className="text-sm font-medium text-destructive">
                            -{formatPercent(stats.averageLossPercent)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Largest Win</span>
                          <span className="text-sm font-medium text-success">+${stats.largestWin.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Largest Loss</span>
                          <span className="text-sm font-medium text-destructive">-${stats.largestLoss.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No statistics available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Breakdown</CardTitle>
                <CardDescription>Detailed analysis of your trading performance</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : stats && stats.totalSignals > 0 ? (
                  <div className="space-y-6">
                    {/* Win/Loss Ratio Chart */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Win/Loss Ratio</h3>
                      <div className="h-8 w-full bg-background rounded-full overflow-hidden">
                        <div className="h-full bg-success" style={{ width: `${stats.winRate}%` }}></div>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-success">
                          {stats.winningSignals} Wins ({formatPercent(stats.winRate)})
                        </span>
                        <span className="text-destructive">
                          {stats.losingSignals} Losses ({formatPercent(100 - stats.winRate)})
                        </span>
                      </div>
                    </div>

                    {/* Exit Type Breakdown */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Exit Types</h3>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-[#121826] p-3 rounded-lg text-center">
                          <div className="text-xs text-muted-foreground">Take Profit</div>
                          <div className="text-lg font-bold text-success">
                            {signals.filter((s) => s.exitType === "tp").length}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatPercent((signals.filter((s) => s.exitType === "tp").length / signals.length) * 100)}
                          </div>
                        </div>
                        <div className="bg-[#121826] p-3 rounded-lg text-center">
                          <div className="text-xs text-muted-foreground">Stop Loss</div>
                          <div className="text-lg font-bold text-destructive">
                            {signals.filter((s) => s.exitType === "sl").length}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatPercent((signals.filter((s) => s.exitType === "sl").length / signals.length) * 100)}
                          </div>
                        </div>
                        <div className="bg-[#121826] p-3 rounded-lg text-center">
                          <div className="text-xs text-muted-foreground">Manual</div>
                          <div className="text-lg font-bold">
                            {signals.filter((s) => s.exitType === "manual").length}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatPercent(
                              (signals.filter((s) => s.exitType === "manual").length / signals.length) * 100,
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Signal Type Breakdown */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Signal Types</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-[#121826] p-3 rounded-lg">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="text-xs text-muted-foreground">Long Signals</div>
                              <div className="text-lg font-bold">{signals.filter((s) => s.type === "long").length}</div>
                            </div>
                            <ArrowUp className="h-6 w-6 text-success" />
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Win Rate:{" "}
                            {formatPercent(
                              (signals.filter((s) => s.type === "long" && s.profitLoss && s.profitLoss > 0).length /
                                Math.max(1, signals.filter((s) => s.type === "long").length)) *
                                100,
                            )}
                          </div>
                        </div>
                        <div className="bg-[#121826] p-3 rounded-lg">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="text-xs text-muted-foreground">Short Signals</div>
                              <div className="text-lg font-bold">
                                {signals.filter((s) => s.type === "short").length}
                              </div>
                            </div>
                            <ArrowDown className="h-6 w-6 text-destructive" />
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Win Rate:{" "}
                            {formatPercent(
                              (signals.filter((s) => s.type === "short" && s.profitLoss && s.profitLoss > 0).length /
                                Math.max(1, signals.filter((s) => s.type === "short").length)) *
                                100,
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Timeframe Performance */}
                    {availableTimeframes.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">Timeframe Performance</h3>
                        <div className="space-y-1">
                          {availableTimeframes.map((tf) => {
                            const tfSignals = signals.filter((s) => s.timeframe === tf)
                            const winCount = tfSignals.filter((s) => s.profitLoss && s.profitLoss > 0).length
                            const winRate = (winCount / Math.max(1, tfSignals.length)) * 100

                            return (
                              <div key={tf} className="flex items-center gap-2">
                                <div className="w-16 text-xs">{tf}</div>
                                <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${winRate >= 50 ? "bg-success" : "bg-destructive"}`}
                                    style={{ width: `${winRate}%` }}
                                  ></div>
                                </div>
                                <div className="w-16 text-xs text-right">{formatPercent(winRate)}</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No statistics available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
