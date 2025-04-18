-- supabase/migrations/create_ohlc_candles_table.sql

-- Create OHLC candles table for storing price data
CREATE TABLE IF NOT EXISTS public.ohlc_candles (
  id SERIAL PRIMARY KEY,
  pair VARCHAR(20) NOT NULL,
  timeframe VARCHAR(10) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  open DECIMAL(18, 8) NOT NULL,
  high DECIMAL(18, 8) NOT NULL,
  low DECIMAL(18, 8) NOT NULL,
  close DECIMAL(18, 8) NOT NULL,
  volume DECIMAL(28, 8) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index to prevent duplicate candles
CREATE UNIQUE INDEX IF NOT EXISTS idx_ohlc_unique ON public.ohlc_candles(pair, timeframe, timestamp);

-- Create indexes for optimized queries
CREATE INDEX IF NOT EXISTS idx_ohlc_pair_tf ON public.ohlc_candles(pair, timeframe);
CREATE INDEX IF NOT EXISTS idx_ohlc_timestamp ON public.ohlc_candles(timestamp);
CREATE INDEX IF NOT EXISTS idx_ohlc_pair_tf_timestamp ON public.ohlc_candles(pair, timeframe, timestamp);

-- Add database comments
COMMENT ON TABLE public.ohlc_candles IS 'Stores OHLC candle data for different trading pairs and timeframes';
COMMENT ON COLUMN public.ohlc_candles.pair IS 'Trading pair symbol (e.g., BTCUSDT)';
COMMENT ON COLUMN public.ohlc_candles.timeframe IS 'Timeframe of the candle (e.g., 5m, 15m, 1h)';
COMMENT ON COLUMN public.ohlc_candles.timestamp IS 'Start time of the candle period';
COMMENT ON COLUMN public.ohlc_candles.open IS 'Opening price of the candle period';
COMMENT ON COLUMN public.ohlc_candles.high IS 'Highest price during the candle period';
COMMENT ON COLUMN public.ohlc_candles.low IS 'Lowest price during the candle period';
COMMENT ON COLUMN public.ohlc_candles.close IS 'Closing price of the candle period';
COMMENT ON COLUMN public.ohlc_candles.volume IS 'Trading volume during the candle period';

-- Create function to clean up old candles (optional)
-- This function deletes candles older than a specified number of days
CREATE OR REPLACE FUNCTION clean_old_candles(days_to_keep INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.ohlc_candles
  WHERE timestamp < NOW() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Create function to get candles count statistics
CREATE OR REPLACE FUNCTION get_candle_stats()
RETURNS TABLE(
  pair VARCHAR,
  timeframe VARCHAR,
  oldest_candle TIMESTAMP WITH TIME ZONE,
  newest_candle TIMESTAMP WITH TIME ZONE,
  candle_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.pair,
    c.timeframe,
    MIN(c.timestamp) AS oldest_candle,
    MAX(c.timestamp) AS newest_candle,
    COUNT(*) AS candle_count
  FROM
    public.ohlc_candles c
  GROUP BY
    c.pair, c.timeframe
  ORDER BY
    c.pair, c.timeframe;
END;
$$;
