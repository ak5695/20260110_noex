import { useRef, useEffect } from "react"
import type { MutableRefObject } from "react"
import {
    parseCompactExcalidrawStreaming,
    parseCompactExcalidraw,
    convertCompactToExcalidraw
} from "@/lib/ai-excalidraw/excalidraw-converter"
import { layoutWithStrategy, LayoutStrategy } from "@/lib/ai-excalidraw/auto-layout-dagre"

// Mock types
interface ToolCall {
    toolCallId: string
    toolName: string
    input: unknown
    state: "input-streaming" | "input-available" | "output-available" | "output-error"
}

interface Message {
    toolInvocations?: Array<{
        toolCallId: string
        toolName: string
        args: any
        state?: string // 'partial-call' | 'call' | 'result'
    }>
    // Backwards compatibility if needed, but we focus on toolInvocations
    parts?: any[]
}

/**
 * Example Hook: usage in a Chat Component to handle streaming Excalidraw updates
 */
export function useExcalidrawStreaming({
    messages,
    setExcalidrawElements,
    strategy = 'flowchart'
}: {
    messages: Message[]
    setExcalidrawElements: (elements: any[]) => void
    strategy?: LayoutStrategy
}) {
    // Track the last processed JSON to avoid redundant work
    const lastProcessedJsonRef = useRef<Map<string, string>>(new Map())

    // Debounce reference
    const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pendingElementsRef = useRef<any[] | null>(null)
    const lastElementCountRef = useRef<number>(0)

    const STREAMING_DEBOUNCE_MS = 250

    // 1. Listen for message updates (Streaming)
    useEffect(() => {
        // Only process the last message for performance
        const lastMessage = messages[messages.length - 1]

        // Vercel AI SDK v3: Check toolInvocations
        if (lastMessage?.toolInvocations) {
            const toolCall = lastMessage.toolInvocations.find(t => t.toolName === 'display_excalidraw')

            if (toolCall) {
                const { toolCallId, args } = toolCall

                // Debug log to trace streaming data
                console.log(`[Streaming] Tool Call: ${toolCallId}`, args);

                // We need 'elements' string input
                if (!args || typeof args !== 'object') return

                let elementsJson = '';
                if ('elements' in args && typeof args.elements === 'string') {
                    elementsJson = args.elements;
                } else {
                    return;
                }

                // Skip if JSON hasn't changed
                const lastJson = lastProcessedJsonRef.current.get(toolCallId)
                if (lastJson === elementsJson) return

                // Handle Streaming & Updates
                // For Vercel SDK, we treat it as always streaming until it's done. 
                // We try to parse whatever we have.

                // A. Parse partial JSON safely
                const { elements: compactElements, isComplete } = parseCompactExcalidrawStreaming(elementsJson)

                if (compactElements.length > 0) {
                    console.log(`[Streaming] Parsed ${compactElements.length} elements (Complete: ${isComplete})`);

                    // Layout & Convert
                    const layoutedElements = layoutWithStrategy(compactElements, strategy)
                    const excalidrawElements = convertCompactToExcalidraw(layoutedElements)

                    // C. Debounce updates to Canvas
                    pendingElementsRef.current = excalidrawElements

                    if (!debounceTimeoutRef.current) {
                        debounceTimeoutRef.current = setTimeout(() => {
                            const pending = pendingElementsRef.current
                            debounceTimeoutRef.current = null
                            pendingElementsRef.current = null

                            // Update mechanism
                            if (pending && pending.length > 0) {
                                lastElementCountRef.current = pending.length
                                setExcalidrawElements(pending)
                                lastProcessedJsonRef.current.set(toolCallId, elementsJson)
                            }
                        }, STREAMING_DEBOUNCE_MS)
                    }
                } else {
                    if (elementsJson.length > 10) {
                        console.warn("[Streaming] JSON present but 0 elements parsed:", elementsJson.substring(0, 50));
                    }
                }
            }
            return
        }

        // Fallback: Check parts (Legacy/Other SDKs)
        if (!lastMessage?.parts) return

        lastMessage.parts.forEach((part) => {
            // Check for display_excalidraw tool call
            if (part.type === "tool-display_excalidraw" || (part.toolName === "display_excalidraw")) {
                // ... (Keep existing legacy logic if needed, or just remove)
                // For safety in this refactor, I will focus on toolInvocations as primary.
            }
        })
    }, [messages, setExcalidrawElements, strategy])
}
