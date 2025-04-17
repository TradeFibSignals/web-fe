"use client"

import { useEffect, useState } from "react"
import { runSignalDiagnostics } from "@/lib/diagnostics"

export default function DiagnosticsPage() {
  const [results, setResults] = useState<string>("")
  
  const runDiagnostics = async () => {
    console.clear()
    // Redirect console output to our state
    const originalConsoleLog = console.log
    let output = ""
    
    console.log = (...args) => {
      output += args.join(" ") + "\n"
      originalConsoleLog(...args)
    }
    
    await runSignalDiagnostics()
    
    // Restore original console.log
    console.log = originalConsoleLog
    setResults(output)
  }
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Diagnostics Tool</h1>
      <button 
        onClick={runDiagnostics}
        className="px-4 py-2 bg-blue-600 text-white rounded mb-4"
      >
        Run Diagnostics
      </button>
      
      {results && (
        <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-auto max-h-screen">
          {results}
        </pre>
      )}
    </div>
  )
}
