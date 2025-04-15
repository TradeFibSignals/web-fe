import { Dashboard } from "@/components/dashboard"
import { LiquidationProvider } from "@/context/liquidation-context"

export default function Home() {
  return (
    <LiquidationProvider>
      <Dashboard />
    </LiquidationProvider>
  )
}
