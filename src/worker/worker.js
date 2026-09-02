import pool from "../../databaseConnet.js";
import Agent1 from "../jobs/agent.js";
const Worker = async function worker() {
    const WaitingJobs = await pool.query(
        `SELECT 
            id,
            queue_name,
            payload,
            priority,
            status
        FROM jobs
        WHERE status = 'pending'
        ORDER BY PRIORITY DESC,id ASC
        LIMIT 1`
    );

    console.log("Number of jobs:", WaitingJobs.rows.length);
    console.log("This is the job details:", WaitingJobs.rows[0]);

    if (WaitingJobs.rows.length === 0) {
        console.log("No queued jobs found.");
        return;
    }

    const job_id = WaitingJobs.rows[0].id;
    const job = WaitingJobs.rows[0].payload;
    const result = await Agent1(job)
    if (result.success)
    {
    await pool.query(
        `UPDATE jobs 
         SET status = 'completed' 
         WHERE id = $1
         RETURNING *`,
        [job_id]
    );
    }else{
        await pool.query(
            `UPDATE jobs
            SET status = 'failed
            `
        )
    }
    
    
};

Worker();