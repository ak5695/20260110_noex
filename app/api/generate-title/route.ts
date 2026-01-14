import { google } from "@ai-sdk/google";
import { generateText } from "ai";

export const maxDuration = 30;

export async function POST(req: Request) {
    const { content } = await req.json();

    if (!content) {
        return new Response("Content is required", { status: 400 });
    }

    try {
        const { text } = await generateText({
            model: google("gemini-2.0-flash"),
            system: `You are a helpful AI assistant that generates document titles.
Your task is to generate a short, concise, and descriptive title (max 6 words) based on the provided document content.
IMPORTANT: Detect the language of the content and generate the title IN THE SAME LANGUAGE.
Return ONLY the title text. Do not use quotes, markdown, or any explanations.`,
            prompt: `Document content:\n${content}\n\nGenerate a title in the same language as the content:`,
        });

        return Response.json({ title: text.trim() });
    } catch (error) {
        console.error("Title generation error:", error);
        return new Response("Failed to generate title", { status: 500 });
    }
}
