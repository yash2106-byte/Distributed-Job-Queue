# Distributed Job Queue --- Learning & Implementation Roadmap

**Stack:** Node.js, Express, PostgreSQL (`pg`), worker processes /
`child_process`\
**Scope:** Backend-only. A frontend/dashboard may be added later.

------------------------------------------------------------------------

# 0. How to Use This Document

This is not just an implementation checklist. It is a **learning
roadmap**.

You are new to distributed systems, so the goal is:

1.  Understand the concept in simple terms.
2.  Learn the underlying technology.
3.  Implement a small piece.
4.  Test it.
5.  Break it deliberately.
6.  Understand why it broke.
7.  Fix it.
8.  Only then move to the next phase.

**Do not rush through the phases.** A smaller system that you can
explain deeply is much more valuable than a large system whose code you
cannot explain.

For every phase, ask yourself:

-   What problem am I solving?
-   Why does this problem exist?
-   What happens if two workers do it simultaneously?
-   What happens if a worker crashes?
-   What happens if PostgreSQL crashes?
-   What state should the job be in after every operation?
-   How would I prove that my implementation is correct?

------------------------------------------------------------------------

# 1. Project Overview

## 1.1 What are you building?

You are building a **distributed background job processing system**.

In simple words:

> One part of an application says "I need this task done," and another
> process performs that task in the background.

For example, suppose an application needs to generate a large PDF.

A normal API might do this:

``` text
User
  |
  v
Express API
  |
  v
Generate PDF
  |
  |---- 30 seconds ----|
  |
  v
Response
```

This is undesirable because the HTTP request is tied to a slow
operation.

Your system changes this to:

``` text
User
  |
  v
Express API
  |
  v
Create Job
  |
  v
PostgreSQL
  |
  v
Immediate HTTP response

             Later
               |
               v
            Worker
               |
               v
          Generate PDF
               |
               v
          Save result
```

The API creates the work.

The queue stores the work.

The worker performs the work.

The database remembers what happened.

------------------------------------------------------------------------

# 2. The Core Mental Model

Before learning distributed systems terminology, understand these four
components.

``` text
                 YOUR APPLICATION
                        |
                        | "Do this later"
                        v
                  +-----------+
                  |  PRODUCER |
                  +-----------+
                        |
                        | create job
                        v
                  +-----------+
                  |   QUEUE   |
                  +-----------+
                        |
                        | claim job
                        v
             +-----------------------+
             |       WORKERS         |
             |                       |
             | Worker 1  Worker 2    |
             | Worker 3  Worker 4    |
             +-----------------------+
                        |
                        | execute
                        v
                  +-----------+
                  | DATABASE  |
                  +-----------+
```

## Producer

The producer creates jobs.

Example:

``` text
"Generate report for user 123"
```

## Queue

The queue is a waiting area.

``` text
Job 1
Job 2
Job 3
Job 4
```

Workers take jobs from this queue.

## Worker

A worker is a separate process that executes jobs.

``` text
Worker
  |
  +-- get job
  +-- execute job
  +-- report success/failure
```

## Database

PostgreSQL stores the state of jobs.

For example:

``` text
id = 42
status = running
attempts = 2
locked_by = worker-3
```

------------------------------------------------------------------------

# 3. What Makes This Project Difficult?

A simple queue is easy.

The difficult part is **concurrency and failure**.

Imagine two workers:

``` text
Worker A                  Worker B
   |                         |
   | "Give me a job"         |
   |-----------------------> |
   |                         |
   |                         |
```

If both workers see the same job at exactly the same time, both might
process it.

That creates:

``` text
Job #123
   |
   +--> Worker A
   |
   +--> Worker B
```

Now the job was processed twice.

Your system must coordinate workers so that they can safely work at the
same time.

Then there is another problem.

``` text
Worker A
   |
   | claims Job #123
   |
   | processing...
   |
   X CRASH
```

Now what happens to Job #123?

If you leave it as `running` forever, the job is lost.

If you immediately give it to another worker, Worker A might actually
still be processing it.

This leads to the most important concepts in this project:

-   Concurrency
-   Transactions
-   Row-level locking
-   `SELECT ... FOR UPDATE`
-   `SKIP LOCKED`
-   At-least-once delivery
-   Idempotency
-   Retries
-   Exponential backoff
-   Leases
-   Heartbeats
-   Crash recovery
-   Backpressure
-   Fair scheduling
-   Observability

------------------------------------------------------------------------

# 4. What "Distributed" Means Here

Do not interpret "distributed" as "you need 10 computers."

You can demonstrate distributed behavior on your own laptop.

For example:

``` text
Terminal 1 -> API process
Terminal 2 -> Worker 1
Terminal 3 -> Worker 2
Terminal 4 -> Worker 3
Terminal 5 -> Reaper
Terminal 6 -> PostgreSQL
```

These are independent processes.

Later they could run on:

``` text
Machine A
  API

Machine B
  Worker 1
  Worker 2

Machine C
  Worker 3
  Worker 4

Machine D
  PostgreSQL
```

The principles remain the same.

------------------------------------------------------------------------

# 5. Technologies You Will Learn

## Node.js

You will learn:

-   Processes
-   Asynchronous programming
-   Event loop basics
-   Timers
-   Graceful shutdown
-   Environment variables
-   Error handling
-   Process signals
-   `child_process`
-   Possibly `worker_threads`

## Express

You will learn:

-   HTTP APIs
-   Routes
-   Request validation
-   Status codes
-   Error middleware
-   API structure

## PostgreSQL

This is one of the most important parts.

You will learn:

-   Transactions
-   Isolation
-   Row-level locks
-   `FOR UPDATE`
-   `SKIP LOCKED`
-   Atomic updates
-   Unique constraints
-   Indexes
-   JSONB
-   Query planning
-   Connection pools

## Operating system concepts

You will learn:

-   Processes
-   PIDs
-   Signals
-   `SIGTERM`
-   `SIGKILL`
-   Process crashes
-   Graceful shutdown

## Distributed systems concepts

You will learn:

-   At-least-once delivery
-   Idempotency
-   Failure recovery
-   Leases
-   Heartbeats
-   Backpressure
-   Scheduling
-   Concurrency
-   Race conditions

------------------------------------------------------------------------

# 6. Target Architecture

The final system should conceptually look like this:

``` text
                         Client
                           |
                           | HTTP
                           v
                    +-------------+
                    | Express API |
                    +-------------+
                           |
                           | INSERT
                           v
                    +-------------+
                    | PostgreSQL  |
                    |             |
                    | jobs        |
                    | queues      |
                    +-------------+
                      ^    ^    ^
                      |    |    |
              claim   |    |    |   claim
                      |    |    |
                 +----+    |    +----+
                 |         |         |
                 v         v         v
             Worker 1   Worker 2   Worker 3
                 |         |         |
                 +---------+---------+
                           |
                       execute job
                           |
                           v
                    External Service
                           |
                           v
                       Result

                    +-------------+
                    |   Reaper    |
                    +-------------+
                           |
                    recover stale jobs
```

Later:

``` text
                    +-------------+
                    |  Scheduler  |
                    +-------------+
                           |
                    creates jobs
                           |
                           v
                    +-------------+
                    | PostgreSQL  |
                    +-------------+
```

------------------------------------------------------------------------

# 7. Job Lifecycle

This lifecycle is the backbone of the project.

A job can move through states such as:

``` text
                 +---------+
                 | queued  |
                 +---------+
                      |
                      | worker claims
                      v
                 +---------+
                 | running |
                 +---------+
                  /       \
             success      failure
                |            |
                v            v
          +----------+   retry?
          | succeeded|      |
          +----------+      |
                            v
                         queued
                            |
                       max attempts?
                            |
                            v
                         +------+
                         | dead |
                         +------+
```

You should be able to explain every transition.

------------------------------------------------------------------------

# 8. Phase 0 --- Foundations Before Coding

## Goal

Understand the technologies and concepts you are about to use.

Do not start with the full project.

## Learn

### HTTP basics

Understand:

-   Request
-   Response
-   HTTP method
-   Status code
-   JSON
-   Headers

Know why:

``` text
POST /jobs
```

is different from:

``` text
GET /jobs/123
```

### Node.js basics

Understand:

-   What a Node process is
-   What asynchronous code means
-   What `async/await` does
-   What a Promise is
-   What `setTimeout` does
-   How one Node process differs from another

### PostgreSQL basics

You should already be comfortable with:

``` sql
CREATE TABLE
INSERT
SELECT
UPDATE
DELETE
WHERE
ORDER BY
LIMIT
INDEX
UNIQUE
```

Then learn:

``` sql
BEGIN;
COMMIT;
ROLLBACK;
```

and understand what a transaction is.

## Mini exercises

Before starting the real queue:

1.  Create a Node HTTP server.
2.  Connect Node to PostgreSQL.
3.  Insert a row.
4.  Read the row.
5.  Update the row.
6.  Run two Node processes simultaneously.
7.  Kill one process using `Ctrl+C`.
8.  Learn the difference between `SIGTERM` and `SIGKILL`.

## You are ready when

You can explain:

> "A Node worker is an operating-system process that runs independently
> from the Express API process."

------------------------------------------------------------------------

# 9. Phase 1 --- Project Setup and Job Data Model

## Goal

Create the database and API that can create and inspect jobs.

There are **no workers yet**.

## Recommended structure

``` text
distributed-job-queue/
|
├── src/
│   ├── api/
│   │   ├── server.js
│   │   └── routes/
│   │
│   ├── db/
│   │   ├── pool.js
│   │   └── migrations/
│   │
│   └── jobs/
│       └── ...
│
├── worker.js
├── package.json
├── .env
└── README.md
```

Do not over-engineer the folder structure initially.

## Install

Core dependencies:

``` bash
npm install express pg dotenv
npm install --save-dev nodemon
```

## Database schema

Start with:

``` sql
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
```

Add an index:

``` sql
CREATE INDEX idx_jobs_claimable
ON jobs (
    queue_name,
    status,
    priority DESC,
    run_after
);
```

## Understand every column

Do not blindly copy the schema.

You should know why each column exists.

### `id`

Unique identity of a job.

### `queue_name`

Allows multiple logical queues:

``` text
emails
reports
images
notifications
```

### `payload`

The data required to perform the job.

Example:

``` json
{
    "userId": 42,
    "reportType": "monthly"
}
```

### `status`

Current state:

``` text
queued
running
succeeded
dead
```

You may refine this later.

### `priority`

Higher number = more important.

### `run_after`

The earliest time the job can be executed.

This becomes important for retries.

### `attempts`

Number of processing attempts.

### `max_attempts`

Maximum number of attempts before the job becomes dead.

### `idempotency_key`

Prevents duplicate enqueueing.

### `locked_at`

When a worker claimed the job.

### `locked_by`

Which worker currently owns the lease.

### timestamps

Useful for debugging and observability.

------------------------------------------------------------------------

# 10. Phase 1 API

Implement:

## `POST /jobs`

Example request:

``` json
{
    "queue_name": "emails",
    "payload": {
        "to": "user@example.com",
        "subject": "Welcome"
    },
    "priority": 5
}
```

Response:

``` json
{
    "id": 123,
    "status": "queued"
}
```

## `GET /jobs/:id`

Example:

``` text
GET /jobs/123
```

Response:

``` json
{
    "id": 123,
    "status": "queued",
    "attempts": 0
}
```

## Phase 1 tests

Prove:

-   Jobs can be inserted.
-   Default values work.
-   Invalid requests are rejected.
-   Job IDs are unique.
-   Jobs can be retrieved.
-   PostgreSQL connection errors are handled.

## Important learning

Understand the complete path:

``` text
HTTP request
    ↓
Express route
    ↓
Validation
    ↓
SQL query
    ↓
PostgreSQL
    ↓
HTTP response
```

------------------------------------------------------------------------

# 11. Phase 2 --- Build Your First Worker

## Goal

Create a completely separate process that can retrieve and execute jobs.

Start simple.

The worker should:

``` text
while true:
    find a job
    execute it
    mark it succeeded
```

At first, your "job" can simply be:

``` javascript
await sleep(2000);
```

This simulates a slow task.

## First version

Do not immediately use multiple workers.

Start with:

``` text
API
 |
 v
PostgreSQL
 |
 v
Worker
```

Run:

``` bash
node worker.js
```

## Learn

Understand:

-   Why the worker is a separate process.
-   Why it should not be part of the HTTP request.
-   How a worker continuously polls.
-   What happens when there are no jobs.

## Worker loop

Conceptually:

``` text
while process is alive:

    job = claimJob()

    if no job:
        wait

    else:
        execute(job)
```

Do not create a busy loop:

``` text
while(true) {
    queryDatabase();
}
```

That can hammer PostgreSQL.

Use a delay when no work is available.

------------------------------------------------------------------------

# 12. Phase 3 --- Concurrency and Safe Job Claiming

## Goal

Run multiple workers simultaneously without them claiming the same job.

This is where the project becomes a real distributed-systems project.

Run:

``` text
Worker 1
Worker 2
Worker 3
Worker 4
```

against the same PostgreSQL database.

## The race condition

Suppose Job #10 is queued.

Without proper locking:

``` text
Worker 1 -> SELECT Job #10
Worker 2 -> SELECT Job #10
```

Both see it.

Both process it.

Bad.

------------------------------------------------------------------------

# 13. Learn PostgreSQL Transactions

Before using `SKIP LOCKED`, deeply understand transactions.

Example:

``` sql
BEGIN;

SELECT *
FROM jobs
WHERE id = 10
FOR UPDATE;

UPDATE jobs
SET status = 'running'
WHERE id = 10;

COMMIT;
```

Understand:

-   What is locked?
-   Who can see the row?
-   What happens if another transaction wants the same row?
-   What happens on rollback?

------------------------------------------------------------------------

# 14. Learn `FOR UPDATE`

`FOR UPDATE` locks selected rows.

Imagine:

``` text
Job #10
Job #11
Job #12
```

Worker 1 locks Job #10.

Another worker attempting to lock Job #10 must wait.

This prevents both workers from modifying the same row simultaneously.

------------------------------------------------------------------------

# 15. Learn `SKIP LOCKED`

This is one of the most important concepts in the project.

Suppose:

``` text
Job #1 -> locked by Worker 1
Job #2 -> available
Job #3 -> available
```

Worker 2 asks for work.

Without `SKIP LOCKED`, it may wait for Job #1.

With:

``` sql
FOR UPDATE SKIP LOCKED
```

it says:

> "If a row is already locked, skip it and find another one."

So:

``` text
Worker 1 -> Job #1
Worker 2 -> Job #2
Worker 3 -> Job #3
```

This allows multiple workers to operate concurrently.

------------------------------------------------------------------------

# 16. The Core Claim Query

A strong starting point is:

``` sql
UPDATE jobs
SET
    status = 'running',
    locked_at = now(),
    locked_by = $1,
    attempts = attempts + 1,
    updated_at = now()
WHERE id = (
    SELECT id
    FROM jobs
    WHERE
        status = 'queued'
        AND run_after <= now()
        AND queue_name = $2
    ORDER BY
        priority DESC,
        run_after ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

Do not memorize this.

Understand it.

Break it into:

``` text
Find an eligible job
        ↓
Sort jobs
        ↓
Take one
        ↓
Lock it
        ↓
Skip jobs locked by others
        ↓
Change it to running
        ↓
Return the job
```

## Test

Create 100 jobs.

Run 4 workers.

Each worker logs:

``` text
Worker worker-1 processed job 1
Worker worker-2 processed job 2
Worker worker-3 processed job 3
...
```

Verify:

-   All jobs finish.
-   No job is claimed by two workers.
-   No jobs disappear.
-   Multiple workers actually process work concurrently.

------------------------------------------------------------------------

# 17. Phase 4 --- Job Handlers

## Goal

Move from "dummy work" to a real job-handler architecture.

Instead of:

``` javascript
if (job.type === "something") {
    ...
}
```

create handlers.

Example:

``` text
handlers/
├── sendEmail.js
├── generateReport.js
├── resizeImage.js
└── testFailure.js
```

A job payload might contain:

``` json
{
    "type": "send_email",
    "data": {
        "to": "user@example.com"
    }
}
```

The worker resolves the correct handler.

Conceptually:

``` text
Job
 ↓
type = send_email
 ↓
sendEmail()
 ↓
success/failure
```

## Learn

-   Separation of concerns.
-   Dynamic dispatch.
-   Error propagation.
-   Why a worker should not know every implementation detail of every
    task.

------------------------------------------------------------------------

# 18. Phase 5 --- Failure Handling and Retries

## Goal

A failed job should not disappear.

Imagine:

``` text
Worker
  |
  v
External API
  |
  X failure
```

The job should be retried.

Basic state:

``` text
queued
  ↓
running
  ↓
failed
  ↓
queued
  ↓
running
```

You may not need a permanent `failed` state if you immediately requeue
it; the important thing is to record the failure and attempt count.

------------------------------------------------------------------------

# 19. Exponential Backoff

Never do:

``` text
FAIL
RETRY IMMEDIATELY
FAIL
RETRY IMMEDIATELY
FAIL
RETRY IMMEDIATELY
```

This can overload a failing dependency.

Instead:

``` text
Attempt 1 -> wait 1 second
Attempt 2 -> wait 2 seconds
Attempt 3 -> wait 4 seconds
Attempt 4 -> wait 8 seconds
Attempt 5 -> wait 16 seconds
```

A basic formula:

``` text
delay = min(baseDelay * 2^attempt, maxDelay)
```

For example:

``` text
baseDelay = 1000ms
maxDelay  = 30000ms
```

## Add jitter

If 1,000 jobs fail simultaneously and all retry exactly 8 seconds later,
they may all hit the dependency at once.

This is called a **thundering herd**.

Add randomness:

``` text
delay = exponentialDelay + randomJitter
```

## Test

Create a job handler that deliberately fails.

For example:

``` text
Attempt 1 -> failure
Attempt 2 -> failure
Attempt 3 -> failure
Attempt 4 -> success
```

Verify the timing.

------------------------------------------------------------------------

# 20. Dead-Letter Jobs

Retries cannot continue forever.

Suppose:

``` text
max_attempts = 5
```

Then:

``` text
Attempt 1 ❌
Attempt 2 ❌
Attempt 3 ❌
Attempt 4 ❌
Attempt 5 ❌
       |
       v
     DEAD
```

A dead job is a job that the system has given up retrying automatically.

You should retain:

-   Error message
-   Attempt count
-   Last failure time
-   Job payload
-   Queue name

This makes debugging possible.

------------------------------------------------------------------------

# 21. Phase 6 --- Idempotency

## Goal

Make duplicate execution safe.

This is one of the most important distributed-systems concepts.

Suppose the same request arrives twice:

``` text
Request A -> idempotency_key = abc123
Request B -> idempotency_key = abc123
```

You want:

``` text
Database

Job #100
idempotency_key = abc123
```

not:

``` text
Job #100 -> abc123
Job #101 -> abc123
```

Use the database's unique constraint.

Example:

``` sql
idempotency_key TEXT UNIQUE
```

Then use:

``` sql
INSERT INTO jobs (...)
VALUES (...)
ON CONFLICT (idempotency_key)
DO NOTHING
RETURNING *;
```

If nothing is returned, retrieve the existing job.

------------------------------------------------------------------------

# 22. Enqueue Idempotency vs Execution Idempotency

These are different.

## Enqueue idempotency

Prevents:

``` text
same request
   ↓
two jobs
```

## Execution idempotency

Protects against:

``` text
one job
   ↓
worker executes
   ↓
worker crashes
   ↓
another worker executes
```

The second case is much harder.

Your system should assume:

> A job may execute more than once.

Therefore job handlers should be designed to tolerate duplicates when
the operation matters.

For example, instead of blindly inserting:

``` sql
INSERT INTO emails_sent (...)
```

you might use a unique operation ID.

------------------------------------------------------------------------

# 23. At-Least-Once Delivery

This is a crucial concept.

Your system should aim for:

> The job will not be silently lost, even if that means it may be
> delivered more than once.

That is **at-least-once delivery**.

It does NOT mean:

> The job is guaranteed to execute exactly once.

Exactly-once execution is extremely difficult in distributed systems
because failures can happen between two operations.

For this project, the correct mindset is:

``` text
At-least-once delivery
        +
Idempotent processing
        =
Reliable system
```

------------------------------------------------------------------------

# 24. Phase 7 --- Crash Recovery with Leases

## Problem

Consider:

``` text
Worker 1
   |
   v
Claims Job #50
   |
   v
status = running
   |
   X Worker crashes
```

Now:

``` text
Job #50 = running forever
```

You need recovery.

------------------------------------------------------------------------

# 25. What is a Lease?

Instead of thinking:

> "Worker owns this job forever."

think:

> "Worker temporarily owns this job."

The ownership expires unless the worker keeps proving it is alive.

Example:

``` text
Job #50
locked_by = worker-1
locked_at = 10:00:00
```

If the worker has not updated its lease for 30 seconds:

``` text
10:00:00 -> claimed
10:00:10 -> heartbeat
10:00:20 -> heartbeat
10:00:30 -> heartbeat
```

But then:

``` text
Worker crashes
```

No more heartbeats.

After the timeout:

``` text
Reaper
  |
  v
Job lease expired
  |
  v
Make job queued again
```

------------------------------------------------------------------------

# 26. Heartbeats

A worker periodically updates:

``` sql
UPDATE jobs
SET locked_at = now()
WHERE id = $1
  AND locked_by = $2
  AND status = 'running';
```

This tells the system:

> "I am still alive and processing this job."

------------------------------------------------------------------------

# 27. The Reaper

The reaper is another process.

Its job:

> Find jobs whose workers appear to have disappeared.

Example:

``` sql
UPDATE jobs
SET
    status = 'queued',
    locked_by = NULL,
    locked_at = NULL,
    updated_at = now()
WHERE
    status = 'running'
    AND locked_at < now() - interval '30 seconds';
```

## Important caveat

A simple timeout has edge cases.

For example:

``` text
Worker is slow
        |
        v
Lease expires
        |
        v
Reaper requeues job
        |
        v
Worker is STILL running
```

Now two workers may process it.

This is exactly why you should learn **leases + idempotency together**.

## Test

1.  Start a worker.
2.  Enqueue a long-running job.
3.  Let worker claim it.
4.  Kill it using `kill -9`.
5.  Wait for the lease to expire.
6.  Confirm reaper makes the job claimable.
7.  Start another worker.
8.  Confirm the job is processed.

------------------------------------------------------------------------

# 28. Phase 8 --- Priority Scheduling

## Goal

Allow important jobs to run first.

Example:

``` text
Job A priority = 1
Job B priority = 10
Job C priority = 5
```

Expected order:

``` text
B
C
A
```

Use:

``` sql
ORDER BY priority DESC, run_after ASC
```

But priority introduces another problem.

------------------------------------------------------------------------

# 29. Starvation

Imagine high-priority jobs are continuously arriving.

``` text
High
High
High
High
High
High
...
Low
```

The low-priority job may never execute.

That is **starvation**.

You need a fairness mechanism.

Possible strategy:

``` text
Most claims:
    highest priority

Every N claims:
    oldest queued job
```

Another approach is priority aging:

``` text
effective_priority =
    base_priority + age_factor
```

You don't have to implement a complicated algorithm initially.

The important thing is to understand the tradeoff:

``` text
Priority
   vs
Fairness
```

------------------------------------------------------------------------

# 30. Phase 9 --- Backpressure and Concurrency Limits

## Problem

Suppose you have:

``` text
100 workers
```

and they all call:

``` text
Email Provider
```

at once.

The provider might rate-limit or reject your requests.

More workers do not always mean more throughput.

Sometimes:

``` text
more concurrency
       ↓
more overload
       ↓
more failures
       ↓
more retries
       ↓
even more load
```

This can become a feedback loop.

------------------------------------------------------------------------

# 31. Per-Queue Concurrency

For example:

``` text
emails:
    max concurrency = 2

image-processing:
    max concurrency = 10

reports:
    max concurrency = 4
```

Even if you have 20 worker processes, the email queue should never have
more than 2 active jobs.

## Test

Set:

``` text
emails max concurrency = 2
workers = 10
jobs = 100
```

Log the number of running jobs.

Prove:

``` text
maximum running email jobs <= 2
```

------------------------------------------------------------------------

# 32. Phase 10 --- Scheduled Jobs

## Goal

Allow jobs to run in the future.

Examples:

``` text
Send email at 9 AM
Generate report every Monday
Clean old data every night
```

You already have:

``` text
run_after
```

which can support delayed one-time execution.

For recurring jobs, create a schedule representation.

Example:

``` text
scheduled_jobs

id
queue_name
payload_template
cron_expression
next_run_at
```

A scheduler process periodically checks:

``` text
Is next_run_at <= now()?
```

If yes:

``` text
create normal job
calculate next occurrence
update schedule
```

Important design principle:

> The scheduler creates normal jobs. Workers should not need to
> understand cron expressions.

------------------------------------------------------------------------

# 33. Phase 11 --- Observability

## Goal

Make the system understandable while it is running.

Without observability:

``` text
"Why is this job stuck?"
```

becomes difficult to answer.

You want logs such as:

``` json
{
    "jobId": 123,
    "queue": "emails",
    "event": "job_succeeded",
    "worker": "worker-4",
    "attempt": 2,
    "durationMs": 1432
}
```

Useful events:

``` text
job_created
job_claimed
job_started
job_failed
job_retried
job_succeeded
job_dead
job_reaped
```

------------------------------------------------------------------------

# 34. `/stats`

Create an endpoint such as:

``` text
GET /stats
```

Return information such as:

``` json
{
    "emails": {
        "queued": 42,
        "running": 2,
        "dead": 3,
        "throughputPerMinute": 120,
        "oldestPendingAgeSeconds": 18
    }
}
```

This will later make a dashboard easy to build.

------------------------------------------------------------------------

# 35. Phase 12 --- Load Testing

## Goal

Stop testing only with:

``` text
1 job
1 worker
```

Test the actual system.

Start with:

``` text
100 jobs
4 workers
```

Then:

``` text
1,000 jobs
4 workers
```

Then:

``` text
10,000 jobs
8 workers
```

Inject failures:

``` text
5% failure rate
10% failure rate
20% failure rate
```

Test priorities.

Test retries.

Kill workers.

Restart PostgreSQL.

Observe what happens.

------------------------------------------------------------------------

# 36. What Should You Measure?

At minimum:

## Throughput

How many jobs per second/minute can the system process?

``` text
jobs completed / second
```

## Latency

How long does a job wait before processing?

``` text
created_at
      ↓
started_at
```

## Processing duration

How long does execution take?

``` text
started_at
      ↓
completed_at
```

## Failure rate

``` text
failed jobs / total jobs
```

## Retry rate

``` text
retried jobs / total jobs
```

## Queue depth

How many jobs are waiting?

``` text
queued jobs
```

------------------------------------------------------------------------

# 37. Phase 13 --- Failure Injection

This phase is extremely valuable for learning.

Do not only test the happy path.

Deliberately break things.

## Test 1 --- Worker crash

``` text
worker claims job
        ↓
kill -9
        ↓
reaper
        ↓
job recovered
```

## Test 2 --- Database unavailable

Stop PostgreSQL.

Observe:

``` text
workers
API
scheduler
```

What happens?

Can they recover after PostgreSQL returns?

## Test 3 --- External dependency failure

Make a handler fail randomly.

Observe retries.

## Test 4 --- Duplicate enqueue

Send the same idempotency key repeatedly.

Verify one logical job.

## Test 5 --- Worker overload

Run many workers against a small queue.

Observe contention.

## Test 6 --- Long-running job

Make a job take several minutes.

Verify heartbeats prevent legitimate jobs from being reaped.

------------------------------------------------------------------------

# 38. Phase 14 --- Graceful Shutdown

A real service should not simply disappear.

When the process receives:

``` text
SIGTERM
```

a worker should ideally:

``` text
stop accepting new jobs
        ↓
finish current job
        ↓
stop heartbeat
        ↓
close database connections
        ↓
exit
```

This is different from:

``` text
SIGKILL
```

which cannot be handled normally.

Understanding this difference is important when deploying services.

------------------------------------------------------------------------

# 39. Phase 15 --- Architecture Cleanup

Only after the system works should you clean up the architecture.

Potential structure:

``` text
src/
|
├── api/
│   ├── server.js
│   ├── routes/
│   └── controllers/
|
├── db/
│   ├── pool.js
│   ├── queries/
│   └── migrations/
|
├── queue/
│   ├── producer.js
│   ├── consumer.js
│   ├── claim.js
│   ├── retry.js
│   └── scheduler.js
|
├── workers/
│   ├── worker.js
│   ├── handlers/
│   └── heartbeat.js
|
├── recovery/
│   └── reaper.js
|
├── monitoring/
│   └── stats.js
|
└── utils/
```

Do not create all these directories on day one.

Let the architecture emerge from the problems you solve.

------------------------------------------------------------------------

# 40. Important Concepts You Must Be Able to Explain

By the end, you should be able to explain these without looking at
notes.

## Process

What is an OS process?

Why is a worker a separate process?

## Concurrency

What happens when two workers operate simultaneously?

## Race condition

What happens when two workers try to claim the same job?

## Transaction

Why do we need transactions around job claiming?

## Row-level locking

What does `FOR UPDATE` do?

## `SKIP LOCKED`

Why is it useful for job queues?

## At-least-once delivery

Why can a job execute more than once?

## Idempotency

How can repeated execution be made safe?

## Retry

Why should failures be retried?

## Exponential backoff

Why should retry delays increase?

## Jitter

Why should retry delays contain randomness?

## Dead-letter queue

Why stop retrying permanently failing jobs?

## Lease

Why should worker ownership expire?

## Heartbeat

How does a worker prove that it is still alive?

## Reaper

How are abandoned jobs recovered?

## Backpressure

Why can more workers actually make the system worse?

## Priority

How do you make important work run first?

## Starvation

How do you prevent low-priority jobs from waiting forever?

------------------------------------------------------------------------

# 41. Recommended Learning Order

Do not learn everything simultaneously.

Follow this dependency chain:

``` text
Node.js
   |
   v
Express
   |
   v
PostgreSQL
   |
   v
Transactions
   |
   v
Processes
   |
   v
Concurrency
   |
   v
Row-level locking
   |
   v
SKIP LOCKED
   |
   v
Workers
   |
   v
Retries
   |
   v
Idempotency
   |
   v
At-least-once delivery
   |
   v
Leases + heartbeats
   |
   v
Crash recovery
   |
   v
Priority + fairness
   |
   v
Backpressure
   |
   v
Scheduling
   |
   v
Observability
   |
   v
Load testing
```

------------------------------------------------------------------------

# 42. Phase Completion Checklist

## Phase 0

-   [ ] Understand HTTP basics
-   [ ] Understand Node processes
-   [ ] Understand async/await
-   [ ] Understand PostgreSQL basics
-   [ ] Understand transactions

## Phase 1

-   [ ] Express server works
-   [ ] PostgreSQL connection works
-   [ ] Jobs table exists
-   [ ] `POST /jobs` works
-   [ ] `GET /jobs/:id` works
-   [ ] Basic tests pass

## Phase 2

-   [ ] Worker process exists
-   [ ] Worker polls for jobs
-   [ ] Worker executes a job
-   [ ] Worker marks success
-   [ ] Worker sleeps when queue is empty

## Phase 3

-   [ ] Multiple workers run
-   [ ] Transactions are understood
-   [ ] `FOR UPDATE` is understood
-   [ ] `SKIP LOCKED` is understood
-   [ ] No duplicate claims occur
-   [ ] 100+ jobs are processed correctly

## Phase 4

-   [ ] Job handlers exist
-   [ ] Handler errors propagate correctly
-   [ ] Different job types can be processed

## Phase 5

-   [ ] Failed jobs retry
-   [ ] Attempts are tracked
-   [ ] Exponential backoff works
-   [ ] Jitter works
-   [ ] Dead jobs are recorded

## Phase 6

-   [ ] Idempotency key exists
-   [ ] Duplicate enqueue requests are safe
-   [ ] Execution is designed for at-least-once delivery
-   [ ] Duplicate execution scenarios are understood

## Phase 7

-   [ ] Worker heartbeats work
-   [ ] Lease expiration works
-   [ ] Reaper exists
-   [ ] Crashed workers can be simulated
-   [ ] Abandoned jobs are recovered

## Phase 8

-   [ ] Priority scheduling works
-   [ ] High-priority jobs run earlier
-   [ ] Starvation is tested
-   [ ] Fairness strategy exists

## Phase 9

-   [ ] Per-queue concurrency exists
-   [ ] Limits are enforced
-   [ ] Backpressure behavior is tested

## Phase 10

-   [ ] Delayed jobs work
-   [ ] Recurring schedules work
-   [ ] Scheduler is separate from workers

## Phase 11

-   [ ] Structured logging exists
-   [ ] `/stats` works
-   [ ] Queue depth is measurable
-   [ ] Throughput is measurable
-   [ ] Job latency is measurable

## Phase 12

-   [ ] 1,000+ job test works
-   [ ] 10,000+ job test works
-   [ ] Multiple workers are used
-   [ ] Failures are injected
-   [ ] Worker crashes are tested
-   [ ] Results are measured

------------------------------------------------------------------------

# 43. Suggested Milestones

Instead of thinking:

> "I have 15 phases. This will take forever."

Think in milestones.

## Milestone 1 --- It works

``` text
API
 ↓
PostgreSQL
 ↓
Worker
 ↓
Job completed
```

## Milestone 2 --- It works concurrently

``` text
API
 ↓
PostgreSQL
 ↓
Worker 1
Worker 2
Worker 3
Worker 4
```

No duplicate claims.

## Milestone 3 --- It survives failures

``` text
Worker crashes
      ↓
Reaper
      ↓
Job recovered
```

## Milestone 4 --- It handles unreliable work

``` text
Failure
  ↓
Retry
  ↓
Backoff
  ↓
Retry
  ↓
Dead
```

## Milestone 5 --- It behaves like infrastructure

``` text
Priority
Concurrency limits
Scheduling
Observability
Load testing
```

------------------------------------------------------------------------

# 44. How You Should Study Each Feature

For every feature, use this loop:

``` text
1. Learn the problem
       ↓
2. Build the simplest solution
       ↓
3. Create a failure scenario
       ↓
4. Observe the failure
       ↓
5. Learn the underlying concept
       ↓
6. Implement the robust solution
       ↓
7. Test it under concurrency
       ↓
8. Document what you learned
```

Example: `SKIP LOCKED`

Do not simply copy the query.

Instead:

``` text
First:
Build a broken queue.

Then:
Run two workers.

Observe:
Both can claim the same job.

Then:
Learn row-level locking.

Then:
Learn FOR UPDATE.

Then:
Learn SKIP LOCKED.

Then:
Implement it.

Then:
Run 10 workers against 1,000 jobs.

Then:
Verify correctness.
```

That process will teach you much more than simply completing the
feature.

------------------------------------------------------------------------

# 45. Questions to Ask Yourself While Building

Whenever something doesn't work, ask:

### Database

> What transaction is currently running?

> Which row is locked?

> Who owns the lock?

> What happens if this transaction rolls back?

### Worker

> What happens if the worker crashes here?

> What happens if it crashes one line later?

> What happens if the job takes 10 minutes?

### Queue

> Can two workers claim the same job?

> Can a job disappear?

> Can a job execute twice?

### Retry

> What if the dependency is down for 10 minutes?

> What if 10,000 jobs fail simultaneously?

### Recovery

> How does the system know that a worker died?

> What if the worker is slow rather than dead?

### Performance

> What happens when there are 1 million queued jobs?

> Is PostgreSQL scanning the entire jobs table?

> Is the index being used?

These questions are where the real learning happens.

------------------------------------------------------------------------

# 46. What You Should NOT Build Initially

Avoid adding these too early:

-   Redis
-   Kafka
-   Kubernetes
-   Docker orchestration
-   Microservices
-   Authentication
-   Frontend
-   GraphQL
-   Complex dashboards
-   Multiple databases

Your first version should be:

``` text
Node.js
Express
PostgreSQL
Multiple worker processes
```

That is enough to teach you a huge amount.

Once you understand the system, you can compare your implementation with
Redis-backed queues, Kafka consumers, Celery, BullMQ, SQS, etc.

------------------------------------------------------------------------

# 47. Later Stretch Goals

After the core system is correct, consider:

## Result storage

Allow jobs to return results.

``` text
Job
 ↓
Worker
 ↓
Result
 ↓
Database/object storage
```

## Job cancellation

Allow:

``` text
POST /jobs/:id/cancel
```

## Queue pause/resume

``` text
pause emails
resume emails
```

## Rate limiting

For example:

``` text
maximum 100 external API calls/minute
```

## Worker registration

Track:

``` text
worker ID
started at
last heartbeat
queues
current job
```

## Metrics

Prometheus-style metrics.

## Distributed scheduler

Multiple scheduler instances with safe coordination.

## Web dashboard

Build this only after the backend is reliable.

------------------------------------------------------------------------

# 48. Final Architecture

The mature version should look approximately like:

``` text
                           CLIENT
                             |
                             v
                      +--------------+
                      | Express API  |
                      +--------------+
                             |
                             | enqueue
                             v
                    +-------------------+
                    |    PostgreSQL     |
                    |                   |
                    |      jobs         |
                    |    schedules      |
                    |    queue config   |
                    +-------------------+
                      ^      ^      ^
                      |      |      |
                    claim   claim   claim
                      |      |      |
                 +----+--+ +--+----+ +----+----+
                 |Worker | |Worker | | Worker  |
                 |   1   | |   2   | |    3    |
                 +-------+ +-------+ +---------+
                      |       |          |
                      +-------+----------+
                              |
                           handlers
                              |
                  +-----------+-----------+
                  |           |           |
                Email       Reports     APIs

                    +----------------+
                    |    Reaper      |
                    +----------------+
                           |
                    crash recovery

                    +----------------+
                    |   Scheduler    |
                    +----------------+
                           |
                    recurring jobs

                    +----------------+
                    |  Observability |
                    +----------------+
                           |
                    logs / stats / metrics
```

------------------------------------------------------------------------

# 49. Definition of Done

You can consider the project complete when you can demonstrate all of
the following:

### Basic operation

``` text
POST /jobs
    ↓
job appears in PostgreSQL
    ↓
worker claims it
    ↓
handler executes
    ↓
job becomes succeeded
```

### Concurrency

``` text
1000 jobs
+
8 workers
=
no duplicate claims
+
no lost jobs
```

### Failure

``` text
worker crashes
    ↓
lease expires
    ↓
reaper detects it
    ↓
job becomes available
    ↓
another worker completes it
```

### Retry

``` text
failure
 ↓
backoff
 ↓
retry
 ↓
failure
 ↓
backoff
 ↓
success/dead
```

### Idempotency

``` text
same request 100 times
        ↓
one logical job
```

### Priority

``` text
high priority
    ↓
processed before
low priority
```

while still preventing starvation.

### Backpressure

``` text
queue concurrency = 2
        ↓
never more than 2 running
```

### Scheduling

``` text
scheduled task
      ↓
scheduler
      ↓
normal job
      ↓
worker
```

### Observability

You can answer:

``` text
How many jobs are queued?
How many are running?
How many are dead?
How fast are jobs completing?
How long are jobs waiting?
Which worker processed a job?
Why did a job fail?
How many times was it retried?
```

### Load test

You can run:

``` text
10,000+ jobs
multiple workers
random failures
worker crashes
different priorities
```

and explain the results.

------------------------------------------------------------------------

# 50. Interview-Level Understanding

By the end of the project, you should be able to answer questions such
as:

### "Why PostgreSQL instead of Redis?"

Explain the tradeoffs around durability, transactions, operational
simplicity, latency, and workload.

### "Why `SKIP LOCKED`?"

Explain how it enables multiple workers to claim different rows
concurrently without waiting on already-locked rows.

### "Can your queue guarantee exactly-once execution?"

The correct mindset is:

> No general distributed system should casually promise exactly-once
> execution. This design uses at-least-once delivery and makes handlers
> idempotent.

### "What happens when a worker crashes?"

Explain leases, heartbeats, expiration, and the reaper.

### "What happens if the worker completes the task but crashes before acknowledging it?"

Explain why duplicate execution is possible and why idempotency matters.

### "Why exponential backoff?"

Explain transient failures and why immediate retries can amplify
outages.

### "What is backpressure?"

Explain limiting concurrency so workers do not overwhelm downstream
systems.

### "How would you scale this?"

Discuss:

-   More worker processes
-   More machines
-   Multiple queues
-   Database indexing
-   Queue partitioning/sharding as a later evolution
-   Connection pooling
-   Rate limits
-   Bottleneck identification

Do not claim that adding workers automatically solves every scaling
problem.

------------------------------------------------------------------------

# 51. Final Learning Goal

The goal of this project is **not**:

> "I built a queue."

The real goal is:

> "I understand how multiple independent processes coordinate through a
> database, how distributed work can fail, how to recover from those
> failures, and how to design a system that remains reliable under
> concurrency."

If you reach that point, the project has succeeded.

You should be able to look at technologies such as:

``` text
Celery
BullMQ
Sidekiq
AWS SQS
Kafka consumers
RabbitMQ
```

and understand the problems they are solving instead of seeing them as
mysterious infrastructure.

------------------------------------------------------------------------

# 52. The One Diagram to Remember

If you forget everything else, remember this:

``` text
             "Do this task"
                   |
                   v
              PRODUCER
                   |
                   v
                QUEUE
                   |
          +--------+--------+
          |        |        |
          v        v        v
       WORKER   WORKER   WORKER
          |        |        |
          +--------+--------+
                   |
                EXECUTE
                   |
          +--------+--------+
          |                 |
       SUCCESS           FAILURE
          |                 |
          v                 v
       DONE            RETRY/BACKOFF
                            |
                       max attempts
                            |
                            v
                          DEAD


        If worker crashes:
                 |
                 v
              LEASE
                 |
                 v
              REAPER
                 |
                 v
            JOB RECOVERED
```

That is the entire project at a high level.

Everything else you build is there to make this diagram **correct,
concurrent, reliable, observable, and scalable**.
