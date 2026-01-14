import { google } from "@ai-sdk/google";
import { streamText, tool } from "ai";
import { getExcalidrawSystemPrompt } from "@/lib/ai-excalidraw/system-prompts-excalidraw";
import { displayExcalidrawTool } from "@/lib/ai-excalidraw/tool-definition";

export const maxDuration = 60;

export async function POST(req: Request) {
    const { messages } = await req.json();

    const result = await streamText({
        model: google("gemini-2.0-flash"),
        messages,
        system: getExcalidrawSystemPrompt("Gemini"),
        tools: {
            display_excalidraw: tool({
                description: displayExcalidrawTool.display_excalidraw.description,
                parameters: displayExcalidrawTool.display_excalidraw.inputSchema,
                execute: displayExcalidrawTool.display_excalidraw.execute,
            })
        },
        // Force the model to use the tool to generate the diagram
        toolChoice: "required",
    });

    return result.toTextStreamResponse();
}
