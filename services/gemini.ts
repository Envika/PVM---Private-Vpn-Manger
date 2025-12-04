import { GoogleGenAI } from "@google/genai";

const getApiKey = () => {
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.API_KEY;
    }
  } catch (e) {
    // ignore
  }
  return undefined;
};

const apiKey = getApiKey();
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const generateWelcomeMessage = async (username: string): Promise<string> => {
  if (!ai) return `Welcome ${username}! We are excited to have you. Please wait for your unique access code.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate a short, cyberpunk-style, mysterious but welcoming message for a new user named "${username}" joining an exclusive private network called "GhostLayer". Keep it under 200 characters.`,
    });
    return response.text || "Welcome to the network.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return `Welcome ${username}! We are processing your request.`;
  }
};

export const suggestReply = async (userMessage: string): Promise<string> => {
  if (!ai) return "Thank you for your message. An admin will review it shortly.";
  
  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are a support bot for a VPN service. A user said: "${userMessage}". Draft a polite, professional, and concise response (max 1 sentence) acknowledging the issue.`,
    });
    return response.text || "Message received.";
  } catch (error) {
    return "Message received.";
  }
};

export const generateBroadcastMessage = async (topic: string, tone: 'urgent' | 'casual' | 'formal' = 'formal'): Promise<string> => {
  if (!ai) return `📢 Announcement: ${topic}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Write a short, engaging Telegram-style announcement message (under 300 characters) for VPN bot users.
      Topic: ${topic}
      Tone: ${tone}
      Context: This is for the "GhostLayer" network. Use suitable emojis. Do not use markdown bolding (like **text**), use plain text or caps for emphasis.`,
    });
    return response.text || `📢 Announcement: ${topic}`;
  } catch (error) {
    return `📢 Announcement: ${topic}`;
  }
};