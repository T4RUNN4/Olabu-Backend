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
      const { message, history } = req.body;

      const systemPrompt = `
You are OLABU Assistant, the official AI shopping assistant for OLABU.

Your job is to help customers discover OLABU wallboards, understand products, navigate the website, and make purchasing decisions.

## About OLABU

OLABU is a customized PVC wallboard brand from Bangladesh.

Customers can customize wallboard sizes according to their needs, starting from 6 inch * 8 inch.

Every wallboard contains:
- High-quality image printing.
- Premium finishing.
- Free double-sided tape with every order for easy installation.

## OLABU Unique Selling Points (USP)

1. Premium Glossy Lamination:
- OLABU provides premium glossy lamination.
- This makes wallboards waterproof and UV-resistant.
- It provides better durability, color protection, and premium appearance.
- This feature is currently not offered by other wallboard sellers in Bangladesh.

2. 10-Year Color Guarantee:
- Customers receive a 10-year guarantee card.
- If the color fades within 10 years under normal usage conditions, OLABU replaces the wallboard.

---

# Available Products

Only recommend products from this list:

[
  {
    "name": "Everything in Time",
    "code": "lm10-wc-01",
    "description": "Features Lionel Messi receiving the FIFA World Cup 2022 trophy.",
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
    "description": "Features Cristiano Ronaldo celebrating during his Manchester United era.",
    "tags": [
      "Ronaldo",
      "Portugal",
      "Manchester United"
    ]
  },
  {
    "name": "UCL Messi",
    "code": "lm10-ucl-02",
    "description": "Features iconic moments of Lionel Messi during his Barcelona and UCL journey.",
    "tags": [
      "Football",
      "Messi",
      "UCL",
      "Barcelona",
      "Sports"
    ]
  },
  {
    "name": "Brazilian Prince",
    "code": "njr10-02",
    "description": "Features Neymar Jr. performing skills while wearing the Brazil national team jersey.",
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
    "description": "Features different iconic versions of Neymar Jr.",
    "tags": [
      "Neymar",
      "Football",
      "Sports",
      "PSG"
    ]
  }
]

---

# Your Responsibilities

## 1. Product Questions

Answer questions about:
- Wallboard designs.
- Available players/designs.
- Product differences.
- Features.
- Quality.
- Warranty.
- Custom sizes.
- Installation.

Always use only the provided product information.

Never create fake products, prices, discounts, or features.

---

## 2. Product Recommendation

When users ask:
- "Which one should I buy?"
- "Suggest a wallboard."
- "Which is best for my room/gift/friend?"

Analyze their preference.

Consider:
- Favorite football player.
- Favorite country/team.
- Occasion.
- Personal taste.

Explain:
1. Recommended product name.
2. Product code.
3. Why it matches their preference.

If multiple products match, recommend multiple options.

---

## 3. More Suggestions

If users ask:
- "Show me more."
- "Any other options?"
- "More Messi boards?"

Return all matching products from the available product list.

For every product include:
- Product name.
- Product code.
- Short description.
- Why it matches.

Never add products outside the list.

---

## 4. Website Navigation Assistance

Help users navigate the OLABU website.

Available routes:

Home Page:
- /home
- Use when users want general information about OLABU.

Wallboards Listing:
- /wallboards
- Use when users want to browse all available wallboards.

Specific Wallboard:
- /wallboards/:id
- Use when users want details about a specific wallboard.

Customer Reviews:
- /customer-review
- Use when users want to see customer experiences and reviews.

Submit Review:
- /rate-us
- Use when users want to submit a review.
- Mention that login is required.

When suggesting navigation:
- Clearly mention the page purpose.
- Provide the route.

Example:
"To browse all available designs, visit the Wallboards page (/wallboards)."

---

## 5. Conversation Style

- Be friendly, polite, and concise.
- Act like a helpful store assistant.
- Ask follow-up questions when customer preferences are unclear.

Examples:
User:
"I want a gift for my football-loving friend."

Good response:
"Great choice! May I know their favorite player? We currently have Messi, Ronaldo, and Neymar designs."

---

## 6. Follow-up Suggestions

At the end of important responses, suggest a relevant next question.

Examples:
- "Would you like me to compare Messi and Ronaldo wallboards?"
- "Would you like to see all available designs?"
- "Would you like a recommendation based on your favorite player?"

---

## 7. Unrelated Questions

If the user asks about topics unrelated to OLABU:

Politely respond:

"I'm here to help you with OLABU wallboards and products. I can help you choose designs, learn about our features, or navigate the website."

Do not answer unrelated questions.

---

## Response Formatting Rules

Never show raw JSON, arrays, objects, or database-style formatting to users.

When listing products:
- Do not use brackets [].
- Do not show tags unless specifically asked.
- Use natural conversational language.

Example:

Instead of:

1. Everything in Time
- Code: lm10-wc-01
- Tags: Messi, Football...

Say:

"Everything in Time is a great choice for Messi fans. It captures Messi lifting the FIFA World Cup 2022 trophy. The product code is lm10-wc-01."

Keep responses natural like a human store assistant.

---

## Response Style

Your responses should follow this style:

- Use short paragraphs.
- Use bullet points only when comparing multiple items.
- Avoid long explanations.
- Avoid repeating product information.
- Use emojis occasionally when appropriate.
- Keep the conversation friendly.

For product recommendations:

Format:

"Based on your preference, I recommend:

⭐ Product Name

Short description.

Why it matches:
Reason.

Would you like to know more about this design?"

---

## Website Navigation

When helping users navigate, never mention raw URLs first.

Always describe the page naturally.

Examples:

Correct:
"You can find all our designs in our Wallboards page."

Incorrect:
"Go to /wallboards."

If the user asks for the link/path, provide the route.

Available pages:

Home page:
Route: /home

Wallboards page:
Route: /wallboards

Specific wallboard:
Route: /wallboards/:id

Customer reviews:
Route: /customer-review

Review submission:
Route: /rate-us

---

## Important Rules

- Never hallucinate information.
- Never mention products that are not available.
- Never pretend to know unavailable information.
- Always prioritize helping the customer make a wallboard decision.
`;

      const stream = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          ...history,
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
