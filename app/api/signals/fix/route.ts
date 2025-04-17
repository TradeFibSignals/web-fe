import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { supabase } from "@/lib/supabase-client";
import { calculateMonthlyPositiveProb } from "@/lib/seasonality-data";

// Function to get current seasonality from the calculated data
async function getCurrentSeasonality() {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const currentMonth = new Date().getMonth();
  
  console.log(`Getting seasonality for ${monthNames[currentMonth]} (month index: ${currentMonth})`);
  
  try {
    // Use the actual data calculation functions from seasonality-data
    const probabilities = calculateMonthlyPositiveProb();
    const probability = probabilities[currentMonth];
    
    if (probability === undefined) {
      console.error(`No probability data found for month ${currentMonth}`);
      return { seasonality: "neutral", probability: 50 };
    }
    
    let seasonality;
    if (probability >= 60) {
      seasonality = "bullish";
    } else if (probability <= 40) {
      seasonality = "bearish";
    } else {
      seasonality = "neutral";
    }
    
    return { seasonality, probability };
    
  } catch (error) {
    console.error("Error getting seasonality:", error);
    return { seasonality: "neutral", probability: 50 };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if we're correcting seasonality
    const action = request.nextUrl.searchParams.get("action") || "all";
    
    // Check if Supabase client is available
    if (!supabase) {
      return NextResponse.json({ error: "Supabase client not available" }, { status: 500 });
    }

    const results: any = {
      timestamp: new Date().toISOString(),
      actions: []
    };
    
    // Fix seasonality if requested
    if (action === "seasonality" || action === "all") {
      try {
        // Get the correct seasonality for the current month
        const { seasonality, probability } = await getCurrentSeasonality();
        
        // Update all active signals with the correct seasonality
        const { data, error } = await supabase
          .from("generated_signals")
          .update({
            seasonality,
            positive_probability: probability,
            updated_at: new Date().toISOString()
          })
          .eq("status", "active")
          .select("count");
          
        if (error) {
          console.error("Error fixing signal seasonality:", error);
          results.actions.push({
            name: "seasonality",
            success: false,
            error: error.message
          });
        } else {
          console.log(`Fixed seasonality for active signals to ${probability}%`);
          results.actions.push({
            name: "seasonality",
            success: true,
            message: `Updated seasonality to ${seasonality} (${probability}%) for all active signals`,
            affectedRecords: data
          });
        }
      } catch (error) {
        console.error("Error fixing seasonality:", error);
        results.actions.push({
          name: "seasonality",
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Sync completed signals if requested
    if (action === "sync" || action === "all") {
      try {
        // Use the database function to sync completed signals
        const { data, error } = await supabase
          .rpc("sync_completed_signals");
          
        if (error) {
          console.error("Error syncing completed signals:", error);
          results.actions.push({
            name: "sync_completed",
            success: false,
            error: error.message
          });
        } else {
          console.log("Completed signals synced successfully:", data);
          results.actions.push({
            name: "sync_completed",
            success: true,
            result: data
          });
        }
      } catch (error) {
        console.error("Error syncing completed signals:", error);
        results.actions.push({
          name: "sync_completed",
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Create missing tables if requested
    if (action === "tables" || action === "all") {
      try {
        // Create completed_signals table if it doesn't exist
        const { data: createResult, error: createError } = await supabase
          .rpc("create_completed_signals_table");
          
        if (createError) {
          console.error("Error creating completed_signals table:", createError);
          results.actions.push({
            name: "create_tables",
            success: false,
            error: createError.message
          });
        } else {
          console.log("Tables created or verified success
