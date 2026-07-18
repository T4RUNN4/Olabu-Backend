import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";

dotenv.config();

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

const PORT: number = Number(process.env.PORT!);
const URI: string = process.env.MONGO_URI!;

const client = new MongoClient(URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("olabu");
    const wallboardsCollection = db.collection("wallboards");
    const reviewsCollection = db.collection("review");

    app.get("/", (req: Request, res: Response) => {
      res.send("App is running");
    });

    app.get("/wallboards", async (req: Request, res: Response) => {
      const wallboards = await wallboardsCollection.find().toArray();
      res.json(wallboards);
    });

    app.get("/wallboards/:id", async (req: Request<{ id: string }>, res: Response) => {
      const { id } = req.params;

      const wallboards = await wallboardsCollection.findOne({
        _id: new ObjectId(id),
      });
      res.json(wallboards);
    });

    app.post("/wallboards/add", async (req: Request, res: Response) => {
      const wallboardDetails = req.body;
      const ret = await wallboardsCollection.insertOne(wallboardDetails);

      res.json(ret);
    });

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } finally {
  }
}

run().catch(console.dir);
