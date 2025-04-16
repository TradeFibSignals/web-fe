import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Get Supabase URL and key from environment variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// Create a singleton client for client-side operations
let clientSideSupabase: ReturnType<typeof createSupabaseClient> | null = null

// Check if Supabase credentials are available
const hasSupabaseCredentials = supabaseUrl && supabaseKey

// Create Supabase client for server-side operations if credentials are available
export const supabase = hasSupabaseCredentials ? createSupabaseClient(supabaseUrl, supabaseKey) : null

export function getClientSupabase() {
  if (typeof window === "undefined") {
    // Server-side: return the server client or null
    return supabase
  }

  // Client-side: create the client only once if credentials are available
  if (!clientSideSupabase && hasSupabaseCredentials) {
    clientSideSupabase = createSupabaseClient(supabaseUrl, supabaseKey)
  }

  return clientSideSupabase
}

// Helper function to check if Supabase is available
export function isSupabaseAvailable() {
  return hasSupabaseCredentials
}

// Custom createClient function that validates environment variables
export function createClient() {
  if (!supabaseUrl) {
    throw new Error(
      "supabaseUrl is required. Please check your environment variables: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL",
    )
  }

  if (!supabaseKey) {
    throw new Error(
      "supabaseKey is required. Please check your environment variables: SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    )
  }

  return createSupabaseClient(supabaseUrl, supabaseKey)
}

// Re-export the original createClient from Supabase
export { createSupabaseClient }
