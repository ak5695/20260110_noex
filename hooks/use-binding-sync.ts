import { useState, useEffect, useCallback } from "react";
import { getDocumentBindings } from "@/actions/canvas-bindings";
import { bindingCache } from "@/lib/cache/binding-cache";
import { useBindingStore } from "@/store/use-binding-store";

/**
 * Sync bindings with cache-first strategy
 */
export function useBindingSync(documentId: string) {
    const [isLoading, setIsLoading] = useState(true);
    const setBindings = useBindingStore((state) => state.setBindings);
    const bindings = useBindingStore((state) => state.bindings);

    const loadBindings = useCallback(async () => {
        if (!documentId) return;

        console.log(`[BindingSync] Starting sync for: ${documentId}`);

        // 1. Instant Cache Load
        try {
            const cached = await bindingCache.get(documentId);
            if (cached) {
                console.log(`[BindingSync] Cache hit: ${cached.length} bindings`);
                setBindings(cached);
                setIsLoading(false); // Valid content shown
            }
        } catch (e) {
            console.warn("[BindingSync] Cache read error", e);
        }

        // 2. Network Fetch (Stale-while-revalidate)
        try {
            const result = await getDocumentBindings(documentId);
            if (result.success && result.bindings) {
                const serverBindings = result.bindings;

                // Update Store
                setBindings(serverBindings);

                // Update Cache
                await bindingCache.set(documentId, serverBindings);
                console.log(`[BindingSync] Synced from server: ${serverBindings.length} bindings`);
            }
        } catch (e) {
            console.error("[BindingSync] Server fetch error", e);
        } finally {
            setIsLoading(false);
        }
    }, [documentId, setBindings]);

    // Initial load
    useEffect(() => {
        loadBindings();
    }, [loadBindings]);

    // Listen for refresh events (e.g., after new binding created)
    useEffect(() => {
        const handleRefresh = () => loadBindings();
        window.addEventListener("refresh-bindings", handleRefresh);
        return () => window.removeEventListener("refresh-bindings", handleRefresh);
    }, [loadBindings]);

    return { isLoading, bindings };
}
