"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { getSearch } from "@/actions/documents";
import { useSearch } from "@/hooks/use-search";
import { useEffect, useState, useMemo } from "react";
import useSWR from "swr";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { File, FileText } from "lucide-react";

// Helper to extract plain text from BlockNote JSON content
const extractTextFromContent = (content: string | null): string => {
  if (!content) return "";
  try {
    const blocks = JSON.parse(content);
    if (!Array.isArray(blocks)) return "";

    const extractFromBlock = (block: any): string => {
      let text = "";

      // Extract from block content
      if (block.content && Array.isArray(block.content)) {
        text += block.content.map((item: any) => item.text || "").join(" ");
      }

      // Extract from props (for page blocks, etc.)
      if (block.props?.title) {
        text += " " + block.props.title;
      }

      // Recursively extract from children
      if (block.children && Array.isArray(block.children)) {
        text += " " + block.children.map(extractFromBlock).join(" ");
      }

      return text;
    };

    return blocks.map(extractFromBlock).join(" ").substring(0, 500); // Limit preview length
  } catch (e) {
    return "";
  }
};

export const SearchCommand = () => {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const { data: documents, isLoading } = useSWR("search", getSearch);
  const [isMounted, setIsMounted] = useState(false);
  const [query, setQuery] = useState("");

  const toggle = useSearch((store) => store.toggle);
  const isOpen = useSearch((store) => store.isOpen);
  const onClose = useSearch((store) => store.onClose);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Debugging
  useEffect(() => {
    if (isOpen) {
      console.log("[Search] Open. Session:", session?.user?.email);
      console.log("[Search] Documents:", documents?.length);
      console.log("[Search] IsLoading:", isLoading);
    }
  }, [isOpen, session, documents, isLoading]);

  // Reset query when dialog closes
  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [toggle]);

  // 1. All hooks (useState, useEffect, useMemo, etc.) MUST be called unconditionally
  const filteredDocuments = useMemo(() => {
    if (!documents) return [];
    if (!query.trim()) return documents.map(doc => ({ ...doc, matchType: "title" as const, contentSnippet: "" }));

    const searchTerm = query.toLowerCase().trim();

    const results: Array<typeof documents[0] & { matchType: "title" | "content"; contentSnippet: string }> = [];

    for (const doc of documents) {
      const title = (doc.title || "").toLowerCase();
      const contentText = extractTextFromContent(doc.content).toLowerCase();

      const titleMatch = title.includes(searchTerm);
      const contentMatch = contentText.includes(searchTerm);

      if (!titleMatch && !contentMatch) continue;

      // Find content snippet if matched in content
      let contentSnippet = "";
      if (contentMatch && !titleMatch) {
        const index = contentText.indexOf(searchTerm);
        const start = Math.max(0, index - 30);
        const end = Math.min(contentText.length, index + searchTerm.length + 50);
        contentSnippet = "..." + contentText.substring(start, end).trim() + "...";
      }

      results.push({
        ...doc,
        matchType: titleMatch ? "title" : "content",
        contentSnippet,
      });
    }

    return results;
  }, [documents, query]);

  const onSelect = (id: string) => {
    router.push(`/documents/${id}`);
    onClose();
  };

  // 2. Early return for hydration safety MUST be after ALL hooks
  if (!isMounted) return null;

  const placeholderText = session?.user?.name
    ? `Search ${session.user.name}'s Rhizo...`
    : "Search documents...";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="overflow-hidden p-0 shadow-lg gap-0 max-w-[650px]">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          <CommandInput
            placeholder={placeholderText}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isLoading && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading documents...
              </div>
            )}
            {!isLoading && filteredDocuments.length === 0 && (
              <CommandEmpty>No results found.</CommandEmpty>
            )}
            <CommandGroup heading="Documents">
              {filteredDocuments.map((document) => (
                <CommandItem
                  key={document.id}
                  value={`${document.id}-${document.title}`}
                  title={document.title}
                  onSelect={() => onSelect(document.id)}
                  className="flex flex-col items-start py-2 cursor-pointer aria-selected:bg-primary/5"
                >
                  <div className="flex items-center w-full">
                    {document.icon ? (
                      <p className="mr-2 text-[16px]">{document.icon}</p>
                    ) : document.matchType === "content" ? (
                      <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                    ) : (
                      <File className="mr-2 h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium truncate">{document.title}</span>
                  </div>
                  {document.contentSnippet && (
                    <p className="text-xs text-muted-foreground mt-1 ml-6 line-clamp-1 break-all">
                      {document.contentSnippet}
                    </p>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
};
