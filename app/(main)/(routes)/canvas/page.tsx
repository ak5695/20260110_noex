"use client";

import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";

const CanvasPage = () => {
  return (
    <div className="h-full w-full">
      <div className="fixed inset-0" style={{ height: '100vh' }}>
        <Tldraw />
      </div>
    </div>
  );
};

export default CanvasPage;
