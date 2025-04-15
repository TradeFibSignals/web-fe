-- Create table for completed trading signals
CREATE TABLE IF NOT EXISTS public.completed_signals (
  id SERIAL PRIMARY KEY,
  signal_id UUID DEFAULT uuid_generate_v4(),
  signal_type VARCHAR(10) NOT NULL, -- 'long' or 'short'
  entry_price DECIMAL(18, 8) NOT NULL,
  stop_loss DECIMAL(18, 8) NOT NULL,
  take_profit DECIMAL(18, 8) NOT NULL,
  exit_price DECIMAL(18, 8) NOT NULL,
  exit_type VARCHAR(10) NOT NULL, -- 'tp', 'sl', or 'manual'
  entry_time TIMESTAMP WITH TIME ZONE NOT NULL,
  exit_time TIMESTAMP WITH TIME ZONE NOT NULL,
  pair VARCHAR(20) NOT NULL,
  timeframe VARCHAR(10) NOT NULL,
  profit_loss DECIMAL(18, 8) NOT NULL, -- In quote currency (e.g., USDT)
  profit_loss_percent DECIMAL(10, 2) NOT NULL, -- As percentage
  risk_reward_ratio DECIMAL(10, 2) NOT NULL,
  signal_source VARCHAR(50) NOT NULL, -- 'fibonacci', 'liquidation', etc.
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_completed_signals_entry_time ON public.completed_signals(entry_time);
CREATE INDEX IF NOT EXISTS idx_completed_signals_signal_type ON public.completed_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_completed_signals_pair ON public.completed_signals(pair);

-- Create function to ensure uuid-ossp extension exists
CREATE OR REPLACE FUNCTION ensure_uuid_extension()
RETURNS VOID AS $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not create uuid-ossp extension, it might already exist';
END;
$$ LANGUAGE plpgsql;

-- Call the function to ensure the extension exists
SELECT ensure_uuid_extension();
