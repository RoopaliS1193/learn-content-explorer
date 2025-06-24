
-- Create skill taxonomy table
CREATE TABLE IF NOT EXISTS skill_taxonomy (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT,
    category TEXT,
    subcategory TEXT,
    keywords TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster searching
CREATE INDEX IF NOT EXISTS idx_skill_taxonomy_name ON skill_taxonomy(name);
CREATE INDEX IF NOT EXISTS idx_skill_taxonomy_domain ON skill_taxonomy(domain);
CREATE INDEX IF NOT EXISTS idx_skill_taxonomy_keywords ON skill_taxonomy USING GIN(to_tsvector('english', keywords));

-- Enable Row Level Security
ALTER TABLE skill_taxonomy ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Allow public read access" ON skill_taxonomy
    FOR SELECT USING (true);

-- Create policy to allow authenticated insert/update
CREATE POLICY "Allow authenticated insert" ON skill_taxonomy
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update" ON skill_taxonomy
    FOR UPDATE USING (auth.role() = 'authenticated');
