import { createClient } from "@supabase/supabase-js"

// Create a single supabase client for the entire application
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey)

// Function to initialize database tables if they don't exist
export async function initializeDatabase() {
  try {
    console.log("Initializing database connection...")

    // Check if Supabase client is available
    if (!supabase) {
      console.warn("Supabase client not available. Check your environment variables.")
      return false
    }

    console.log(`Using Supabase URL: ${supabaseUrl.substring(0, 15)}...`)

    // Check if the table exists
    const { data: tableExists, error } = await supabase.from("article_archive").select("id").limit(1).maybeSingle()

    if (error) {
      console.error("Error checking if table exists:", error)
      throw error
    }

    // If table doesn't exist, create it
    if (tableExists === null) {
      console.log("Table 'article_archive' not found, creating it...")

      // Create the table using SQL
      const { error: createError } = await supabase.rpc("create_article_archive_table")

      if (createError) {
        console.error("Error creating table:", createError)
        throw createError
      }

      console.log("Table 'article_archive' created successfully")
    } else {
      console.log("Table 'article_archive' already exists")
    }

    console.log("Database connection verified successfully")
    return true
  } catch (error) {
    console.error("Error initializing database:", error)
    throw error
  }
}

// Function to check if an article already exists in the database
export async function articleExists(hash: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from("article_archive").select("id").eq("hash", hash).maybeSingle()

    if (error) {
      console.error("Error checking if article exists:", error)
      return false
    }

    return !!data
  } catch (error) {
    console.error("Error checking if article exists:", error)
    return false
  }
}

// Function to insert an article into the database
export async function insertArticle(article: {
  title: string
  excerpt?: string
  source_url: string
  category?: string
  tags?: string
  published_at: Date
  hash: string
  sentiment: string
}): Promise<void> {
  try {
    console.log(`Inserting article: "${article.title.substring(0, 30)}..."`)

    const { error } = await supabase.from("article_archive").insert({
      title: article.title,
      excerpt: article.excerpt || "",
      source_url: article.source_url,
      category: article.category || "general",
      tags: article.tags || "",
      published_at: article.published_at.toISOString(),
      archived_at: new Date().toISOString(),
      display_date: new Date().toISOString().split("T")[0],
      hash: article.hash,
      sentiment: article.sentiment,
    })

    if (error) {
      console.error("Error inserting article:", error)
      throw error
    }

    console.log("Article inserted successfully")
  } catch (error) {
    console.error("Error inserting article:", error)
    throw error
  }
}

// Function to get articles for a specific date
export async function getArticlesByDate(date: Date): Promise<any[]> {
  try {
    const formattedDate = date.toISOString().split("T")[0]
    console.log(`Getting articles for date: ${formattedDate}`)

    const { data, error } = await supabase
      .from("article_archive")
      .select("*")
      .eq("display_date", formattedDate)
      .order("published_at", { ascending: false })

    if (error) {
      console.error("Supabase error when getting articles by date:", error)
      return []
    }

    console.log(`Found ${data?.length || 0} articles for date ${formattedDate}`)
    return data || []
  } catch (error) {
    console.error("Error getting articles by date:", error)
    return []
  }
}

// Function to get available archive dates
export async function getAvailableArchiveDates(): Promise<string[]> {
  try {
    console.log("Getting available archive dates...")

    const { data, error } = await supabase
      .from("article_archive")
      .select("display_date")
      .order("display_date", { ascending: false })

    if (error) {
      console.error("Error getting available archive dates:", error)
      throw error
    }

    // Extract unique dates
    const uniqueDates = new Set<string>()
    data?.forEach((item) => {
      if (item.display_date) {
        uniqueDates.add(item.display_date)
      }
    })

    const dates = Array.from(uniqueDates)
    console.log(`Found ${dates.length} unique archive dates`)
    return dates
  } catch (error) {
    console.error("Error getting available archive dates:", error)
    return []
  }
}
