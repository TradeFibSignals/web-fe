// Tento skript je určen pro spouštění pomocí cron jobu

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

    // Spuštění generování signálů
    console.log("Starting signal generation...")

    const response = await fetch(`${apiUrl}/api/signals/generate`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to start signal generation: ${response.status}`)
    }

    const data = await response.json()
    console.log("Signal generation response:", data)

    // Počkáme 5 minut a pak spustíme kontrolu stavu signálů
    console.log("Waiting 5 minutes before checking signal statuses...")
    await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000))

    // Kontrola stavu signálů
    console.log("Checking signal statuses...")

    const statusResponse = await fetch(`${apiUrl}/api/signals/generate`, {
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

    console.log("Signal generation process completed successfully")
  } catch (error) {
    console.error("Error in signal generation script:", error)
    process.exit(1)
  }
}

main()
