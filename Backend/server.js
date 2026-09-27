const express = require("express");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/booking", require("./routes/bookingRoutes"));

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
