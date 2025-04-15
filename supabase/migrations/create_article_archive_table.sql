-- This function will be called via RPC to create the article_archive table if it doesn't exist
CREATE OR REPLACE FUNCTION create_article_archive_table()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the table exists
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'article_archive'
  ) THEN
    -- Create the table
    CREATE TABLE public.article_archive (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      excerpt TEXT,
      source_url VARCHAR(255),
      category VARCHAR(100),
      tags VARCHAR(255),
      published_at TIMESTAMP WITH TIME ZONE,
      archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      display_date DATE DEFAULT CURRENT_DATE,
      hash VARCHAR(32) UNIQUE,
      sentiment VARCHAR(20)
    );

    -- Create indexes for better performance
    CREATE INDEX idx_article_archive_display_date ON public.article_archive(display_date);
    CREATE INDEX idx_article_archive_published_at ON public.article_archive(published_at);
    CREATE INDEX idx_article_archive_sentiment ON public.article_archive(sentiment);

    -- Add comment to the table
    COMMENT ON TABLE public.article_archive IS 'Stores archived cryptocurrency news articles';
  END IF;
END;
$$;
