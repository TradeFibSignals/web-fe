"use client"

import type React from "react"

import { useLiquidation } from "@/context/liquidation-context"
import { useEffect, useRef, useState } from "react"

export function LiquidationHeatmap() {
  const { liquidationData, currentPrice, timeframe, tradingSignals, volumeData } = useLiquidation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [crosshairPosition, setCrosshairPosition] = useState<{ x: number; y: number } | null>(null)
  const [crosshairData, setCrosshairData] = useState<{
    price: number
    longVolume: number
    shortVolume: number
  } | null>(null)
  const [chartBounds, setChartBounds] = useState<{
    minPrice: number
    maxPrice: number
    height: number
    containerHeight: number
  } | null>(null)
  const initialRenderRef = useRef(true)
  const chartBoundsRef = useRef(chartBounds)

  // Update the ref when chartBounds changes
  useEffect(() => {
    chartBoundsRef.current = chartBounds
  }, [chartBounds])

  // Handle mouse movement for crosshair
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !chartBoundsRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Only show crosshair if mouse is within the chart area
    if (x >= 40 && x <= rect.width && y >= 0 && y <= chartBoundsRef.current.containerHeight) {
      setCrosshairPosition({ x, y })

      // Calculate price at cursor position
      const priceRange = chartBoundsRef.current.maxPrice - chartBoundsRef.current.minPrice
      const priceAtCursor = chartBoundsRef.current.maxPrice - (y / chartBoundsRef.current.height) * priceRange

      // Find the closest price bucket
      const priceMag = Math.floor(Math.log10(currentPrice))
      const priceBucketSize = Math.max(0.0001, Math.pow(10, priceMag - 2))
      const priceBucket = Math.floor(priceAtCursor / priceBucketSize) * priceBucketSize

      // Get volumes at this price level
      const longVolume = volumeData.longVolumeByPrice[priceBucket] || 0
      const shortVolume = volumeData.shortVolumeByPrice[priceBucket] || 0

      setCrosshairData({
        price: priceAtCursor,
        longVolume,
        shortVolume,
      })
    } else {
      setCrosshairPosition(null)
      setCrosshairData(null)
    }
  }

  // Handle mouse leave
  const handleMouseLeave = () => {
    setCrosshairPosition(null)
    setCrosshairData(null)
  }

  useEffect(() => {
    if (!containerRef.current) return

    // Ensure we have valid data before proceeding
    if (!liquidationData || liquidationData.length === 0 || !tradingSignals || tradingSignals.length < 2) {
      // Clear previous content
      containerRef.current.innerHTML = ""

      // Display error message if data is invalid
      const errorMsg = document.createElement("div")
      errorMsg.className = "absolute inset-0 flex items-center justify-center text-yellow-500"
      errorMsg.textContent = "Waiting for data..."
      containerRef.current?.appendChild(errorMsg)
      return
    }

    // Clear previous content
    containerRef.current.innerHTML = ""

    const containerHeight = containerRef.current.clientHeight
    const containerWidth = containerRef.current.clientWidth

    // Get price ranges from real data
    const prices = liquidationData.map((liq) => liq.price).filter((price) => !isNaN(price) && isFinite(price))

    // Safety check - if no valid prices, show error
    if (prices.length === 0) {
      const errorMsg = document.createElement("div")
      errorMsg.className = "absolute inset-0 flex items-center justify-center text-red-500"
      errorMsg.textContent = "No valid price data available"
      containerRef.current?.appendChild(errorMsg)
      return
    }

    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)

    // Ensure we have valid price data
    if (isNaN(minPrice) || isNaN(maxPrice) || minPrice === maxPrice || !isFinite(minPrice) || !isFinite(maxPrice)) {
      // Display error message if price data is invalid
      const errorMsg = document.createElement("div")
      errorMsg.className = "absolute inset-0 flex items-center justify-center text-red-500"
      errorMsg.textContent = "Invalid price data detected"
      containerRef.current?.appendChild(errorMsg)
      return
    }

    // Get support and resistance levels from trading signals
    const entrySignal = tradingSignals.find((signal) => signal.type === "entry")
    const exitSignal = tradingSignals.find((signal) => signal.type === "exit")

    if (!entrySignal || !exitSignal) {
      // Display error message if signals are missing
      const errorMsg = document.createElement("div")
      errorMsg.className = "absolute inset-0 flex items-center justify-center text-yellow-500"
      errorMsg.textContent = "Missing trading signals"
      containerRef.current?.appendChild(errorMsg)
      return
    }

    // Validate signal prices
    if (
      isNaN(entrySignal.price) ||
      isNaN(exitSignal.price) ||
      !isFinite(entrySignal.price) ||
      !isFinite(exitSignal.price)
    ) {
      const errorMsg = document.createElement("div")
      errorMsg.className = "absolute inset-0 flex items-center justify-center text-red-500"
      errorMsg.textContent = "Invalid signal prices detected"
      containerRef.current?.appendChild(errorMsg)
      return
    }

    const supportLevel = entrySignal.price
    const resistanceLevel = exitSignal.price

    // Validate current price
    if (isNaN(currentPrice) || !isFinite(currentPrice) || currentPrice <= 0) {
      const errorMsg = document.createElement("div")
      errorMsg.className = "absolute inset-0 flex items-center justify-center text-red-500"
      errorMsg.textContent = "Invalid current price detected"
      containerRef.current?.appendChild(errorMsg)
      return
    }

    // Calculate price range to display
    // Instead of centering around current price, use a fixed range based on S/R levels
    let lowestPrice, highestPrice

    // Only adjust the view on initial render, then keep it stable
    if (initialRenderRef.current) {
      // Add margin around S/R levels
      lowestPrice = Math.min(supportLevel * 0.95, currentPrice * 0.95)
      highestPrice = Math.max(resistanceLevel * 1.05, currentPrice * 1.05)
      initialRenderRef.current = false
    } else {
      // On subsequent renders, maintain the same view unless S/R levels are outside it
      if (chartBoundsRef.current) {
        lowestPrice = chartBoundsRef.current.minPrice
        highestPrice = chartBoundsRef.current.maxPrice

        // Only adjust if S/R levels are outside the current view
        if (supportLevel < lowestPrice * 1.02) {
          lowestPrice = supportLevel * 0.95
        }
        if (resistanceLevel > highestPrice * 0.98) {
          highestPrice = resistanceLevel * 1.05
        }
      } else {
        lowestPrice = Math.min(supportLevel * 0.95, currentPrice * 0.95)
        highestPrice = Math.max(resistanceLevel * 1.05, currentPrice * 1.05)
      }
    }

    // Final validation of calculated price ranges
    if (
      isNaN(lowestPrice) ||
      isNaN(highestPrice) ||
      !isFinite(lowestPrice) ||
      !isFinite(highestPrice) ||
      lowestPrice <= 0 ||
      highestPrice <= 0 ||
      lowestPrice >= highestPrice
    ) {
      const errorMsg = document.createElement("div")
      errorMsg.className = "absolute inset-0 flex items-center justify-center text-red-500"
      errorMsg.textContent = "Could not calculate valid price range"
      containerRef.current?.appendChild(errorMsg)
      return
    }

    // Calculate price range and determine appropriate rounding
    const priceMagnitude = Math.floor(Math.log10(currentPrice))
    const roundingFactor = Math.pow(10, priceMagnitude - 1)

    // Round to appropriate precision based on price magnitude
    const roundedMinPrice = Math.floor(lowestPrice / roundingFactor) * roundingFactor
    const roundedMaxPrice = Math.ceil(highestPrice / roundingFactor) * roundingFactor

    // Store chart bounds for crosshair calculations
    const newChartBounds = {
      minPrice: roundedMinPrice,
      maxPrice: roundedMaxPrice,
      height: containerHeight - 40, // Adjust for bottom margin
      containerHeight: containerHeight,
    }

    // Only update chartBounds if it has changed
    if (
      !chartBoundsRef.current ||
      chartBoundsRef.current.minPrice !== newChartBounds.minPrice ||
      chartBoundsRef.current.maxPrice !== newChartBounds.maxPrice
    ) {
      setChartBounds(newChartBounds)
    }

    // Create price levels with 5 steps
    const priceStep = (roundedMaxPrice - roundedMinPrice) / 4
    const priceLevels = [
      roundedMaxPrice,
      roundedMaxPrice - priceStep,
      roundedMaxPrice - 2 * priceStep,
      roundedMaxPrice - 3 * priceStep,
      roundedMinPrice,
    ]

    // Get time ranges from real data
    const times = liquidationData.map((liq) => liq.time).filter((time) => !isNaN(time) && isFinite(time))

    // Safety check for time data
    if (times.length === 0) {
      const errorMsg = document.createElement("div")
      errorMsg.className = "absolute inset-0 flex items-center justify-center text-red-500"
      errorMsg.textContent = "No valid time data available"
      containerRef.current?.appendChild(errorMsg)
      return
    }

    const minTime = Math.min(...times)
    const maxTime = Math.max(...times)

    // Create time intervals
    const timeIntervals = ["6h", "12h", "18h", "24h", "30h", "36h", "42h"]
    const timeStep = containerWidth / timeIntervals.length

    // Calculate spacing
    const heightStep = (containerHeight - 40) / (priceLevels.length - 1)

    // Add price labels on y-axis with appropriate formatting based on price magnitude
    priceLevels.forEach((price, index) => {
      const label = document.createElement("div")
      label.className = "absolute text-xs text-gray-400"

      // Format price label based on magnitude
      let formattedPrice
      if (price >= 1000) {
        formattedPrice = `${(price / 1000).toFixed(1)}K`
      } else if (price >= 1) {
        formattedPrice = price.toFixed(1)
      } else {
        formattedPrice = price.toFixed(4)
      }

      label.textContent = formattedPrice
      label.style.left = "0"
      label.style.top = `${index * heightStep}px`
      label.style.transform = "translateY(-50%)"
      containerRef.current?.appendChild(label)
    })

    // Add time labels on x-axis
    timeIntervals.forEach((time, index) => {
      const label = document.createElement("div")
      label.className = "absolute text-xs text-gray-400"
      label.textContent = time
      label.style.left = `${index * timeStep + 40}px`
      label.style.bottom = "-20px"
      label.style.transform = "translateX(-50%)"
      containerRef.current?.appendChild(label)
    })

    // Calculate the price difference between support and resistance
    const priceDifference = resistanceLevel - supportLevel
    const priceRangePercentage = (priceDifference / currentPrice) * 100

    // Calculate zone heights dynamically based on the price difference
    // If zones are close together, make them visually wider
    // If zones are far apart, make them visually narrower
    let exitZoneHeight, entryZoneHeight

    // Determine if the zones are close together or far apart
    const isNarrowRange = priceRangePercentage < 5 // Less than 5% difference is considered narrow
    const isWideRange = priceRangePercentage > 15 // More than 15% difference is considered wide

    // Base zone height calculation
    let baseZoneHeight
    switch (timeframe) {
      case "5m":
        baseZoneHeight = containerHeight * 0.025
        break
      case "30m":
        baseZoneHeight = containerHeight * 0.035
        break
      case "1h":
        baseZoneHeight = containerHeight * 0.045
        break
      case "4h":
        baseZoneHeight = containerHeight * 0.055
        break
      case "1d":
        baseZoneHeight = containerHeight * 0.075
        break
      case "1w":
        baseZoneHeight = containerHeight * 0.095
        break
      default:
        baseZoneHeight = containerHeight * 0.05
    }

    // Adjust zone height based on price range
    if (isNarrowRange) {
      // For narrow ranges, make zones visually wider (up to 2x)
      const scaleFactor = Math.max(1.5, 5 / priceRangePercentage) // Scale more for very narrow ranges
      exitZoneHeight = Math.min(baseZoneHeight * scaleFactor, containerHeight * 0.15) // Cap at 15% of container height
      entryZoneHeight = Math.min(baseZoneHeight * scaleFactor, containerHeight * 0.15)
    } else if (isWideRange) {
      // For wide ranges, make zones visually narrower
      const scaleFactor = Math.min(0.7, 15 / priceRangePercentage) // Scale less for very wide ranges
      exitZoneHeight = Math.max(baseZoneHeight * scaleFactor, containerHeight * 0.015) // Minimum 1.5% of container height
      entryZoneHeight = Math.max(baseZoneHeight * scaleFactor, containerHeight * 0.015)
    } else {
      // For normal ranges, use the base height
      exitZoneHeight = baseZoneHeight
      entryZoneHeight = baseZoneHeight
    }

    // Calculate positions for liquidation zones
    const exitPricePosition =
      ((roundedMaxPrice - resistanceLevel) / (roundedMaxPrice - roundedMinPrice)) * containerHeight

    const entryPricePosition =
      ((roundedMaxPrice - supportLevel) / (roundedMaxPrice - roundedMinPrice)) * containerHeight

    // Add EXIT/SELL liquidation zone (red) - resistance level
    const exitZone = document.createElement("div")
    exitZone.className = "absolute left-[40px] right-0"
    exitZone.style.top = `${exitPricePosition - exitZoneHeight / 2}px`
    exitZone.style.height = `${exitZoneHeight}px`

    // Calculate intensity based on volume
    const priceMag = Math.floor(Math.log10(currentPrice))
    const priceBucketSize = Math.max(0.0001, Math.pow(10, priceMag - 2))
    const exitBucket = Math.floor(resistanceLevel / priceBucketSize) * priceBucketSize
    const exitVolume = volumeData.longVolumeByPrice[exitBucket] || 0
    const exitIntensity = Math.min(1, exitVolume / (volumeData.maxBucketVolume || 1))

    // Create gradient with intensity
    const exitOpacityValue = 0.3 + exitIntensity * 0.5 // Range from 0.3 to 0.8
    exitZone.style.background = `linear-gradient(to bottom, rgba(239, 68, 68, ${exitOpacityValue + 0.1}), rgba(239, 68, 68, ${exitOpacityValue - 0.1}))`
    // Add border for better visibility
    exitZone.style.borderTop = "1px solid rgba(239, 68, 68, 0.8)"
    exitZone.style.borderBottom = "1px solid rgba(239, 68, 68, 0.8)"

    // Calculate the actual price at the top and bottom of the resistance zone
    const resistanceTopPrice =
      resistanceLevel + ((exitZoneHeight / 2) * (roundedMaxPrice - roundedMinPrice)) / containerHeight
    const resistanceBottomPrice =
      resistanceLevel - ((exitZoneHeight / 2) * (roundedMaxPrice - roundedMinPrice)) / containerHeight

    // Add price labels for resistance zone edges
    const resistanceTopLabel = document.createElement("div")
    resistanceTopLabel.className = "absolute text-xs text-[#ef4444] font-medium bg-[#121826] px-1 rounded"
    resistanceTopLabel.textContent = formatPrice(resistanceTopPrice)
    resistanceTopLabel.style.left = "0"
    resistanceTopLabel.style.top = `${exitPricePosition - exitZoneHeight / 2}px`
    resistanceTopLabel.style.transform = "translateY(-50%)"
    containerRef.current?.appendChild(resistanceTopLabel)

    const resistanceBottomLabel = document.createElement("div")
    resistanceBottomLabel.className = "absolute text-xs text-[#ef4444] font-medium bg-[#121826] px-1 rounded"
    resistanceBottomLabel.textContent = formatPrice(resistanceBottomPrice)
    resistanceBottomLabel.style.left = "0"
    resistanceBottomLabel.style.top = `${exitPricePosition + exitZoneHeight / 2}px`
    resistanceBottomLabel.style.transform = "translateY(-50%)"
    containerRef.current?.appendChild(resistanceBottomLabel)

    containerRef.current?.appendChild(exitZone)

    // Add EXIT marker with volume indicator
    const exitMarker = document.createElement("div")
    exitMarker.className = "absolute"
    exitMarker.style.top = `${exitPricePosition}px`
    exitMarker.style.left = `${containerWidth / 2}px`
    exitMarker.style.transform = "translateX(-50%)"

    // Size the marker based on volume
    const exitMarkerSize = 28 + exitIntensity * 16 // Range from 28px to 44px (increased from 24-40px)

    exitMarker.innerHTML = `
      <div class="rounded-full border-2 border-[#ef4444] bg-[#ef4444] bg-opacity-20 flex items-center justify-center"
           style="width: ${exitMarkerSize}px; height: ${exitMarkerSize}px">
        <span class="text-xs font-bold text-[#ef4444]">${formatVolume(exitVolume)}</span>
      </div>
      <div class="text-[#ef4444] text-xs font-bold mt-1 text-center">EXIT</div>
    `
    containerRef.current?.appendChild(exitMarker)

    // Add ENTRY/BUY liquidation zone (green) - support level
    const entryZone = document.createElement("div")
    entryZone.className = "absolute left-[40px] right-0"
    entryZone.style.top = `${entryPricePosition - entryZoneHeight / 2}px`
    entryZone.style.height = `${entryZoneHeight}px`

    // Calculate intensity based on volume
    const entryBucket = Math.floor(supportLevel / priceBucketSize) * priceBucketSize
    const entryVolume = volumeData.shortVolumeByPrice[entryBucket] || 0
    const entryIntensity = Math.min(1, entryVolume / (volumeData.maxBucketVolume || 1))

    // Create gradient with intensity
    const entryOpacityValue = 0.3 + entryIntensity * 0.5 // Range from 0.3 to 0.8
    entryZone.style.background = `linear-gradient(to top, rgba(16, 185, 129, ${entryOpacityValue + 0.1}), rgba(16, 185, 129, ${entryOpacityValue - 0.1}))`
    // Add border for better visibility
    entryZone.style.borderTop = "1px solid rgba(16, 185, 129, 0.8)"
    entryZone.style.borderBottom = "1px solid rgba(16, 185, 129, 0.8)"

    // Calculate the actual price at the top and bottom of the support zone
    const supportTopPrice =
      supportLevel + ((entryZoneHeight / 2) * (roundedMaxPrice - roundedMinPrice)) / containerHeight
    const supportBottomPrice =
      supportLevel - ((entryZoneHeight / 2) * (roundedMaxPrice - roundedMinPrice)) / containerHeight

    // Add price labels for support zone edges
    const supportTopLabel = document.createElement("div")
    supportTopLabel.className = "absolute text-xs text-[#10b981] font-medium bg-[#121826] px-1 rounded"
    supportTopLabel.textContent = formatPrice(supportTopPrice)
    supportTopLabel.style.left = "0"
    supportTopLabel.style.top = `${entryPricePosition - entryZoneHeight / 2}px`
    supportTopLabel.style.transform = "translateY(-50%)"
    containerRef.current?.appendChild(supportTopLabel)

    const supportBottomLabel = document.createElement("div")
    supportBottomLabel.className = "absolute text-xs text-[#10b981] font-medium bg-[#121826] px-1 rounded"
    supportBottomLabel.textContent = formatPrice(supportBottomPrice)
    supportBottomLabel.style.left = "0"
    supportBottomLabel.style.top = `${entryPricePosition + entryZoneHeight / 2}px`
    supportBottomLabel.style.transform = "translateY(-50%)"
    containerRef.current?.appendChild(supportBottomLabel)

    containerRef.current?.appendChild(entryZone)

    // Add ENTRY marker with volume indicator
    const entryMarker = document.createElement("div")
    entryMarker.className = "absolute"
    entryMarker.style.top = `${entryPricePosition}px`
    entryMarker.style.left = `${containerWidth / 2}px`
    entryMarker.style.transform = "translateX(-50%)"

    // Size the marker based on volume
    const entryMarkerSize = 28 + entryIntensity * 16 // Range from 28px to 44px (increased from 24-40px)

    entryMarker.innerHTML = `
      <div class="rounded-full border-2 border-[#10b981] bg-[#10b981] bg-opacity-20 flex items-center justify-center"
           style="width: ${entryMarkerSize}px; height: ${entryMarkerSize}px">
        <span class="text-xs font-bold text-[#10b981]">${formatVolume(entryVolume)}</span>
      </div>
      <div class="text-[#10b981] text-xs font-bold mt-1 text-center">ENTRY</div>
    `
    containerRef.current?.appendChild(entryMarker)

    // Add heatmap for all liquidation levels
    // This creates a Coinglass-like visualization with color intensity based on volume
    const heatmapHeight = 5 // Height of each heatmap bar

    // Find max volume for color scaling
    let maxLongVolume = 0
    let maxShortVolume = 0

    Object.values(volumeData.longVolumeByPrice).forEach((volume) => {
      maxLongVolume = Math.max(maxLongVolume, volume)
    })

    Object.values(volumeData.shortVolumeByPrice).forEach((volume) => {
      maxShortVolume = Math.max(maxShortVolume, volume)
    })

    // Add long liquidation heatmap with yellow gradient
    Object.entries(volumeData.longVolumeByPrice).forEach(([priceStr, volume]) => {
      const price = Number.parseFloat(priceStr)
      if (isNaN(price) || !isFinite(price) || price < roundedMinPrice || price > roundedMaxPrice) return

      const position = ((roundedMaxPrice - price) / (roundedMaxPrice - roundedMinPrice)) * containerHeight
      const intensity = Math.min(1, volume / (maxLongVolume || 1))

      // Create yellow gradient from dark to bright based on volume
      const heatBar = document.createElement("div")
      heatBar.className = "absolute right-0"
      heatBar.style.top = `${position - heatmapHeight / 2}px`
      heatBar.style.height = `${heatmapHeight}px`
      heatBar.style.width = `${20 + intensity * 30}px` // Width based on volume

      // Generate color from dark orange-red to bright yellow based on intensity
      const r = Math.floor(180 + intensity * 75) // 180-255
      const g = Math.floor(40 + intensity * 215) // 40-255
      const b = Math.floor(intensity * 50) // 0-50
      heatBar.style.backgroundColor = `rgb(${r}, ${g}, ${b})`

      containerRef.current?.appendChild(heatBar)
    })

    // Add short liquidation heatmap with yellow gradient
    Object.entries(volumeData.shortVolumeByPrice).forEach(([priceStr, volume]) => {
      const price = Number.parseFloat(priceStr)
      if (isNaN(price) || !isFinite(price) || price < roundedMinPrice || price > roundedMaxPrice) return

      const shortPosition = ((roundedMaxPrice - price) / (roundedMaxPrice - roundedMinPrice)) * containerHeight
      const intensity = Math.min(1, volume / (maxShortVolume || 1))

      // Create yellow gradient from dark to bright based on volume
      const heatBar = document.createElement("div")
      heatBar.className = "absolute left-[40px]"
      heatBar.style.top = `${shortPosition - heatmapHeight / 2}px`
      heatBar.style.height = `${heatmapHeight}px`
      heatBar.style.width = `${20 + intensity * 30}px` // Width based on volume

      // Generate color from dark green-yellow to bright yellow based on intensity
      const r = Math.floor(40 + intensity * 215) // 40-255
      const g = Math.floor(180 + intensity * 75) // 180-255
      const b = Math.floor(intensity * 50) // 0-50
      heatBar.style.backgroundColor = `rgb(${r}, ${g}, ${b})`

      containerRef.current?.appendChild(heatBar)
    })

    // Add current price line (yellow dashed)
    const currentPricePosition =
      ((roundedMaxPrice - currentPrice) / (roundedMaxPrice - roundedMinPrice)) * containerHeight

    const currentPriceLine = document.createElement("div")
    currentPriceLine.className = "absolute w-full border-t-2 border-dashed border-[#FFC107]"
    currentPriceLine.style.top = `${currentPricePosition}px`
    currentPriceLine.style.left = "0"
    containerRef.current?.appendChild(currentPriceLine)

    // Add current price label with appropriate formatting
    // Position the label above or below the line depending on its position in the chart
    const priceLabel = document.createElement("div")
    priceLabel.className = "absolute text-[#FFC107] text-xs font-medium bg-[#121826] px-1 rounded"
    priceLabel.textContent = currentPrice < 1 ? currentPrice.toFixed(4) : currentPrice.toFixed(2)
    priceLabel.style.right = "0"

    // Position label above or below the line based on position in chart
    // If in the upper half of the chart, place below; otherwise, place above
    if (currentPricePosition < containerHeight / 2) {
      priceLabel.style.top = `${currentPricePosition + 4}px`
      priceLabel.style.transform = "translateY(0)"
    } else {
      priceLabel.style.bottom = `${containerHeight - currentPricePosition + 4}px`
      priceLabel.style.transform = "translateY(0)"
    }

    containerRef.current?.appendChild(priceLabel)

    // Add grid lines
    priceLevels.forEach((price, index) => {
      const gridLine = document.createElement("div")
      gridLine.className = "absolute left-[40px] right-0 border-t border-gray-800"
      gridLine.style.top = `${index * heightStep}px`
      containerRef.current?.appendChild(gridLine)
    })

    timeIntervals.forEach((time, index) => {
      const gridLine = document.createElement("div")
      gridLine.className = "absolute top-0 bottom-0 border-l border-gray-800"
      gridLine.style.left = `${index * timeStep + 40}px`
      containerRef.current?.appendChild(gridLine)
    })
  }, [liquidationData, currentPrice, timeframe, tradingSignals, volumeData]) // Removed chartBounds from dependencies

  // Helper function to format volume
  function formatVolume(volume: number): string {
    if (volume === 0) return "0"
    if (volume < 1) return volume.toFixed(2)
    if (volume < 10) return volume.toFixed(1)
    if (volume < 1000) return Math.round(volume).toString()
    if (volume < 1000000) return `${(volume / 1000).toFixed(1)}K`
    return `${(volume / 1000000).toFixed(1)}M`
  }

  // Helper function to format price based on magnitude
  function formatPrice(price: number): string {
    if (price >= 10000) {
      return price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    } else if (price >= 1000) {
      return price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    } else if (price >= 100) {
      return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    } else if (price >= 10) {
      return price.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    } else if (price >= 1) {
      return price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
    } else if (price >= 0.1) {
      return price.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })
    } else if (price >= 0.01) {
      return price.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 })
    } else if (price >= 0.001) {
      return price.toLocaleString(undefined, { minimumFractionDigits: 7, maximumFractionDigits: 7 })
    } else {
      return price.toLocaleString(undefined, { minimumFractionDigits: 8, maximumFractionDigits: 8 })
    }
  }

  return (
    <div className="relative h-[400px]">
      <div
        ref={containerRef}
        className="absolute top-0 right-0 bottom-8 left-8 bg-[#121826]"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      ></div>

      {/* Crosshair */}
      {crosshairPosition && crosshairData && (
        <>
          {/* Horizontal crosshair line */}
          <div
            className="absolute left-[40px] right-0 border-t border-dashed border-gray-400 pointer-events-none z-10"
            style={{ top: `${crosshairPosition.y}px` }}
          ></div>

          {/* Volume label instead of price */}
          <div
            className="absolute left-0 bg-gray-700 text-white text-xs px-2 py-1 rounded pointer-events-none z-20"
            style={{
              top: `${crosshairPosition.y}px`,
              transform: "translateY(-50%)",
            }}
          >
            <div className="flex flex-col">
              <span className="text-[#ef4444]">L: {formatVolume(crosshairData.longVolume)}</span>
              <span className="text-[#10b981]">S: {formatVolume(crosshairData.shortVolume)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
