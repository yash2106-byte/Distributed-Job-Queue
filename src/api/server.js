import web from "./web.js";
import "./routes/healthcheck.js";
import "../worker/worker.js";
import { Register, GetJobs } from "./routes/db_Operation_controller.js";

const port = 8000;
web.get("/db", (req, res) => {
    res.send("this is the response from the db");
});

web.route("/register").post(Register)
web.route("/getjobs").get(GetJobs)

web.listen(port, () => {
    console.log(`server is up at ${port}`);
});