/**
 * Drag Hint Component
 *
 * Shows a hint to users about the Shift+Drag feature
 * Appears when text is selected
 */

"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Move } from "lucide-react";

interface DragHintProps {
  containerSelector?: string;
}

export const DragHint: React.FC<DragHintProps> = ({
  containerSelector = ".bn-container",
}) => {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user has seen this hint before
    const hasSeenHint = localStorage.getItem("drag-hint-dismissed");
    if (hasSeenHint) {
      setDismissed(true);
      return;
    }

    let timeoutId: NodeJS.Timeout;

    const handleSelectionChange = () => {
      const selection = window.getSelection();

      if (!selection || selection.isCollapsed) {
        setShow(false);
        return;
      }

      const selectedText = selection.toString().trim();

      // Only show for meaningful selections (> 5 characters)
      if (selectedText.length > 5) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Position hint below the selection
        setPosition({
          x: rect.left + rect.width / 2,
          y: rect.bottom + 10,
        });

        // Show after short delay to avoid flickering
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setShow(true);
        }, 500);
      } else {
        setShow(false);
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      clearTimeout(timeoutId);
    };
  }, [dismissed]);

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    localStorage.setItem("drag-hint-dismissed", "true");
  };

  if (!show || dismissed) return null;

  return (
    <div
      className="fixed z-[999] pointer-events-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translateX(-50%)",
      }}
    >
      <div className="pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-xs font-medium">
          <Move className="w-3 h-3" />
          <span>Hold <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-bold">Shift</kbd> to drag to canvas</span>
          <button
            onClick={handleDismiss}
            className="ml-1 opacity-70 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        </div>
        {/* Arrow pointing to selection */}
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-orange-500 rotate-45" />
      </div>
    </div>
  );
};
