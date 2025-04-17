-- Create function for completed_signals table creation
CREATE OR REPLACE FUNCTION create_completed_signals_table()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the table exists
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'completed_signals'
  ) THEN
    -- Create the table
    CREATE TABLE public.completed_signals (
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

    RAISE NOTICE 'Created completed_signals table successfully';
  ELSE
    RAISE NOTICE 'completed_signals table already exists';
  END IF;
END;
$$;

-- Function to sync completed signals from generated_signals to completed_signals
CREATE OR REPLACE FUNCTION sync_completed_signals()
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  sync_count INTEGER := 0;
  error_count INTEGER := 0;
  success BOOLEAN := true;
  error_message TEXT := null;
  signal RECORD;
BEGIN
  -- Ensure the table exists
  BEGIN
    PERFORM create_completed_signals_table();
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error creating completed_signals table: ' || SQLERRM
    );
  END;
  
  -- Add synced_to_completed column to generated_signals if it doesn't exist
  BEGIN
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'generated_signals' 
      AND column_name = 'synced_to_completed'
    ) THEN
      ALTER TABLE public.generated_signals ADD COLUMN synced_to_completed BOOLEAN DEFAULT false;
      RAISE NOTICE 'Added synced_to_completed column to generated_signals table';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error adding synced_to_completed column: ' || SQLERRM
    );
  END;
  
  -- Loop through each completed signal that hasn't been synced
  BEGIN
    FOR signal IN 
      SELECT * FROM generated_signals 
      WHERE status IN ('completed', 'expired') 
      AND (synced_to_completed IS NULL OR synced_to_completed = false)
    LOOP
      BEGIN
        -- Insert into completed_signals
        INSERT INTO completed_signals (
          signal_id,
          signal_type,
          entry_price,
          stop_loss,
          take_profit,
          exit_price,
          exit_type,
          entry_time,
          exit_time,
          pair,
          timeframe,
          profit_loss,
          profit_loss_percent,
          risk_reward_ratio,
          signal_source,
          notes
        ) VALUES (
          signal.signal_id,
          signal.signal_type,
          signal.entry_price,
          signal.stop_loss,
          signal.take_profit,
          COALESCE(signal.exit_price, signal.entry_price), -- Use entry price if exit price is null
          COALESCE(signal.exit_type, 'manual'),
          COALESCE(signal.created_at, NOW()),
          COALESCE(signal.exit_time, signal.updated_at, NOW()),
          signal.pair,
          signal.timeframe,
          COALESCE(signal.profit_loss, 0),
          COALESCE(signal.profit_loss_percent, 0),
          COALESCE(signal.risk_reward_ratio, 0),
          COALESCE(signal.signal_source, 'unknown'),
          NULL
        );
        
        -- Mark as synced
        UPDATE generated_signals 
        SET synced_to_completed = true 
        WHERE signal_id = signal.signal_id;
        
        sync_count := sync_count + 1;
      EXCEPTION WHEN OTHERS THEN
        -- Log error but continue with other signals
        RAISE NOTICE 'Error syncing signal %: %', signal.signal_id, SQLERRM;
        error_count := error_count + 1;
      END;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    success := false;
    error_message := SQLERRM;
  END;
  
  -- Return results
  RETURN json_build_object(
    'success', success,
    'synced_count', sync_count,
    'error_count', error_count,
    'message', CASE 
      WHEN success THEN 'Successfully synced ' || sync_count || ' signals with ' || error_count || ' errors'
      ELSE 'Error during sync: ' || error_message
    END
  );
END;
$$;

-- Function to calculate and update seasonality for all active signals
CREATE OR REPLACE FUNCTION update_seasonality_for_active_signals()
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  current_month INTEGER;
  month_probability NUMERIC;
  seasonality_type TEXT;
  update_count INTEGER;
  month_names TEXT[] := ARRAY['January', 'February', 'March', 'April', 'May', 'June', 
                              'July', 'August', 'September', 'October', 'November', 'December'];
BEGIN
  -- Get current month (0-11)
  current_month := EXTRACT(MONTH FROM CURRENT_DATE) - 1;
  
  -- Calculate seasonality from a permanent table if it exists
  -- If not, try to get it from API call result
  BEGIN
    SELECT 
      probability,
      CASE
        WHEN probability >= 60 THEN 'bullish'
        WHEN probability <= 40 THEN 'bearish'
        ELSE 'neutral'
      END
    INTO
      month_probability,
      seasonality_type
    FROM seasonality_cache
    WHERE month = current_month;
    
    -- If no data found in cache table, use seasonality_temp table
    IF month_probability IS NULL THEN
      SELECT 
        probability,
        CASE
          WHEN probability >= 60 THEN 'bullish'
          WHEN probability <= 40 THEN 'bearish'
          ELSE 'neutral'
        END
      INTO
        month_probability,
        seasonality_type
      FROM seasonality_temp
      WHERE month = current_month;
    END IF;
    
    -- If still no data, set default values for current month based on reasonable defaults
    -- This is just a fallback - the real data should come from application logic
    IF month_probability IS NULL THEN
      -- Default values based on general Bitcoin seasonality patterns
      month_probability := 
        CASE current_month
          WHEN 0 THEN 60 -- January
          WHEN 1 THEN 60 -- February
          WHEN 2 THEN 60 -- March
          WHEN 3 THEN 64 -- April
          WHEN 4 THEN 42 -- May
          WHEN 5 THEN 35 -- June
          WHEN 6 THEN 40 -- July
          WHEN 7 THEN 40 -- August
          WHEN 8 THEN 35 -- September
          WHEN 9 THEN 65 -- October
          WHEN 10 THEN 60 -- November
          WHEN 11 THEN 55 -- December
          ELSE 50
        END;
        
      seasonality_type := 
        CASE
          WHEN month_probability >= 60 THEN 'bullish'
          WHEN month_probability <= 40 THEN 'bearish'
          ELSE 'neutral'
        END;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- In case of error, use sane defaults
    month_probability := 50;
    seasonality_type := 'neutral';
  END;
  
  -- Update all active signals
  UPDATE generated_signals
  SET 
    seasonality = seasonality_type,
    positive_probability = month_probability,
    updated_at = NOW()
  WHERE status = 'active';
  
  GET DIAGNOSTICS update_count = ROW_COUNT;
  
  -- Return success information
  RETURN json_build_object(
    'success', true,
    'month', month_names[current_month+1],
    'month_index', current_month,
    'probability', month_probability,
    'seasonality', seasonality_type,
    'updated_signals', update_count
  );
END;
$$;

-- Create a temporary table to store seasonality data if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'seasonality_temp'
  ) THEN
    CREATE TABLE public.seasonality_temp (
      month INTEGER PRIMARY KEY,
      probability NUMERIC NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Insert current known values
    INSERT INTO seasonality_temp (month, probability) VALUES
      (0, 60), -- January
      (1, 60), -- February
      (2, 60), -- March
      (3, 64), -- April
      (4, 42), -- May
      (5, 35), -- June
      (6, 40), -- July
      (7, 40), -- August
      (8, 35), -- September
      (9, 65), -- October
      (10, 60), -- November
      (11, 55); -- December
  END IF;
END
$$;
