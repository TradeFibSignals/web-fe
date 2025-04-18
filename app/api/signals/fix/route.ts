import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { supabase } from "@/lib/supabase-client";
import { calculateMonthlyPositiveProb, historicalMonthlyReturns } from "@/lib/seasonality-data";

// Fixed API endpoint for manually updating signals
export async function GET(request: NextRequest) {
  try {
    const action = request.nextUrl.searchParams.get("action") || "all";
    
    if (!supabase) {
      return NextResponse.json({ error: "Supabase client not available" }, { status: 500 });
    }

    const results = {
      timestamp: new Date().toISOString(),
      actions: []
    };
    
    // Action to update seasonality data
    if (action === "seasonality" || action === "all") {
      try {
        // Get current month (0-indexed)
        const currentMonth = new Date().getMonth();
        
        // Get probability from seasonality_temp first
        let probability, seasonality;
        
        const { data: tempData, error: tempError } = await supabase
          .from("seasonality_temp")
          .select("probability")
          .eq("month", currentMonth)
          .single();
          
        if (!tempError && tempData) {
          // Use value from database
          probability = parseFloat(tempData.probability);
          console.log(`Using seasonality from database: ${probability}%`);
        } else {
          // Calculate from seasonality-data.ts
          console.log(`Seasonality not found in database, calculating from historical data...`);
          const monthData = historicalMonthlyReturns[currentMonth as keyof typeof historicalMonthlyReturns];
          
          if (monthData) {
            const returns = Object.values(monthData);
            const positiveCount = returns.filter((ret) => ret > 0).length;
            probability = (positiveCount / returns.length) * 100;
            console.log(`Calculated seasonality from historical data: ${probability}%`);
            
            // Insert or update the seasonality_temp table
            const { error } = await supabase
              .from("seasonality_temp")
              .upsert({
                month: currentMonth,
                probability,
                created_at: new Date().toISOString()
              });
              
            if (error) {
              console.error(`Error updating seasonality_temp:`, error);
            } else {
              console.log(`Updated seasonality_temp for month ${currentMonth}`);
            }
          } else {
            // Default if no data is available
            probability = 50;
            console.log(`No historical data found, using default probability: ${probability}%`);
          }
        }
        
        // Determine seasonality type based on probability
        if (probability >= 60) {
          seasonality = "bullish";
        } else if (probability <= 40) {
          seasonality = "bearish";
        } else {
          seasonality = "neutral";
        }
        
        // Update all active signals with the seasonality values
        const { data, error } = await supabase
          .from("generated_signals")
          .update({
            seasonality,
            positive_probability: probability,
            updated_at: new Date().toISOString()
          })
          .eq("status", "active");
          
        results.actions.push({
          name: "seasonality",
          success: !error,
          message: error ? error.message : `Updated seasonality to ${seasonality} (${probability}%)`,
          probability,
          seasonality,
          month: currentMonth
        });
      } catch (error) {
        console.error("Error updating seasonality:", error);
        results.actions.push({
          name: "seasonality",
          success: false,
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
    
    // Sync completed signals action
    if (action === "sync" || action === "all") {
      try {
        const { data, error } = await supabase
          .rpc("sync_completed_signals");
          
        results.actions.push({
          name: "sync_completed",
          success: !error,
          message: error ? error.message : "Synced completed signals"
        });
      } catch (error) {
        results.actions.push({
          name: "sync_completed",
          success: false,
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
    
    // Create tables action
    if (action === "tables" || action === "all") {
      try {
        const { error } = await supabase
          .rpc("create_completed_signals_table");
          
        results.actions.push({
          name: "create_tables",
          success: !error,
          message: error ? error.message : "Tables created successfully"
        });
      } catch (error) {
        results.actions.push({
          name: "create_tables",
          success: false,
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
    
    // Add a new action to update the seasonality_temp table with all months
    if (action === "update_all_months" || action === "all") {
      try {
        const monthlyProbs = calculateMonthlyPositiveProb();
        let successes = 0;
        let failures = 0;
        
        // Loop through all months and update
        for (let month = 0; month < 12; month++) {
          if (monthlyProbs[month] !== undefined) {
            const { error } = await supabase
              .from("seasonality_temp")
              .upsert({
                month,
                probability: monthlyProbs[month],
                created_at: new Date().toISOString()
              });
              
            if (error) {
              console.error(`Error updating month ${month}:`, error);
              failures++;
            } else {
              successes++;
            }
          }
        }
        
        results.actions.push({
          name: "update_all_months",
          success: failures === 0,
          message: `Updated ${successes} months, ${failures} failures`,
          data: monthlyProbs
        });
      } catch (error) {
        results.actions.push({
          name: "update_all_months",
          success: false,
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
    
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ 
      error: "Internal server error", 
      message: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
