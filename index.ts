import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import express, { Request, Response } from "express";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import { getGroqClient } from "./services/groq";

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

    app.get(
      "/wallboards",
      async (
        req: Request<{}, {}, {}, { q?: string; by?: string }>,
        res: Response,
      ) => {
        const { q = "", by = "name" } = req.query;
        let filter = {};

        if (q) {
          if (by === "tags") {
            filter = {
              tags: {
                $regex: q,
                $options: "i",
              },
            };
          } else {
            filter = {
              [by]: {
                $regex: q,
                $options: "i",
              },
            };
          }
        }

        const wallboards = await wallboardsCollection.find(filter).toArray();
        res.json(wallboards);
      },
    );

    app.get("/wallboards/featured", async (req: Request, res: Response) => {
      const wallboards = await wallboardsCollection
        .aggregate([
          {
            $sample: {
              size: 2,
            },
          },
        ])
        .toArray();
      res.json(wallboards);
    });

    app.get(
      "/wallboards/:id",
      async (req: Request<{ id: string }>, res: Response) => {
        const { id } = req.params;

        const wallboards = await wallboardsCollection.findOne({
          _id: new ObjectId(id),
        });
        res.json(wallboards);
      },
    );

    app.post("/wallboards/add", async (req: Request, res: Response) => {
      const wallboardDetails = req.body;
      const ret = await wallboardsCollection.insertOne(wallboardDetails);

      res.json(ret);
    });

    app.delete(
      "/wallboards/delete/:id",
      async (req: Request<{ id: string }>, res: Response) => {
        const { id } = req.params;
        const ret = await wallboardsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.json(ret);
      },
    );

    app.get("/reviews", async (req: Request, res: Response) => {
      const reviews = await reviewsCollection.find().toArray();
      res.json(reviews);
    });

    app.get("/reviews/featured", async (req: Request, res: Response) => {
      const reviews = await reviewsCollection
        .aggregate([
          {
            $sample: {
              size: 1,
            },
          },
        ])
        .toArray();
      res.json(reviews);
    });

    app.post("/reviews/add", async (req: Request, res: Response) => {
      const review = req.body;
      const ret = await reviewsCollection.insertOne(review);

      res.json(ret);
    });

    app.post("/chat", async (req, res) => {
      const groq = getGroqClient();
      const { message } = req.body;

      const systemPrompt = `
You are OLABU's AI shopping assistant. OLABU is a customized PVC wallboards brand from Bangladesh. They offer any sizes customers want starting from 6 inch * 8 inch. Also each board has a very high quality image print. Also, with each order, they provide free double-sided tape to stick the wallboards on the surface.

The two unqiue features or Unique Selling Points of OLABU are:

1. They offer premium glossy lamination which is offered by no one in Bangladesh right Now. This makes their boards waterproof and UV-resistant; also best in the quality.
2. They offer a 10 year guarentee card which will replace any wallboard that is faded color in a 10 year-span with a normal condition used.

Currently available products are:

[
  {
    "name": "Everything in Time",
    "code": "lm10-wc-01",
    "description": "The wallboards features the iconic moment of Lionel Messi receiving Fifa World Cup 2022.",
    "tags": [
          "Football",
          "Messi",
          "Sports",
          "Fifa World Cup",
          "Argentina"
    ]
  },
  {
    "name": "Prime CR7",
    "code": "cr7-01",
    "description": "The wallboards features a celebration of Prime Ronaldo during his Manchester United period",
    "tags": [
          "Ronaldo",
          "Portugal",
          "Manchester United"
    ]
  },
  {
    "name": "UCL Messi",
    "code": "lm10-ucl-02",
    "description": "The wallboards features some iconic moment of Prime Messi in Barcelona including UCL celebration",
    "tags": [
          "Football",
          "Messi",
          "UCL",
          "Barcelona",
          "Sports"
    ]
  },
  {
    "name": "Braizilian Prince",
    "code": "njr10-02",
    "description": "The wallboards features Neymar Junior doing dribbling in brazilian jersey",
    "tags": [
          "Brazil",
          "Neymar",
          "Football",
          "Sports"
    ]
  },
  {
    "name": "Neymar Jr. - The Prince",
    "code": "njr10-01",
    "description": "The wallboards features all the versions of Neymar Jr.",
    "tags": [
          "Neymar",
          "Football",
          "Sports",
          "PSG"
    ]
  }
]

Rules:
- Only answer questions related to OLABU and its products.
- Never invent products that don't exist.
- If the user asks for more suggestions, list every matching product from the available products. Include the product name, code, a one-sentence description, and why it matches the user's request. Do not invent additional products.
- If asked something unrelated, politely explain that you specialize in OLABU products.
`;

      const stream = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: message,
          },
        ],
        stream: true,
      });

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Transfer-Encoding", "chunked");

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || "";

        if (token) {
          res.write(token);
        }
      }

      res.end();
    });

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } finally {
  }
}

run().catch(console.dir);
