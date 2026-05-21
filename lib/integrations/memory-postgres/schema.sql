-- @robbie/memory-postgres schema.
--
-- Applies once per database. Idempotent: re-running is safe.
--
-- The pgvector extension is OPTIONAL. If present, embeddings are stored as
-- the native `vector` type and the adapter exposes cosine-similarity search.
-- Without pgvector, embeddings are stored as a JSON array and semantic search
-- is disabled (lexical filters still work).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS robbie_memory_entries (
    id              text PRIMARY KEY,
    scope           text NOT NULL CHECK (scope IN ('candidate', 'organization', 'role', 'global')),
    subject_id      text NOT NULL,
    key             text NOT NULL,
    value           jsonb NOT NULL,
    summary         text NOT NULL,
    confidence      double precision NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    provenance      jsonb NOT NULL,
    created_at      timestamptz NOT NULL,
    embedding       vector(1536),
    embedding_json  jsonb,
    tags            text[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS robbie_memory_entries_subject_idx
    ON robbie_memory_entries (scope, subject_id);

CREATE INDEX IF NOT EXISTS robbie_memory_entries_key_idx
    ON robbie_memory_entries (key);

CREATE INDEX IF NOT EXISTS robbie_memory_entries_tags_idx
    ON robbie_memory_entries USING gin (tags);

CREATE INDEX IF NOT EXISTS robbie_memory_entries_confidence_idx
    ON robbie_memory_entries (confidence);

-- Optional: cosine-similarity index on embedding. Requires pgvector.
-- Comment out if pgvector is not installed.
CREATE INDEX IF NOT EXISTS robbie_memory_entries_embedding_idx
    ON robbie_memory_entries USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
