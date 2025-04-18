import { initializeHistoricalData } from '@/lib/candle-store';
import { CandleBuilder, PAIRS, TIMEFRAMES } from '@/lib/websocket-candle-builder';

/**
 * Initialize OHLC data store and start real-time updates
 * 
 * This script:
 * 1. Fetches historical data for all configured pairs and timeframes
 * 2. Stores it in the database
 * 3. Starts WebSocket connections to continue updating the data in real-time
 */
async function initialize() {
  console.log('=== OHLC Data Initialization ===');
  console.log(`Pairs: ${PAIRS.join(', ')}`);
  console.log(`Timeframes: ${TIMEFRAMES.join(', ')}`);
  console.log('================================');
  
  try {
    // Initialize historical data for all pairs
    for (const pair of PAIRS) {
      console.log(`\nInitializing historical data for ${pair}...`);
      try {
        await initializeHistoricalData(pair, TIMEFRAMES);
        console.log(`✓ Successfully initialized historical data for ${pair}`);
      } catch (error) {
        console.error(`✗ Error initializing historical data for ${pair}:`, error);
        // Continue with other pairs even if one fails
      }
    }
    
    console.log('\n=== Historical data initialization complete ===');
    console.log('Starting WebSocket candle builder for real-time updates...');
    
    // Start the WebSocket candle builder
    const candleBuilder = new CandleBuilder(PAIRS, TIMEFRAMES);
    candleBuilder.start();
    
    console.log('\n=== WebSocket candle builder started ===');
    console.log('OHLC data will now be continuously updated in real-time');
    console.log('Press Ctrl+C to stop');
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\nShutting down...');
      candleBuilder.stop();
      console.log('WebSocket candle builder stopped');
      console.log('Exiting');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\nTermination signal received. Shutting down...');
      candleBuilder.stop();
      console.log('WebSocket candle builder stopped');
      console.log('Exiting');
      process.exit(0);
    });
  } catch (error) {
    console.error('Critical error during initialization:', error);
    process.exit(1);
  }
}

// Run the initialization
initialize().catch(error => {
  console.error('Failed to start initialization:', error);
  process.exit(1);
});
