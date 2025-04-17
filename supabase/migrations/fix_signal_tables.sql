-- Migration file to fix schema issues with generated_signals and signal_cache tables
-- Save this as supabase/migrations/fix_signal_tables.sql

-- First, ensure the signal_id in generated_signals is a unique constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'generated_signals_signal_id_key'
  ) THEN
    ALTER TABLE public.generated_signals 
    ADD CONSTRAINT generated_signals_signal_id_key UNIQUE (signal_id);
  END IF;
END $$;

-- Check if signal_cache table exists and has correct schema
DO $$ 
BEGIN
  -- Drop old signal_cache table if it exists but has wrong schema
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'signal_cache'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'signal_cache' AND column_name = 'pair'
  ) THEN
    DROP TABLE public.signal_cache;
  END IF;
  
  -- Create signal_cache table with proper schema if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'signal_cache'
  ) THEN
    CREATE TABLE public.signal_cache (
      id SERIAL PRIMARY KEY,
      cache_key VARCHAR(100) NOT NULL UNIQUE,
      signal_ids JSONB NOT NULL,
      pair VARCHAR(20),
      timeframe VARCHAR(10),
      last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_signal_cache_cache_key ON public.signal_cache(cache_key);
    CREATE INDEX IF NOT EXISTS idx_signal_cache_pair ON public.signal_cache(pair);
    CREATE INDEX IF NOT EXISTS idx_signal_cache_timeframe ON public.signal_cache(timeframe);
    
    COMMENT ON TABLE public.signal_cache IS 'Cache for recently generated trading signals';
  END IF;
END $$;

-- Ensure generated_signals has all required columns
DO $$ 
BEGIN
  -- Check if signal_source column exists and add if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'generated_signals' AND column_name = 'signal_source'
  ) THEN
    ALTER TABLE public.generated_signals ADD COLUMN signal_source VARCHAR(50);
  END IF;
  
  -- Check if seasonality column exists and add if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'generated_signals' AND column_name = 'seasonality'
  ) THEN
    ALTER TABLE public.generated_signals ADD COLUMN seasonality VARCHAR(20);
  END IF;
  
  -- Check if positive_probability column exists and add if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'generated_signals' AND column_name = 'positive_probability'
  ) THEN
    ALTER TABLE public.generated_signals ADD COLUMN positive_probability DECIMAL(10, 2);
  END IF;
END $$;
