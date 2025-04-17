import { runSignalDiagnostics } from "@/lib/diagnostics"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Capture console output
    const logs: string[] = []
    const originalConsoleLog = console.log
    
    console.log = (...args) => {
      logs.push(args.join(" "))
      originalConsoleLog(...args)
    }
    
    await runSignalDiagnostics()
    
    // Restore original console.log
    console.log = originalConsoleLog
    
    return NextResponse.json({ success: true, logs })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
