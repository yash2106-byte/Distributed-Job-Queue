import web from "./web.js";
import "./routes/healthcheck.js";

const port = 8000;

web.get("/db", (req, res) => {
    res.send("this is the response from the db");
});

web.listen(port, () => {
    console.log(`server is up at ${port}`);
});