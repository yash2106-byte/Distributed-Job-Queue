import pool from "../../databaseConnet.js";
import Agent1 from "../jobs/agent.js";

const Worker = async function worker() {

    while (true) {

        const WaitingJobs = await pool.query(
            `SELECT 
                id,
                queue_name,
                payload,
                priority,
                status
             FROM jobs
             WHERE status = 'queued'
             ORDER BY priority DESC, id ASC
             LIMIT 1`
        );

        console.log("Number of jobs:", WaitingJobs.rows.length);

        // No job available
        if (WaitingJobs.rows.length === 0) {
            console.log("No queued jobs found. Worker sleeping...");

            await new Promise(resolve => setTimeout(resolve, 2000));

            continue;
        }

        // Job found
        const job_id = WaitingJobs.rows[0].id;
        const job = WaitingJobs.rows[0].payload;

        console.log("This is the job details:", WaitingJobs.rows[0]);

        try {

            const result = await Agent1(job);

            if (result.success) {

                await pool.query(
                    `UPDATE jobs 
                     SET status = 'succeeded'
                     WHERE id = $1`,
                    [job_id]
                );

                console.log(`Job ${job_id} succeeded.`);

            } else {

                await pool.query(
                    `UPDATE jobs
                     SET status = 'failed'
                     WHERE id = $1`,
                    [job_id]
                );

                console.log(`Job ${job_id} failed.`);

            }

        } catch (error) {

            console.log(`Job ${job_id} failed with error:`, error);

            await pool.query(
                `UPDATE jobs
                 SET status = 'failed'
                 WHERE id = $1`,
                [job_id]
            );
        }
    }
};

Worker();