"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface Signal {
  signal_id: string
  signal_type: "long" | "short"
  entry_price: number
  stop_loss: number
  take_profit: number
  pair: string
  timeframe: string
  signal_source: string
  created_at: string
  risk_reward_ratio: number
  seasonality?: string
  positive_probability?: number
  entry_hit?: boolean
  entry_hit_time?: string
}

export function TradingSignalsPanel({ pair, timeframe }: { pair: string; timeframe: string }) {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchSignals = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/signals/get?pair=${pair}&timeframe=${timeframe}`)

        if (!response.ok) {
          throw new Error("Failed to fetch signals")
        }

        const data = await response.json()
        setSignals(data.signals || [])
      } catch (error) {
        console.error("Error fetching signals:", error)
        toast({
          title: "Error",
          description: "Failed to load trading signals",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchSignals()

    // Nastavení intervalu pro pravidelnou aktualizaci
    const intervalId = setInterval(fetchSignals, 60000) // Aktualizace každou minutu

    return () => clearInterval(intervalId)
  }, [pair, timeframe, toast])

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg">Trading Signals</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (signals.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg">Trading Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-4">
            No active signals for {pair} on {timeframe} timeframe
          </p>
        </CardContent>
      </Card>
    )
  }

  // Rozdělení signálů na long a short
  const longSignals = signals.filter((signal) => signal.signal_type === "long")
  const shortSignals = signals.filter((signal) => signal.signal_type === "short")

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Trading Signals</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="long">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="long">Long ({longSignals.length})</TabsTrigger>
            <TabsTrigger value="short">Short ({shortSignals.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="long">
            {longSignals.length > 0 ? (
              <div className="space-y-4">
                {longSignals.map((signal) => (
                  <SignalCard key={signal.signal_id} signal={signal} />
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">No active long signals</p>
            )}
          </TabsContent>

          <TabsContent value="short">
            {shortSignals.length > 0 ? (
              <div className="space-y-4">
                {shortSignals.map((signal) => (
                  <SignalCard key={signal.signal_id} signal={signal} />
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">No active short signals</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function SignalCard({ signal }: { signal: Signal }) {
  const formattedDate = new Date(signal.created_at).toLocaleString()

  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <Badge variant={signal.signal_type === "long" ? "default" : "destructive"}>
            {signal.signal_type.toUpperCase()}
          </Badge>
          <span className="ml-2 text-sm text-muted-foreground">{formattedDate}</span>
        </div>
        <Badge variant="outline">{signal.signal_source}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div>
          <p className="text-xs text-muted-foreground">Entry</p>
          <p className="font-medium">{signal.entry_price.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Stop Loss</p>
          <p className="font-medium text-red-500">{signal.stop_loss.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Take Profit</p>
          <p className="font-medium text-green-500">{signal.take_profit.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex justify-between items-center text-sm">
        <span>RR: {signal.risk_reward_ratio}:1</span>
        {signal.seasonality && (
          <span>
            {signal.seasonality} ({signal.positive_probability?.toFixed(0)}%)
          </span>
        )}
        {signal.entry_hit && <Badge variant="secondary">Entry Hit</Badge>}
      </div>
    </div>
  )
}
