-- Create table for automatically generated signals
CREATE TABLE IF NOT EXISTS public.generated_signals (
  id SERIAL PRIMARY KEY,
  signal_id UUID DEFAULT uuid_generate_v4(),
  signal_type VARCHAR(10) NOT NULL, -- 'long' or 'short'
  entry_price DECIMAL(18, 8) NOT NULL,
  stop_loss DECIMAL(18, 8) NOT NULL,
  take_profit DECIMAL(18, 8) NOT NULL,
  pair VARCHAR(20) NOT NULL,
  timeframe VARCHAR(10) NOT NULL,
  signal_source VARCHAR(50) NOT NULL, -- 'fibonacci', 'liquidation', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'cancelled', 'expired'
  major_level DECIMAL(18, 8),
  peak_price DECIMAL(18, 8),
  peak_time TIMESTAMP WITH TIME ZONE,
  fib_levels JSONB,
  risk_reward_ratio DECIMAL(10, 2),
  seasonality VARCHAR(20), -- 'bullish', 'bearish', 'neutral'
  positive_probability DECIMAL(10, 2),
  entry_hit BOOLEAN DEFAULT FALSE,
  entry_hit_time TIMESTAMP WITH TIME ZONE,
  exit_price DECIMAL(18, 8),
  exit_time TIMESTAMP WITH TIME ZONE,
  exit_type VARCHAR(10), -- 'tp', 'sl', 'manual', 'expired'
  profit_loss DECIMAL(18, 8),
  profit_loss_percent DECIMAL(10, 2)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_generated_signals_pair ON public.generated_signals(pair);
CREATE INDEX IF NOT EXISTS idx_generated_signals_timeframe ON public.generated_signals(timeframe);
CREATE INDEX IF NOT EXISTS idx_generated_signals_status ON public.generated_signals(status);
CREATE INDEX IF NOT EXISTS idx_generated_signals_created_at ON public.generated_signals(created_at);
CREATE INDEX IF NOT EXISTS idx_generated_signals_signal_type ON public.generated_signals(signal_type);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_generated_signals_updated_at
BEFORE UPDATE ON public.generated_signals
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create table for signal cache management
CREATE TABLE IF NOT EXISTS public.signal_cache (
  id SERIAL PRIMARY KEY,
  cache_key VARCHAR(100) NOT NULL UNIQUE,
  signal_ids JSONB NOT NULL, -- Array of signal IDs in cache
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster cache lookups
CREATE INDEX IF NOT EXISTS idx_signal_cache_cache_key ON public.signal_cache(cache_key);
