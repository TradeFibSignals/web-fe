-- Function to create the seasonality_cache table
CREATE OR REPLACE FUNCTION create_seasonality_cache_table()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the table exists
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'seasonality_cache'
  ) THEN
    -- Create the table
    CREATE TABLE public.seasonality_cache (
      id SERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value JSONB NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Create index for better performance
    CREATE INDEX idx_seasonality_cache_key ON public.seasonality_cache(key);
    
    -- Add comment to the table
    COMMENT ON TABLE public.seasonality_cache IS 'Stores cached seasonality data';
  END IF;
END;
$$;
