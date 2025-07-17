import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./services/db.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import signalRoutes from "./routes/signalRoutes.js";
import userRoutes from "./routes/userRoutes.js";
dotenv.config();

const app = express();

const PORT = process.env.PORT;

app.use(cors());

app.use(express.json());

app.get("/", (req, res) => {
  res.send("API is running");
});

app.use("/api/organizations", organizationRoutes);
app.use("/api/users", userRoutes);

app.use("/api/workflows", signalRoutes);

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start the server");
    process.exit(1);
  }
};

startServer();
