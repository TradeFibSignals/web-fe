import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { CacheWarmer } from "@/components/cache-warmer"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Liquidation Vision - BTCUSDT Perpetual",
  description: "Visualize liquidation data for BTCUSDT perpetual futures on Binance",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <CacheWarmer />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}


import './globals.css'