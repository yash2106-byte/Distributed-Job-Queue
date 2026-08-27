import web from "./web.js";
import "./routes/healthcheck.js";
import { Register } from "./routes/db.js";

const port = 8000;
web.get("/db", (req, res) => {
    res.send("this is the response from the db");
});

web.route("/register").post(Register)

web.listen(port, () => {
    console.log(`server is up at ${port}`);
});