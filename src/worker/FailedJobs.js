import pool from "../../databaseConnet.js";
import ExecuteJob from "./ExecuteJobs.js";

const FailedJobs = async function failedJobs(job) {
    let test = true
    while(test){

        const BaseDelay = 1000;
        const MaxDelay = 3000;

        const delay = Math.min(
            BaseDelay * 2 ** job.attempt,
            MaxDelay
        );
        console.log(delay);
        
        const jitter = Math.random() * 500;

        // await new Promise(resolve =>
        //     setTimeout(resolve, delay + jitter)
        // );
        await new Promise(resolve =>
            setTimeout(resolve, 2000)
        );
        console.log("helloooo");
        
        console.log("Retrying job:", job.id);
        console.log("Failed attempts:", job.attempts);
        await pool.query(`
            UPDATE jobs
            SET status = 'running',
            attempts = attempts  + 1
            WHERE id = $1
        `, [job.id]);
        const result = ExecuteJob(job.queue_name,job.payload)
        
        if (result){
            test = false
            
        }
    }

    
};

export default FailedJobs;



// Use this for debugging
// let job =  {
//   id: '98',
//   queue_name: 'notifications',
//   payload: {
//     title: 'Payment Successful',
//     JobType: 'push_payment_success',
//     message: 'Your payment was successful',
//     user_id: 102,
//     transaction_id: 'TXN-1001'
//   },
//   priority: 10,
//   status: 'running',
//   attempts: 5
// }
// FailedJobs(job)

