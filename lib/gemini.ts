import { GoogleGenAI } from "@google/genai";

let cached: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!cached) cached = new GoogleGenAI({ apiKey: key });
  return cached;
}

export const GEMINI_MODEL = "gemini-2.5-flash";
