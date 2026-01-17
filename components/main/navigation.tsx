"use client";

import { authClient } from "@/lib/auth-client";
import { useDocumentStore } from "@/store/use-document-store";
import { mutate } from "swr";

import {
  ChevronLeft,
  MenuIcon,
  Plus,
  PlusCircle,
  Search,
  Settings,
  Trash,
  Palette,
} from "lucide-react";
import React, {
  ElementRef,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useMediaQuery } from "usehooks-ts";
import { useParams, usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { UserItem } from "@/components/main/user-item";
import { create } from "@/actions/documents";
import { Item } from "@/components/main/item";
import { toast } from "sonner";
import { DocumentList } from "@/components/main/document-list";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TrashBox } from "@/components/main/trash-box";
import { useSearch } from "@/hooks/use-search";
import { useSettings } from "@/hooks/use-settings";
import { useSidebarStore } from "@/store/use-sidebar-store";

export const Navigation = () => {
  const router = useRouter();
  const search = useSearch();
  const settings = useSettings();
  const pathname = usePathname();
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Use Zustand store for sidebar state
  const {
    isCollapsed,
    isResetting,
    width,
    collapse,
    expand,
    toggle,
    setWidth,
    reset
  } = useSidebarStore();

  const { data: session } = authClient.useSession();
  const setDocument = useDocumentStore((state) => state.setDocument);

  const isResizingRef = useRef(false);
  const sidebarRef = useRef<ElementRef<"aside">>(null);

  // Sync sidebar width with DOM
  useEffect(() => {
    if (sidebarRef.current) {
      sidebarRef.current.style.width = isCollapsed ? "0" : `${width}px`;
    }
  }, [width, isCollapsed]);

  const handleMouseDown = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    isResizingRef.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!isResizingRef.current) return;
    let newWidth = event.clientX;

    if (newWidth < 240) newWidth = 240;
    if (newWidth > 480) newWidth = 480;

    if (sidebarRef.current) {
      sidebarRef.current.style.width = `${newWidth}px`;
    }
    setWidth(newWidth);
  };

  const handleMouseUp = () => {
    isResizingRef.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const handleCreate = () => {
    const tempId = crypto.randomUUID();

    // ⚡ Phase 1: Optimistic sidebar update FIRST (instant highlight)
    if (session?.user) {
      const optimisticDoc = {
        id: tempId,
        title: "Untitled",
        userId: session.user.id,
        version: 1,
        createdAt: new Date(),
        isArchived: false,
        isPublished: false,
        parentDocumentId: null,
      };

      setDocument(optimisticDoc);

      // ⚡ Sidebar list update
      mutate(["documents", undefined], (current: any) => {
        return [optimisticDoc, ...(current || [])];
      }, false);
    }

    // ⚡ Phase 2: Immediate Jump (no waiting)
    router.push(`/documents/${tempId}`);

    // ⚡ Phase 3: Silent background creation (no toast)
    create({
      id: tempId,
      title: "Untitled"
    }).then(() => {
      window.dispatchEvent(new CustomEvent("documents-changed"));
    }).catch((error) => {
      // Only show toast on error
      toast.error("Failed to save note - please refresh");
      console.error("[Create] Error:", error);
    });
  };

  // Initialize sidebar based on device type
  useEffect(() => {
    reset(isMobile);
  }, [isMobile, reset]);

  // Collapse on mobile when navigating
  useEffect(() => {
    if (isMobile) collapse();
  }, [pathname, isMobile, collapse]);

  return (
    <>
      <aside
        ref={sidebarRef}
        className={cn(
          "group/sidebar h-full bg-secondary relative flex w-60 flex-col z-[99999] overflow-hidden",
          isResetting && "transition-all ease-in-out duration-300",
          isMobile && "w-0",
        )}
      >
        {/* Collapse Button */}
        <div
          role="button"
          onClick={collapse}
          className={cn(
            "h-5 w-5 text-muted-foreground rounded-sm hover:bg-neutral-300 dark:hover:bg-neutral-600 absolute top-3.5 right-2 transition cursor-pointer",
            isMobile && "opacity-100",
          )}
        >
          <ChevronLeft className="h-5 w-5" />
        </div>

        {/* Fixed Header - Does NOT scroll */}
        <div className="shrink-0 px-1 py-2">
          <UserItem />
          <Item
            onClick={search.onOpen}
            label="Search"
            icon={Search}
            isSearch={!isMobile && width > 320}
          />
          <Item onClick={settings.onOpen} label="Settings" icon={Settings} />
          <Item onClick={handleCreate} label="New Page" icon={PlusCircle} />
        </div>

        {/* Separator */}
        <div className="shrink-0 mx-3 border-t border-border/40" />

        {/* Scrollable Document List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-1 py-2 custom-scrollbar">
          <DocumentList />
        </div>

        {/* Fixed Footer - Does NOT scroll */}
        <div className="shrink-0 px-1 py-2 border-t border-border/40">
          <Item onClick={handleCreate} label="Add a Page" icon={Plus} />
          <Popover>
            <PopoverTrigger className="w-full">
              <Item label="Trash" icon={Trash} />
            </PopoverTrigger>
            <PopoverContent
              className="p-0 w-72"
              side={isMobile ? "bottom" : "right"}
            >
              <TrashBox />
            </PopoverContent>
          </Popover>
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={handleMouseDown}
          onClick={expand}
          className="opacity-0 group-hover/sidebar:opacity-100 transition cursor-ew-resize absolute h-full w-1 bg-primary/10 right-0 top-0"
        />
      </aside>
    </>
  );
};
