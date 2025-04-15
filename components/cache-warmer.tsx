"use client"

import { useEffect, useState } from "react"

export function CacheWarmer() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")

  useEffect(() => {
    async function warmCache() {
      try {
        setStatus("loading")
        const response = await fetch("/api/cache/seasonality")

        if (!response.ok) {
          throw new Error(`Failed to warm cache: ${response.status}`)
        }

        const data = await response.json()
        console.log("Data calculation result:", data)
        setStatus("success")
      } catch (error) {
        console.error("Error warming cache:", error)
        setStatus("error")
      }
    }

    // Warm the cache on component mount
    warmCache()
  }, [])

  // This component doesn't render anything visible
  return null
}
