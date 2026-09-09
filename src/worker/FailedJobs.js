import pool from "../../databaseConnet.js";
const FailedJobs = async function failedjobs (job) {
        while (true){
            let attempt = job.max_attempts

            // Making jobs wait depending on the attempts taken
            let BaseDelay = 1000;
            let MaxDelay = 3000;
            let delay = Math.min(BaseDelay * 2 ** attempt, MaxDelay);
            let jitter = Math.random() * 500; // 0–500 ms
            // await new Promise(resolve =>
            //     setTimeout(resolve, delay + jitter)
            // );
            await new Promise(resolve =>
                setTimeout(resolve, 2000)
            );
            console.log("working on this job", job.id);
            console.log("no of failed attempts are",attempt);
            
            


            let client;
            try{
                client = await pool.connect();
                const job_id = job.id

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
                client.release();
                client = null;
                const queue = job.queue_name;
                return queue
            
            }catch (error) {

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
}

export default FailedJobs;