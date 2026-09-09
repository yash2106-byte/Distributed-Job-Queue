import pool from "../../databaseConnet.js";

const FailedJobs = async function failedJobs(job) {

    const attempt = job.max_attempts;

    const BaseDelay = 1000;
    const MaxDelay = 3000;

    const delay = Math.min(
        BaseDelay * 2 ** attempt,
        MaxDelay
    );

    const jitter = Math.random() * 500;

    await new Promise(resolve =>
        setTimeout(resolve, delay + jitter)
    );

    console.log("Retrying job:", job.id);
    console.log("Failed attempts:", attempt);

    await pool.query(`
        UPDATE jobs
        SET status = 'running'
        WHERE id = $1
    `, [job.id]);

    return job.queue_name;
};

export default FailedJobs;