"use client";

import dynamic from "next/dynamic";

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  { ssr: false }
);

const CanvasPage = () => {
  return (
    <div className="h-full w-full">
      <div className="fixed inset-0" style={{ height: '100vh' }}>
        <Excalidraw />
      </div>
    </div>
  );
};

export default CanvasPage;
