import { createClient } from "@supabase/supabase-js"

// Get Supabase URL and key from environment variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// Create a singleton client for client-side operations
let clientSideSupabase: ReturnType<typeof createClient> | null = null

// Check if Supabase credentials are available
const hasSupabaseCredentials = supabaseUrl && supabaseKey

// Create Supabase client for server-side operations if credentials are available
export const supabase = hasSupabaseCredentials ? createClient(supabaseUrl, supabaseKey) : null

export function getClientSupabase() {
  if (typeof window === "undefined") {
    // Server-side: return the server client or null
    return supabase
  }

  // Client-side: create the client only once if credentials are available
  if (!clientSideSupabase && hasSupabaseCredentials) {
    clientSideSupabase = createClient(supabaseUrl, supabaseKey)
  }

  return clientSideSupabase
}

// Helper function to check if Supabase is available
export function isSupabaseAvailable() {
  return hasSupabaseCredentials
}
