/**
 * Enhanced Excalidraw Component
 *
 * Wraps Excalidraw with drag-drop support and canvas storage integration
 * Handles element creation, binding management, and real-time sync
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import type { AppState } from "@excalidraw/excalidraw/types/types";
import { CanvasDropZone } from "./canvas-drop-zone";
import { createCanvasBinding, saveCanvasElements } from "@/actions/canvas-bindings";
import type { DropResult } from "@/lib/canvas/drag-drop-types";

interface EnhancedExcalidrawProps {
  canvasId: string;
  documentId: string;
  initialElements?: ExcalidrawElement[];
  onSave?: (elements: ExcalidrawElement[]) => void;
}

export const EnhancedExcalidraw: React.FC<EnhancedExcalidrawProps> = ({
  canvasId,
  documentId,
  initialElements = [],
  onSave,
}) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [elements, setElements] = useState<ExcalidrawElement[]>(initialElements);

  // Handle elements created from drag-drop
  const handleElementsCreated = useCallback(
    async (newElements: ExcalidrawElement[]) => {
      try {
        console.log("[EnhancedExcalidraw] Elements created:", newElements.length);

        // Add elements to Excalidraw
        if (excalidrawAPI) {
          const currentElements = excalidrawAPI.getSceneElements();
          const updatedElements = [...currentElements, ...newElements];
          excalidrawAPI.updateScene({
            elements: updatedElements,
          });

          // Update local state
          setElements(updatedElements);

          // Save to database
          await saveCanvasElements(
            canvasId,
            newElements.map((el) => ({
              id: el.id,
              type: el.type,
              x: el.x,
              y: el.y,
              width: el.width,
              height: el.height,
              angle: el.angle,
              data: el,
            }))
          );

          // Notify parent
          onSave?.(updatedElements);
        }
      } catch (error) {
        console.error("[EnhancedExcalidraw] Error adding elements:", error);
      }
    },
    [excalidrawAPI, canvasId, onSave]
  );

  // Handle binding creation from drag-drop
  const handleBindingCreated = useCallback(
    async (result: DropResult) => {
      try {
        if (!result.success || !result.binding) {
          console.warn("[EnhancedExcalidraw] Invalid binding result");
          return;
        }

        console.log("[EnhancedExcalidraw] Creating binding:", result.binding);

        // Save binding to database
        const response = await createCanvasBinding({
          canvasId: result.binding.canvasId,
          documentId: result.binding.documentId,
          elementId: result.binding.elementId,
          blockId: result.binding.blockId,
          semanticNodeId: result.binding.semanticNodeId,
          bindingType: result.binding.bindingType,
          sourceType: result.binding.sourceType,
          anchorText: result.binding.anchorText,
          metadata: result.binding.metadata,
        });

        if (!response.success) {
          console.error("[EnhancedExcalidraw] Failed to create binding:", response.error);
        } else {
          console.log("[EnhancedExcalidraw] Binding created successfully:", response.binding?.id);
        }
      } catch (error) {
        console.error("[EnhancedExcalidraw] Error creating binding:", error);
      }
    },
    [canvasId]
  );

  // Handle Excalidraw onChange
  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState) => {
      setElements([...elements]);
      // TODO: Debounced save to database for user edits
    },
    []
  );

  return (
    <CanvasDropZone
      canvasId={canvasId}
      documentId={documentId}
      onElementsCreated={handleElementsCreated}
      onBindingCreated={handleBindingCreated}
      className="w-full h-full"
    >
      <Excalidraw
        ref={(api) => setExcalidrawAPI(api)}
        initialData={{
          elements: initialElements,
          appState: {
            viewBackgroundColor: "#ffffff",
          },
        }}
        onChange={handleChange}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            export: true,
            saveToActiveFile: false,
          },
        }}
      />
    </CanvasDropZone>
  );
};

export default EnhancedExcalidraw;
