import pool from "../../../databaseConnet.js";

const Register = async function register(req, res) {
    try {
        const { queue_name, payload, priority } = req.body;

        const result = await pool.query(
            `INSERT INTO jobs (queue_name, payload, priority)
             VALUES ($1, $2, $3)
             RETURNING id,status`,
            [queue_name, payload, priority]
        );

        res.json({
            message: "Job registered",
            job: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Database error");
    }
};

const GetJobs = async function getjobs(req,res) {
    try{
        const { uid } = req.body;
        const result = await pool.query(
            `SELECT 
                id, status, attempts
            FROM jobs
            WHERE id = $1`,
            [uid]
        );
        res.json({
            message: "Job Fetched",
            job: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Database error");
    }

    
}
export { Register,GetJobs };