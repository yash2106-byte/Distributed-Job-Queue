import web from "../web.js";

web.get("/health", (req, res) => {
    res.send("you are at the health route");
});