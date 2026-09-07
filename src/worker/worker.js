import pool from "../../databaseConnet.js";
import Agent1 from "../jobs/agent.js";

const Worker = async function worker() {

    while (true) {

        let client;

        try {
            // Get a dedicated database connection so that your process can use the same connection through out
            client = await pool.connect();

            // Start transaction
            await client.query("BEGIN");

            // Find and lock one queued job
            const WaitingJobs = await client.query(`
                SELECT
                    id,
                    queue_name,
                    payload,
                    priority,
                    status
                FROM jobs
                WHERE status = 'queued'
                ORDER BY priority DESC, id ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            `);

            // No job available
            if (WaitingJobs.rows.length === 0) {

                await client.query("COMMIT");
                client.release();
                client = null;

                console.log("No queued jobs found. Worker sleeping...");

                await new Promise(resolve =>
                    setTimeout(resolve, 2000)
                );

                continue;
            }

            // Job found
            const job = WaitingJobs.rows[0];
            const job_id = job.id;

            console.log("Job found:", job_id);

            // Mark job as running
            await client.query(
                `
                UPDATE jobs
                SET status = 'running'
                WHERE id = $1
                `,
                [job_id]
            );

            // Commit the transaction
            await client.query("COMMIT");

            // Release the database connection
            client.release();
            client = null;

            console.log(`Job ${job_id} is now running.`);

            // Execute the actual job
            const result = await Agent1(job.payload);

            // Job succeeded
            if (result.success) {

                await pool.query(
                    `
                    UPDATE jobs
                    SET status = 'succeeded'
                    WHERE id = $1
                    `,
                    [job_id]
                );

                console.log(`Job ${job_id} succeeded.`);

            }

            // Job failed
            else {

                await pool.query(
                    `
                    UPDATE jobs
                    SET status = 'failed'
                    WHERE id = $1
                    `,
                    [job_id]
                );

                console.log(`Job ${job_id} failed.`);
            }

        } catch (error) {

            console.error("Worker error:", error);

            // If transaction is still active, rollback
            if (client) {

                try {
                    await client.query("ROLLBACK");
                } catch (rollbackError) {
                    console.error("Rollback failed:", rollbackError);
                }

                client.release();
                client = null;
            }

            // Wait before trying again
            await new Promise(resolve =>
                setTimeout(resolve, 2000)
            );
        }
    }
};

Worker();