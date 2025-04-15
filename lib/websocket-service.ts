// WebSocket service for real-time price updates

type WebSocketCallback = (data: any) => void

class BinanceWebSocketService {
  private socket: WebSocket | null = null
  private callbacks: Map<string, WebSocketCallback[]> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 3000 // 3 seconds
  private isConnecting = false

  // Connect to Binance WebSocket
  connect(symbol: string): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      console.log("WebSocket already connected or connecting")
      return
    }

    if (this.isConnecting) {
      console.log("WebSocket connection in progress")
      return
    }

    this.isConnecting = true

    try {
      // Use Binance Futures WebSocket endpoint for perpetual contracts
      this.socket = new WebSocket(`wss://fstream.binance.com/ws/${symbol.toLowerCase()}@ticker`)

      this.socket.onopen = () => {
        console.log("WebSocket connected")
        this.reconnectAttempts = 0
        this.isConnecting = false
      }

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          const eventType = data.e // Event type from Binance

          // Dispatch to all registered callbacks for this event type
          if (this.callbacks.has(eventType)) {
            this.callbacks.get(eventType)?.forEach((callback) => callback(data))
          }

          // Also dispatch to general callbacks
          if (this.callbacks.has("message")) {
            this.callbacks.get("message")?.forEach((callback) => callback(data))
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error)
        }
      }

      this.socket.onclose = (event) => {
        console.log(`WebSocket closed: ${event.code} ${event.reason}`)
        this.isConnecting = false

        // Attempt to reconnect if not closed cleanly
        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
          setTimeout(() => this.connect(symbol), this.reconnectDelay)
        }
      }

      this.socket.onerror = (error) => {
        console.error("WebSocket error:", error)
        this.isConnecting = false
      }
    } catch (error) {
      console.error("Error creating WebSocket:", error)
      this.isConnecting = false
    }
  }

  // Disconnect from WebSocket
  disconnect(): void {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
  }

  // Subscribe to WebSocket events
  subscribe(eventType: string, callback: WebSocketCallback): void {
    if (!this.callbacks.has(eventType)) {
      this.callbacks.set(eventType, [])
    }
    this.callbacks.get(eventType)?.push(callback)
  }

  // Unsubscribe from WebSocket events
  unsubscribe(eventType: string, callback: WebSocketCallback): void {
    if (this.callbacks.has(eventType)) {
      const callbacks = this.callbacks.get(eventType) || []
      const index = callbacks.indexOf(callback)
      if (index !== -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  // Check if WebSocket is connected
  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN
  }
}

// Create a singleton instance
export const binanceWebSocket = new BinanceWebSocketService()
