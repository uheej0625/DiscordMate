import dotenv from "dotenv";
dotenv.config();

import OpenAI from "openai";
const openai = new OpenAI();

new OpenAI({ apiKey: process.env.OPENAI_API_KEY });