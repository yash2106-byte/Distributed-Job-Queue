import pool from "../../databaseConnet.js";
import FailedJobs from "./FailedJobs.js";
import ExecuteJob from "./ExecuteJobs.js";

const Worker = async function worker() {

    while (true) {

        let client;

        try {

            client = await pool.connect();

            await client.query("BEGIN");

            const result = await client.query(`
                SELECT
                    id,
                    queue_name,
                    payload,
                    priority,
                    status,
                    max_attempts
                FROM jobs
                WHERE status IN ('queued', 'failed')
                ORDER BY priority DESC, id ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            `);

            // No jobs
            if (result.rows.length === 0) {

                await client.query("COMMIT");
                client.release();
                client = null;

                console.log("No queued jobs found. Worker sleeping...");

                await new Promise(resolve =>
                    setTimeout(resolve, 2000)
                );

                continue;
            }

            const job = result.rows[0];

            await client.query("COMMIT");

            client.release();
            client = null;

            // Handle job based on status
            let queue;

            if (job.status === "failed") {

                queue = await FailedJobs(job);

            } else {

                queue = job.queue_name;

                await pool.query(`
                    UPDATE jobs
                    SET status = 'running'
                    WHERE id = $1
                `, [job.id]);
            }

            // Execute job
            const jobresult = await ExecuteJob(queue, job.payload);

            console.log(jobresult);

            // Update final status
            if (jobresult.success) {

                await pool.query(`
                    UPDATE jobs
                    SET status = 'succeeded'
                    WHERE id = $1
                `, [job.id]);

            } else {

                await pool.query(`
                    UPDATE jobs
                    SET status = 'failed',
                        max_attempts = max_attempts + 1
                    WHERE id = $1
                `, [job.id]);
            }

        } catch (error) {

            console.error("Worker error:", error);

            if (client) {

                try {
                    await client.query("ROLLBACK");
                } catch (rollbackError) {
                    console.error("Rollback failed:", rollbackError);
                }

                client.release();
                client = null;
            }

            await new Promise(resolve =>
                setTimeout(resolve, 2000)
            );
        }
    }
};

Worker();