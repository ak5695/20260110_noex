"use client";

import dynamic from "next/dynamic";
import "@excalidraw/excalidraw/index.css";
import { useTheme } from "next-themes";

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
}

export const ExcalidrawCanvas = ({ className, initialData, onChange }: ExcalidrawCanvasProps) => {
    const { resolvedTheme } = useTheme();

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <Excalidraw
                theme={resolvedTheme === "dark" ? "dark" : "light"}
                initialData={initialData}
                onChange={(elements, appState) => {
                    if (onChange) {
                        onChange([...elements], appState);
                    }
                }}
            />
        </div>
    );
};

export default ExcalidrawCanvas;
