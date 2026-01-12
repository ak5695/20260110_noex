"use client";

import { useParams } from "next/navigation";
import { getById } from "@/actions/documents";
import { Title } from "@/components/main/title";
import { Banner } from "@/components/main/banner";
import { Menu } from "@/components/main/menu";
import { Publish } from "@/components/main/publish";
import useSWR from "swr";

import { ChevronsLeft, ChevronsRight, MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface NavbarProps {
  isCanvasOpen?: boolean;
  onToggleCanvas?: () => void;
}

export const Navbar = ({ isCanvasOpen, onToggleCanvas }: NavbarProps) => {
  const params = useParams();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleSidebarChange = (event: any) => {
      setIsCollapsed(event.detail.isCollapsed);
    };

    window.addEventListener("jotion-sidebar-change", handleSidebarChange);
    return () => {
      window.removeEventListener("jotion-sidebar-change", handleSidebarChange);
    };
  }, []);

  const resetWidth = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("jotion-reset-sidebar"));
    }
  };

  const { data: document } = useSWR(
    params.documentId ? ["document", params.documentId] : null,
    ([, id]) => getById(id as string)
  );

  if (document === undefined) {
    return (
      <nav className="bg-background dark:bg-[#1F1F1F] px-3 py-2 w-full flex items-center justify-between">
        <Title.Skeleton />
        <div className="flex items-center gap-x-2">
          <Menu.Skeleton />
        </div>
      </nav>
    );
  }

  if (document === null) return null;

  return (
    <>
      <nav className="bg-background dark:bg-[#1F1F1F] px-3 py-2 w-full flex items-center gap-x-4">
        {isCollapsed && (
          <MenuIcon
            role="button"
            onClick={resetWidth}
            className="h-6 w-6 text-muted-foreground cursor-pointer hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded-sm"
          />
        )}
        <div className="flex items-center justify-between w-full">
          <Title initialData={document} />
          <div className="flex items-center gap-x-0">
            <Publish initialData={document} />
            <Menu documentId={document.id} />
            {onToggleCanvas && (
              <Button size="sm" variant="ghost" onClick={onToggleCanvas}>
                {isCanvasOpen ? (
                  <ChevronsRight className="h-4 w-4" />
                ) : (
                  <ChevronsLeft className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </nav>
      {document.isArchived && <Banner documentId={document.id} />}
    </>
  );
};
