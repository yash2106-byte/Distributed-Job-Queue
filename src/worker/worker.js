import pool from "../../databaseConnet.js";
import Agent1 from "../jobs/agent.js";
import sendEmail from "../handlers/sendEmail.js";
import Reports from "../handlers/reports.js";
import Notification from "../handlers/notifications.js";
import ImageProcessing from "../handlers/image_processing.js";
import DataProcessing from "../handlers/data_processing.js";
import FailedJobs from "./FailedJobs.js";

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
                    status,
                    max_attempts
                FROM jobs
                WHERE status = 'queued' OR status = 'failed'
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

            // if available then start working on based on there job status

            const job = WaitingJobs.rows[0];
            const job_id = job.id;
            const job_state = job.status;
            let queue = ""
            if (job_state === "failed"){
                queue = await FailedJobs(job) 
                console.log(queue);
                
            }
            else{
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

            console.log(job.queue_name);
            
            // Execute the actual job
            queue = job.queue_name;
            }
     
            let result = ""
            switch (queue) {

                case 'emails':
                    result =await  sendEmail(job.payload);
                    break;

                case 'notifications':
                    result = await Notification(job.payload);
                    break;

                case 'reports':
                    result =await  Reports(job.payload);
                    break;

                case 'data_processing':
                    result = await  DataProcessing(job.payload);
                    break;

                case 'image_processing':
                    result = await ImageProcessing(job.payload);
                    break;

                default:
                    console.log(queue, "this queue is missing");
                    break;
            }
            console.log(result);

            // Job succeeded
            if (result.success) {

                await pool.query(
                    `
                    UPDATE jobs
                    SET status = 'succeeded'
                    WHERE id = $1;
                    `,
                    [job_id]
                );
            }

            // Job failed
            else {

                await pool.query(
                    `
                    UPDATE jobs
                    SET status = 'failed',
                        max_attempts = max_attempts + 1
                    WHERE id = $1
                    `,
                    [job_id]
                );
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