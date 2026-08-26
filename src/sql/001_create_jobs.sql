CREATE TABLE jobs (
    id BIGSERIAL PRIMARY KEY,

    queue_name TEXT NOT NULL,

    payload JSONB NOT NULL,

    status TEXT NOT NULL DEFAULT 'queued',

    priority INT NOT NULL DEFAULT 0,

    run_after TIMESTAMPTZ NOT NULL DEFAULT now(),

    attempts INT NOT NULL DEFAULT 0,

    max_attempts INT NOT NULL DEFAULT 5,

    idempotency_key TEXT UNIQUE,

    locked_at TIMESTAMPTZ,

    locked_by TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- this will help us to send an response back to the client
CREATE INDEX idx_jobs_claimable
ON jobs (
    queue_name,
    status,
    priority DESC,
    run_after
);