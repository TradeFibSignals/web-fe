// Skript pro generování signálů pro 5m timeframe
import fetch from "node-fetch"

async function main() {
  try {
    // Získání API klíče z proměnných prostředí
    const apiKey = process.env.SIGNAL_GENERATOR_API_KEY

    if (!apiKey) {
      console.error("Missing SIGNAL_GENERATOR_API_KEY environment variable")
      process.exit(1)
    }

    // URL API endpointu (upravte podle vašeho prostředí)
    const apiUrl = process.env.API_BASE_URL || "https://your-app-url.com"

    // Spuštění generování signálů pro 5m timeframe
    console.log("Starting signal generation for 5m timeframe...")

    const response = await fetch(`${apiUrl}/api/signals/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ timeframe: "5m" }),
    })

    if (!response.ok) {
      throw new Error(`Failed to start signal generation: ${response.status}`)
    }

    const data = await response.json()
    console.log("Signal generation response:", data)

    // Počkáme 30 sekund a pak spustíme kontrolu stavu signálů
    console.log("Waiting 30 seconds before checking signal statuses...")
    await new Promise((resolve) => setTimeout(resolve, 30 * 1000))

    // Kontrola stavu signálů
    console.log("Checking signal statuses for 5m timeframe...")

    const statusResponse = await fetch(`${apiUrl}/api/signals/generate?timeframe=5m`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
    })

    if (!statusResponse.ok) {
      throw new Error(`Failed to check signal statuses: ${statusResponse.status}`)
    }

    const statusData = await statusResponse.json()
    console.log("Signal status check response:", statusData)

    console.log("Signal generation process completed successfully for 5m timeframe")
  } catch (error) {
    console.error("Error in signal generation script:", error)
    process.exit(1)
  }
}

main()
