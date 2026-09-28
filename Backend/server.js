const express = require("express");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

// Re-enable once controllers are pushed:
// app.use("/api/booking", require("./Routes/bookingRoutes"));

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
