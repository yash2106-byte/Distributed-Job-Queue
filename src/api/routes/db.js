import web from "../web.js";
import pg from "pg";
import pool from "../../../databaseConnet.js";

const Register = async function register(req, res) {
    try {
        const { name, password } = req.body;

        const result = await pool.query(
            "INSERT INTO jobs (name, password) VALUES ($1, $2) RETURNING *",
            [name, password]
        );

        res.json({
            message: "User registered",
            user: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Database error");
    }
};

export { Register };
