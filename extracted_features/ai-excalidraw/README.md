# AI Excalidraw Generation & Streaming Feature

This folder contains the core logic for generating Excalidraw diagrams via AI, streaming them to the client, and rendering them on a canvas.

## Key Files

### 1. Generating Prompts (`system-prompts-excalidraw.ts`)
*   **Role**: Defines the System Prompt used to instruct the AI model.
*   **Key Feature**: Defines a **Semantic Format (V2)** where the AI only needs to output the *structure* (nodes, hierarchy, connections) without worrying about `x, y` coordinates or sizes.
*   **Format**: Returns a generic JSON structure `{"e": [...]}` with compact keys (`t`=type, `i`=id, `l`=label, etc.).

### 2. Tool Definition (`tool-definition.ts`)
*   **Role**: The Zod schema and tool definition for the `display_excalidraw` tool used by the Vercel AI SDK (server-side).
*   **Key Feature**: Instructs the model to output the "Compact JSON" format which saves tokens and latency.

### 3. Parsing & Conversion (`excalidraw-converter.ts`)
*   **Role**: The bridge between AI output and Excalidraw.
*   **Key Functions**:
    *   `parseCompactExcalidrawStreaming(json)`: Robust parser that handles *incomplete* or *malformed* JSON chunks during streaming. It tries to extract valid objects even if the array isn't closed.
    *   `convertCompactToExcalidraw(compactElements)`: Converts the semantic elements into full Excalidraw `ExcalidrawElement` objects (calculating styles, arrow bindings, groups). It calls the auto-layout engine.

### 4. Auto-Layout (`auto-layout-dagre.ts`)
*   **Role**: Calculates positions (`x`, `y`) and sizes (`width`, `height`) for the elements.
*   **Key Feature**: Uses `dagre` (Graphviz-like) algorithm to automatically arrange nodes and edges in a hierarchical or flow layout. This solves the "AI is bad at coordinates" problem.

### 5. Client Integration (`client-streaming-example.tsx`)
*   **Role**: A reference implementation (React Hook) showing how to consume the streaming data on the frontend.
*   **Workflow**:
    1.  Listens to `messages` from `useChat`.
    2.  Detects `tool-display_excalidraw` parts.
    3.  Calls `parseCompactExcalidrawStreaming` on the partial JSON string.
    4.  Converts directly to Excalidraw elements.
    5.  Debounces updates to avoid flickering.
    6.  Updates the Canvas context (`setExcalidrawElements`).

## Usage Flow

1.  **AI Request**: User asks for a diagram.
2.  **System Prompt**: Injects instructions to use `display_excalidraw` with semantic JSON.
3.  **Generation**: AI generates JSON chunks.
4.  **Streaming**: Client hook (`client-streaming-example.tsx`) receives chunks.
5.  **Parsing**: `parseCompactExcalidrawStreaming` extracts valid nodes from partial JSON.
6.  **Layout**: `convertCompactToExcalidraw` -> `auto-layout-dagre` calculates layout.
7.  **Render**: Excalidraw canvas updates in real-time.
