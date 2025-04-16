// Health check API endpoint for the signal generator
// This should be placed in your Vercel project at app/api/health/route.ts

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
}
