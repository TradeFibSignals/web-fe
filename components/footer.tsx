import Link from "next/link"
import { ExternalLink, Github, BarChart2, AlertTriangle, Scale, Mail } from "lucide-react"

export function Footer() {
  return (
    <footer className="bg-[#1e2538] text-gray-300 py-12 mt-8 border-t border-gray-800">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Column 1 - About */}
          <div>
            <h3 className="text-white text-lg font-bold mb-4">Trade Fib Signals</h3>
            <p className="text-gray-400 text-sm">
              Advanced Bitcoin intraday prediction and analysis tool for cryptocurrency traders.
            </p>
          </div>

          {/* Column 2 - Resources */}
          <div>
            <h3 className="text-white text-lg font-bold mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://www.tradingview.com/pro/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-primary flex items-center gap-2 text-sm transition-colors"
                >
                  <BarChart2 className="h-4 w-4" />
                  TradingView Pro
                </a>
              </li>
              <li>
                <a
                  href="https://www.binance.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-primary flex items-center gap-2 text-sm transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Binance Exchange
                </a>
              </li>
              <li>
                <a
                  href="https://www.coingecko.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-primary flex items-center gap-2 text-sm transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  CoinGecko
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3 - Legal */}
          <div>
            <h3 className="text-white text-lg font-bold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/terms"
                  className="text-gray-400 hover:text-primary flex items-center gap-2 text-sm transition-colors"
                >
                  <Scale className="h-4 w-4" />
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-gray-400 hover:text-primary flex items-center gap-2 text-sm transition-colors"
                >
                  <Scale className="h-4 w-4" />
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/disclaimer"
                  className="text-gray-400 hover:text-primary flex items-center gap-2 text-sm transition-colors"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Trading Disclaimer
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4 - Connect */}
          <div>
            <h3 className="text-white text-lg font-bold mb-4">Connect</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-primary flex items-center gap-2 text-sm transition-colors"
                >
                  <Github className="h-4 w-4" />
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="mailto:contact@btcintradaypredictor.com"
                  className="text-gray-400 hover:text-primary flex items-center gap-2 text-sm transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  contact@btcintradaypredictor.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright and Disclaimer */}
        <div className="mt-12 pt-8 border-t border-gray-800/50 text-center text-xs text-gray-500">
          <p>© {new Date().getFullYear()} Trade Fib Signals. All rights reserved.</p>
          <p className="mt-2">This website is for informational purposes only. Not financial advice.</p>
        </div>
      </div>
    </footer>
  )
}
