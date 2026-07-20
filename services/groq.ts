import Groq from "groq-sdk";

export function getGroqClient() {
  return new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });
}
