"use client";

import dynamic from "next/dynamic";
import "@excalidraw/excalidraw/index.css";
import { useTheme } from "next-themes";
import { Maximize, Minimize } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

const Excalidraw = dynamic(
    () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
    {
        ssr: false,
        loading: () => (
            <div className="h-full w-full flex items-center justify-center">
                <div className="text-gray-500">Loading canvas...</div>
            </div>
        )
    }
);

interface ExcalidrawCanvasProps {
    className?: string;
    initialData?: any;
    onChange?: (elements: any[], appState: any) => void;
    isFullscreen?: boolean;
    onToggleFullscreen?: () => void;
}

const ToolbarPortal = ({ isFullscreen, onToggle }: { isFullscreen?: boolean; onToggle?: () => void }) => {
    if (!onToggle) return null;

    return (
        <button
            className="flex items-center justify-center rounded-lg transition-colors pointer-events-auto shadow-sm hover:opacity-80"
            style={{
                position: "absolute",
                top: "4.5rem",
                left: "1rem",
                width: "2.25rem",
                height: "2.25rem",
                zIndex: 50,
                backgroundColor: "var(--island-bg-color, #232329)",
                color: "var(--icon-fill-color, #ced4da)"
            }}
            onClick={onToggle}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
            {isFullscreen ? (
                <Minimize className="h-4 w-4" />
            ) : (
                <Maximize className="h-4 w-4" />
            )}
        </button>
    );
};

export const ExcalidrawCanvas = ({ className, initialData, onChange, isFullscreen, onToggleFullscreen }: ExcalidrawCanvasProps) => {
    const { resolvedTheme } = useTheme();

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <Excalidraw
                theme={resolvedTheme === "dark" ? "dark" : "light"}
                initialData={initialData}
                onChange={(elements, appState) => {
                    if (onChange) {
                        onChange([...elements], appState);
                    }
                }}
            />
            {onToggleFullscreen && (
                <ToolbarPortal isFullscreen={isFullscreen} onToggle={onToggleFullscreen} />
            )}
        </div>
    );
};

export default ExcalidrawCanvas;
