import pool from "../../databaseConnet.js";

const Worker = async function worker (val){
    const WaitingJobs = await pool.query(
        `SELECT 
            id,queue_name,payload,priority,status
            FROM jobs
            where status = 'queued'
            AND ID > 3
        `
    );
    console.log("This is the job details:", WaitingJobs.rows[0]);
    
    const job_id = WaitingJobs.rows[0].id;
    
    const UpdateJobs = await pool.query(
        `UPDATE jobs SET status = 'completed' where id =$1
        RETURNING *`,
        [job_id]
    ) ;
}

Worker('hello')