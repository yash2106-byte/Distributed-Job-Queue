import pool from "../../databaseConnet.js";
const FailedJobs = async function failedjobs (job) {
        console.log("this message is from failed jobs ",job);
        let BaseDelay = 1000
        let MaxDelay = 3000
        console.log("this is the number of attempts",job.max_attempts);
        


        // while (true){
        //     let client;
        //     try{
        //         client = await pool.connect();
        //         const failed = job.rows[0]
        //         const job_id = job.id

        //     }
        // }
}

export default FailedJobs;