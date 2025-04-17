import { calculateMonthlyAverages, calculateMonthlyPositiveProb } from "./seasonality-data";
import { supabase } from "./supabase-client";

// Get monthly average returns from cache or calculate
export async function getMonthlyAverages(): Promise<Record<number, number>> {
  try {
    if (!supabase) {
      console.warn("Supabase client not available, using direct calculation");
      return calculateMonthlyAverages();
    }

    // Try to get from cache first
    const { data, error } = await supabase
      .from("seasonality_cache")
      .select("value")
      .eq("key", "monthly_averages")
      .single();

    if (error || !data) {
      console.log("Cache miss for monthly_averages, calculating fresh data");
      const averages = calculateMonthlyAverages();
      
      // Store in cache for future use
      try {
        await supabase.from("seasonality_cache").upsert({
          key: "monthly_averages",
          value: averages,
          updated_at: new Date().toISOString()
        });
      } catch (cacheError) {
        console.error("Error caching monthly averages:", cacheError);
      }
      
      return averages;
    }

    return data.value;
  } catch (error) {
    console.error("Error getting monthly averages:", error);
    // Fallback to direct calculation
    return calculateMonthlyAverages();
  }
}

// Get monthly positive probability from cache or calculate
export async function getMonthlyPositiveProb(): Promise<Record<number, number>> {
  try {
    if (!supabase) {
      console.warn("Supabase client not available, using direct calculation");
      return calculateMonthlyPositiveProb();
    }

    // Try to get from cache first
    const { data, error } = await supabase
      .from("seasonality_cache")
      .select("value")
      .eq("key", "monthly_positive_prob")
      .single();

    if (error || !data) {
      console.log("Cache miss for monthly_positive_prob, calculating fresh data");
      const probabilities = calculateMonthlyPositiveProb();
      
      // Store in cache for future use
      try {
        await supabase.from("seasonality_cache").upsert({
          key: "monthly_positive_prob",
          value: probabilities,
          updated_at: new Date().toISOString()
        });
      } catch (cacheError) {
        console.error("Error caching monthly probabilities:", cacheError);
      }
      
      return probabilities;
    }

    return data.value;
  } catch (error) {
    console.error("Error getting monthly probabilities:", error);
    // Fallback to direct calculation
    return calculateMonthlyPositiveProb();
  }
}

// Get detailed stats for a specific month
export async function getMonthlyStats(month: number): Promise<any> {
  try {
    if (!supabase) {
      console.warn("Supabase client not available, using direct calculation");
      // Import dynamically to avoid circular dependencies
      const { useMonthlyStats } = await import("./seasonality-data");
      return useMonthlyStats(month);
    }

    // Try to get from cache first
    const { data, error } = await supabase
      .from("seasonality_cache")
      .select("value")
      .eq("key", `monthly_stats_${month}`)
      .single();

    if (error || !data) {
      console.log(`Cache miss for monthly_stats_${month}, calculating fresh data`);
      // Import dynamically to avoid circular dependencies
      const { useMonthlyStats } = await import("./seasonality-data");
      const stats = useMonthlyStats(month);
      
      // Store in cache for future use
      try {
        await supabase.from("seasonality_cache").upsert({
          key: `monthly_stats_${month}`,
          value: stats,
          updated_at: new Date().toISOString()
        });
      } catch (cacheError) {
        console.error(`Error caching monthly stats for month ${month}:`, cacheError);
      }
      
      return stats;
    }

    return data.value;
  } catch (error) {
    console.error(`Error getting monthly stats for month ${month}:`, error);
    // Fallback to direct calculation
    const { useMonthlyStats } = await import("./seasonality-data");
    return useMonthlyStats(month);
  }
}

// Invalidate all seasonality caches
export async function invalidateSeasonalityCache(): Promise<boolean> {
  try {
    if (!supabase) {
      console.warn("Supabase client not available, cannot invalidate cache");
      return false;
    }

    const { error } = await supabase
      .from("seasonality_cache")
      .delete()
      .like("key", "monthly_%");

    if (error) {
      console.error("Error invalidating seasonality cache:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error invalidating seasonality cache:", error);
    return false;
  }
}
