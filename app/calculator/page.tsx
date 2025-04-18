import { CalculatorContent } from "@/components/calculator-content"

export const metadata = {
  title: "Position Calculator | Trade Fib Signals",
  description: "Calculate optimal position sizes based on your risk tolerance",
}

export default function CalculatorPage() {
  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6">
      <CalculatorContent />
    </div>
  )
}
