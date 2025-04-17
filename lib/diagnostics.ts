// A browser-compatible diagnostic tool for troubleshooting signal issues
// This can be imported into a component or copied into the browser console

export async function runSignalDiagnostics() {
  console.clear();
  console.log('%c BTC Market Today Diagnostic Tool ', 'background: #2563eb; color: white; font-size: 16px; padding: 4px 8px; border-radius: 4px;');
  console.log('Running diagnostics for signal history and seasonality issues...');
  
  // 1. Check Supabase configuration
  console.log('\n%c Checking Supabase Configuration ', 'background: #374151; color: white; padding: 2px 6px; border-radius: 2px;');
  
  const supabaseUrl = localStorage.getItem('supabase.auth.config.SUPABASE_URL') || 
                      process.env.NEXT_PUBLIC_SUPABASE_URL || 
                      "Not configured";
  
  const supabaseAnonKey = localStorage.getItem('supabase.auth.config.SUPABASE_KEY') || 
                          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  const hasSupabaseUrl = supabaseUrl !== "Not configured";
  const hasSupabaseKey = !!supabaseAnonKey;
  
  if (!hasSupabaseUrl || !hasSupabaseKey) {
    console.log('%c ❌ Supabase configuration issue detected', 'color: #ef4444');
    console.log('Please check that the following environment variables are set:');
    console.log('- NEXT_PUBLIC_SUPABASE_URL');
    console.log('- NEXT_PUBLIC_SUPABASE_ANON_KEY');
  } else {
    console.log('%c ✅ Supabase configuration found', 'color: #10b981');
    console.log(`URL: ${supabaseUrl.substring(0, 15)}...`);
  }
  
  // 2. Check Active Signals in localStorage
  console.log('\n%c Checking Active Signals in localStorage ', 'background: #374151; color: white; padding: 2px 6px; border-radius: 2px;');
  
  const activeSignalsJson = localStorage.getItem('activeSignals');
  
  if (!activeSignalsJson) {
    console.log('%c ℹ️ No active signals found in localStorage', 'color: #3b82f6');
  } else {
    try {
      const activeSignals = JSON.parse(activeSignalsJson);
      console.log(`%c ✅ Found ${activeSignals.length} active signal(s) in localStorage`, 'color: #10b981');
      
      if (activeSignals.length > 0) {
        console.log('Sample active signal:', activeSignals[0]);
      }
    } catch (error) {
      console.log('%c ❌ Error parsing active signals from localStorage', 'color: #ef4444');
      console.error(error);
    }
  }
  
  // 3. Check current month seasonality
  console.log('\n%c Checking Current Month Seasonality ', 'background: #374151; color: white; padding: 2px 6px; border-radius: 2px;');
  
  try {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    
    const currentMonth = new Date().getMonth();
    console.log(`Current month: ${monthNames[currentMonth]} (${currentMonth})`);
    
    // Import seasonality data if available
    try {
      // Try to dynamically import the seasonality data
      const { historicalMonthlyReturns } = await import('./seasonality-data');
      
      if (historicalMonthlyReturns) {
        console.log('%c ✅ Successfully loaded seasonality data', 'color: #10b981');
        
        const monthData = historicalMonthlyReturns[currentMonth as keyof typeof historicalMonthlyReturns];
        
        if (monthData) {
          const returns = Object.values(monthData);
          const positiveCount = returns.filter((ret) => ret > 0).length;
          const probability = (positiveCount / returns.length) * 100;
          
          console.log(`%c ✅ ${monthNames[currentMonth]} statistics:`, 'color: #10b981');
          console.log(`- Positive years: ${positiveCount}/${returns.length} (${probability.toFixed(1)}%)`);
          console.log(`- Seasonality: ${probability >= 60 ? 'Bullish' : probability <= 40 ? 'Bearish' : 'Neutral'}`);
        } else {
          console.log('%c ❌ No data found for current month in historicalMonthlyReturns', 'color: #ef4444');
        }
      } else {
        console.log('%c ❌ historicalMonthlyReturns not found in seasonality-data.ts', 'color: #ef4444');
      }
    } catch (error) {
      console.log('%c ❌ Error loading seasonality data', 'color: #ef4444');
      console.error(error);
    }
  } catch (error) {
    console.log('%c ❌ Error checking seasonality', 'color: #ef4444');
    console.error(error);
  }
  
  // 4. Check database tables via API
  console.log('\n%c Checking Database Tables ', 'background: #374151; color: white; padding: 2px 6px; border-radius: 2px;');
  
  try {
    console.log('Checking database tables via API...');
    const response = await fetch('/api/signals/fix?action=tables');
    
    if (response.ok) {
      const result = await response.json();
      console.log('%c ✅ Database table check completed', 'color: #10b981');
      console.log('Result:', result);
    } else {
      console.log('%c ❌ Failed to check database tables', 'color: #ef4444');
      console.log(`Status: ${response.status}`);
      try {
        const errorText = await response.text();
        console.log('Error:', errorText);
      } catch (e) {
        console.log('Could not get error text');
      }
    }
  } catch (error) {
    console.log('%c ❌ API error when checking database tables', 'color: #ef4444');
    console.error(error);
    console.log('Try running these checks manually:');
    console.log('1. Go to URL: /api/signals/fix?action=tables');
    console.log('2. Check the response for any errors');
  }
  
  // 5. Test completed signals retrieval
  console.log('\n%c Testing Completed Signals Retrieval ', 'background: #374151; color: white; padding: 2px 6px; border-radius: 2px;');
  
  try {
    const { getCompletedSignals } = await import('./signals-service');
    
    if (typeof getCompletedSignals === 'function') {
      console.log('Attempting to retrieve completed signals...');
      
      const signals = await getCompletedSignals(10, 0, {});
      
      console.log(`%c ${signals.length > 0 ? '✅' : 'ℹ️'} Retrieved ${signals.length} completed signals`, 
        signals.length > 0 ? 'color: #10b981' : 'color: #3b82f6');
      
      if (signals.length > 0) {
        console.log('Sample completed signal:', signals[0]);
      } else {
        console.log('No completed signals found. This may be normal if you haven\'t completed any signals yet.');
        console.log('Try running the sync function to move completed signals from generated_signals to completed_signals:');
        console.log('1. Go to URL: /api/signals/fix?action=sync');
        console.log('2. Check the response for any errors');
      }
    } else {
      console.log('%c ❌ getCompletedSignals function not found', 'color: #ef4444');
    }
  } catch (error) {
    console.log('%c ❌ Error testing completed signals retrieval', 'color: #ef4444');
    console.error(error);
  }
  
  // 6. Run fix for seasonality
  console.log('\n%c Running Fix for Seasonality ', 'background: #374151; color: white; padding: 2px 6px; border-radius: 2px;');
  
  try {
    console.log('Fixing signal seasonality via API...');
    const response = await fetch('/api/signals/fix?action=seasonality');
    
    if (response.ok) {
      const result = await response.json();
      console.log('%c ✅ Seasonality fix completed', 'color: #10b981');
      console.log('Result:', result);
    } else {
      console.log('%c ❌ Failed to fix seasonality', 'color: #ef4444');
      console.log(`Status: ${response.status}`);
      try {
        const errorText = await response.text();
        console.log('Error:', errorText);
      } catch (e) {
        console.log('Could not get error text');
      }
    }
  } catch (error) {
    console.log('%c ❌ API error when fixing seasonality', 'color: #ef4444');
    console.error(error);
    console.log('Try running the fix manually:');
    console.log('1. Go to URL: /api/signals/fix?action=seasonality');
    console.log('2. Check the response for any errors');
  }
  
  console.log('\n%c Diagnostics Complete ', 'background: #2563eb; color: white; font-size: 16px; padding: 4px 8px; border-radius: 4px;');
  console.log('If you need to take further action:');
  console.log('1. Fix all issues: /api/signals/fix?action=all');
  console.log('2. Sync completed signals: /api/signals/fix?action=sync');
  console.log('3. Fix tables: /api/signals/fix?action=tables');
  console.log('4. Fix seasonality: /api/signals/fix?action=seasonality');
}

// Allow running directly in browser console
if (typeof window !== 'undefined') {
  (window as any).runSignalDiagnostics = runSignalDiagnostics;
}
