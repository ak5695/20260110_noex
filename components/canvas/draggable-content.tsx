/**
 * Draggable Content Component
 *
 * Makes document content draggable to canvas
 * Usage: Wrap any content that should be draggable
 */

"use client";

import React, { useRef, ReactNode } from "react";
import { DragPayload, DRAG_MIME_TYPE } from "@/lib/canvas/drag-drop-types";
import { dragDropBridge } from "@/lib/canvas/drag-drop-bridge";

interface DraggableContentProps {
  children: ReactNode;

  // Drag data
  text: string;
  documentId: string;
  blockId?: string;
  semanticNodeId?: string;

  // Optional configurations
  sourceType?: DragPayload["sourceType"];
  metadata?: any;

  // Callbacks
  onDragStart?: (payload: DragPayload) => void;
  onDragEnd?: () => void;

  // Styling
  className?: string;
  dragCursorClass?: string;
}

export const DraggableContent: React.FC<DraggableContentProps> = ({
  children,
  text,
  documentId,
  blockId,
  semanticNodeId,
  sourceType = "text",
  metadata,
  onDragStart,
  onDragEnd,
  className = "",
  dragCursorClass = "cursor-grab active:cursor-grabbing",
}) => {
  const dragRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent) => {
    // Create drag payload
    const payload = dragDropBridge.createDragPayload({
      text,
      documentId,
      blockId,
      semanticNodeId,
      sourceType,
      metadata,
    });

    // Set custom data format
    e.dataTransfer.setData(DRAG_MIME_TYPE, dragDropBridge.serializeDragPayload(payload));

    // Also set plain text as fallback
    e.dataTransfer.setData("text/plain", text);

    // Set drag effect
    e.dataTransfer.effectAllowed = "copy";

    // Visual feedback
    if (dragRef.current) {
      dragRef.current.style.opacity = "0.5";
    }

    // Callback
    onDragStart?.(payload);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    // Restore opacity
    if (dragRef.current) {
      dragRef.current.style.opacity = "1";
    }

    // Callback
    onDragEnd?.();
  };

  return (
    <div
      ref={dragRef}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`${className} ${dragCursorClass} transition-opacity`}
      data-draggable="true"
      data-document-id={documentId}
      data-block-id={blockId}
    >
      {children}
    </div>
  );
};

/**
 * Draggable Text Component
 * Specialized for text selections
 */
interface DraggableTextProps {
  text: string;
  documentId: string;
  blockId?: string;
  className?: string;
}

export const DraggableText: React.FC<DraggableTextProps> = ({
  text,
  documentId,
  blockId,
  className = "",
}) => {
  return (
    <DraggableContent
      text={text}
      documentId={documentId}
      blockId={blockId}
      sourceType="text"
      className={className}
    >
      {text}
    </DraggableContent>
  );
};

/**
 * Draggable Block Component
 * For entire blocks
 */
interface DraggableBlockProps {
  children: ReactNode;
  text: string;
  documentId: string;
  blockId: string;
  blockType?: string;
  className?: string;
}

export const DraggableBlock: React.FC<DraggableBlockProps> = ({
  children,
  text,
  documentId,
  blockId,
  blockType,
  className = "",
}) => {
  return (
    <DraggableContent
      text={text}
      documentId={documentId}
      blockId={blockId}
      sourceType="block"
      metadata={{ blockType }}
      className={className}
    >
      {children}
    </DraggableContent>
  );
};

/**
 * Draggable Semantic Node Component
 * For semantic nodes with special styling
 */
interface DraggableSemanticNodeProps {
  children: ReactNode;
  text: string;
  documentId: string;
  semanticNodeId: string;
  semanticLabel?: string;
  className?: string;
}

export const DraggableSemanticNode: React.FC<DraggableSemanticNodeProps> = ({
  children,
  text,
  documentId,
  semanticNodeId,
  semanticLabel,
  className = "",
}) => {
  return (
    <DraggableContent
      text={text}
      documentId={documentId}
      semanticNodeId={semanticNodeId}
      sourceType="semantic-node"
      metadata={{ semanticLabel }}
      className={`${className} border-l-2 border-purple-500 pl-2`}
    >
      {children}
    </DraggableContent>
  );
};
