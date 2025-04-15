"use client"

import { useLiquidation } from "@/context/liquidation-context"
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts"

export function PriceChart() {
  const { priceData } = useLiquidation()

  return (
    <div className="h-[150px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={priceData}>
          <XAxis
            dataKey="time"
            tickFormatter={(time) => {
              const date = new Date(time)
              return `${date.getHours()}h`
            }}
            stroke="#6b7280"
            tick={{ fill: "#6b7280" }}
            axisLine={{ stroke: "#374151" }}
            tickLine={{ stroke: "#374151" }}
            hide={true}
          />
          <YAxis
            domain={["auto", "auto"]}
            stroke="#6b7280"
            tick={{ fill: "#6b7280" }}
            axisLine={{ stroke: "#374151" }}
            tickLine={{ stroke: "#374151" }}
            hide={true}
            // Ensure higher values are at the top
            scale="linear"
            reversed={false}
          />
          <Line type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
