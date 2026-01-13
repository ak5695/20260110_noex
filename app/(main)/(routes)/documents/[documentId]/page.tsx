"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getById } from "@/actions/documents";
import { Toolbar } from "@/components/toolbar";
import { Cover } from "@/components/cover";
import { Navbar } from "@/components/main/navbar";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { writeQueue } from "@/lib/write-queue";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { DocumentOutline } from "@/components/document-outline";
import { useDocument, useDocumentStore } from "@/store/use-document-store";
import {
  useLayoutStore,
  useCanvasOpen,
  useCanvasFullscreen,
  useOutlineOpen
} from "@/store/use-layout-store";
import { Group, Panel, Separator } from "react-resizable-panels";

export default function DocumentIdPage() {
  const { documentId } = useParams();
  const Editor = useMemo(
    () => dynamic(() => import("@/components/editor"), {
      ssr: false,
      loading: () => (
        <div className="space-y-4 pt-4">
          <Skeleton className="h-4 w-[80%]" />
          <Skeleton className="h-4 w-[40%]" />
          <Skeleton className="h-4 w-[60%]" />
        </div>
      )
    }),
    [],
  );

  const ExcalidrawCanvas = useMemo(
    () => dynamic(() => import("@/components/excalidraw-canvas"), {
      ssr: false,
      loading: () => (
        <div className="h-full w-full flex items-center justify-center bg-muted/20">
          <div className="flex flex-col items-center gap-y-2">
            <Loader2 className="h-6 w-6 text-rose-500 animate-spin" />
            <p className="text-xs text-muted-foreground font-medium">Canvas Initializing...</p>
          </div>
        </div>
      )
    }),
    [],
  );

  const [document, setDocument] = useState<any>(null); // Start with null, not optimism
  const [editorDocument, setEditorDocument] = useState<any>(null);
  const documentVersionRef = useRef<number>(0);
  const lastDocumentIdRef = useRef<string | null>(null);

  // Use Zustand store for layout state
  const isCanvasOpen = useCanvasOpen();
  const isCanvasFullscreen = useCanvasFullscreen();
  const isOutlineOpen = useOutlineOpen();
  const { toggleCanvas, toggleFullscreen, toggleOutline, openCanvas } = useLayoutStore();

  // ⚡ Instant Document Loading - Cache-First Strategy
  // Goal: NEVER show loading skeleton when switching between cached documents
  useEffect(() => {
    if (typeof documentId !== "string") return;

    // If same document, skip
    if (lastDocumentIdRef.current === documentId && document) return;
    lastDocumentIdRef.current = documentId;

    let isMounted = true;

    const loadDocument = async () => {
      // 【Step 1】立即检查 Zustand Store（同步，零延迟）
      const storeDoc = useDocumentStore.getState().documents.get(documentId);
      if (storeDoc && isMounted) {
        console.log("[DocumentPage] Instant from Zustand Store");
        setDocument(storeDoc);
        documentVersionRef.current = storeDoc.version || 0;
      }

      // 【Step 2】检查 IndexedDB 缓存（异步，<10ms）
      try {
        const { documentCache } = await import("@/lib/cache/document-cache");
        const cached = await documentCache.get(documentId, async () => null);
        if (cached && isMounted) {
          // Only update if we don't have data yet or cache is newer
          if (!document || cached.version > documentVersionRef.current) {
            console.log("[DocumentPage] Instant from IndexedDB Cache");
            setDocument(cached);
            documentVersionRef.current = cached.version;
          }
        }
      } catch (e) {
        console.warn("[DocumentPage] Cache read error:", e);
      }

      // 【Step 3】后台从服务器同步（不阻塞UI）
      try {
        const serverDoc = await getById(documentId);
        if (serverDoc && isMounted) {
          // Only update if server has newer version
          if (serverDoc.version >= documentVersionRef.current) {
            setDocument(serverDoc);
            documentVersionRef.current = serverDoc.version;

            // Update cache for next time
            const { documentCache } = await import("@/lib/cache/document-cache");
            documentCache.set(documentId, serverDoc);

            console.log("[DocumentPage] Synced from server, version:", serverDoc.version);
          }
        } else if (!document && isMounted) {
          // Document not found and we have no cached version
          setDocument(null);
        }
      } catch (err) {
        console.error("[DocumentPage] Server fetch error:", err);
        // Keep showing cached data if available
        if (!document && isMounted) {
          setDocument(null);
        }
      }
    };

    loadDocument();
    return () => { isMounted = false; };
  }, [documentId]); // Only depend on documentId, not document

  // Listen for document conflicts
  useEffect(() => {
    const handleConflict = (event: any) => {
      if (event.detail.documentId === documentId) {
        alert("This document has been updated by another user. Please refresh to see the latest changes.");
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("document-conflict", handleConflict);
      return () => window.removeEventListener("document-conflict", handleConflict);
    }
  }, [documentId]);

  // Enterprise-grade onChange with write queue
  const onChange = useCallback(async (content: string) => {
    if (typeof documentId === "string" && document?.userId) {
      try {
        await writeQueue.queueUpdate({
          documentId,
          fieldName: "content",
          updates: { content },
          userId: document.userId,
        });
      } catch (error) {
        console.error("[DocumentPage] Failed to update content:", error);
      }
    }
  }, [documentId, document?.userId]);

  // Fast Shell: If document is still loading, show the basic structure immediately
  // to prevent the "Blank Screen" flash that users hate.
  if (document === undefined) {
    return (
      <div className="relative h-full overflow-hidden bg-background dark:bg-[#1F1F1F]">
        <div className="absolute left-0 top-0 bottom-0 right-0 flex flex-col overflow-hidden">
          <div className="h-12 border-b bg-background/50 flex items-center px-4">
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="pb-40">
              <Cover.Skeleton />
              <div className="md:max-w-3xl lg:max-w-4xl mx-auto mt-10 space-y-4 px-8">
                <Skeleton className="h-10 w-[60%]" />
                <Skeleton className="h-4 w-[80%]" />
                <Skeleton className="h-4 w-[40%]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (document === null) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <p className="text-muted-foreground">Document not found</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-background dark:bg-[#1F1F1F] overflow-hidden">
      <Group direction="horizontal">

        {/* Editor Panel */}
        <Panel
          className={cn("flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out", isCanvasFullscreen && "hidden")}
          defaultSize={50}
          minSize={20}
          order={1}
          id="editor-panel"
        >
          <div className="flex flex-col h-full relative">
            {/* Navbar */}
            <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40">
              <Navbar
                isCanvasOpen={isCanvasOpen}
                onToggleCanvas={toggleCanvas}
                isOutlineOpen={isOutlineOpen}
                onToggleOutline={toggleOutline}
              />
            </div>

            {/* Content Scroll Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative">
              <div className="pb-40">
                <Cover url={document.coverImage} />
                <div className="md:max-w-3xl lg:max-w-4xl mx-auto">
                  <Toolbar initialData={document} />
                  <Editor
                    onChange={onChange}
                    initialContent={document.content}
                    userId={document.userId}
                    documentId={documentId as string}
                    onDocumentChange={setEditorDocument}
                  />
                </div>
              </div>

              {/* Outline - Absolute to Editor Panel */}
              {isOutlineOpen && (
                <div className="fixed top-24 bottom-4 right-6 w-64 bg-background/95 backdrop-blur-md border border-border/40 rounded-xl shadow-xl overflow-hidden z-40 hidden xl:block animate-in fade-in slide-in-from-right-4">
                  <DocumentOutline editorDocument={editorDocument} className="h-full overflow-y-auto custom-scrollbar" />
                </div>
              )}
            </div>
          </div>
        </Panel>

        {/* Resize Handle (Separator) */}
        {isCanvasOpen && !isCanvasFullscreen && (
          <Separator className="w-2 bg-transparent hover:bg-primary/10 transition-colors flex items-center justify-center group/handle z-50 outline-none cursor-col-resize -ml-[4px] -mr-[4px] relative">
            <div className="w-[1px] h-full bg-border/40 group-hover/handle:bg-primary/50 transition-all shadow-[0_0_10px_rgba(0,0,0,0.05)]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-muted-foreground/20 rounded-full group-hover/handle:bg-primary/40 transition-colors opacity-0 group-hover/handle:opacity-100" />
          </Separator>
        )}

        {/* Canvas Panel */}
        {isCanvasOpen && (
          <Panel
            className={cn("flex flex-col h-full bg-muted/5", isCanvasFullscreen && "w-full flex-1")}
            defaultSize={50}
            minSize={20}
            order={2}
            id="canvas-panel"
          >
            <div className="flex-1 relative border-l border-white/5 overflow-hidden shadow-inner">
              <ExcalidrawCanvas
                documentId={documentId as string}
                isFullscreen={isCanvasFullscreen}
                onToggleFullscreen={toggleFullscreen}
              />
            </div>
          </Panel>
        )}

      </Group>

      <SelectionToolbar
        documentId={documentId as string}
        onEnsureCanvas={openCanvas}
      />
    </div>
  );
}
