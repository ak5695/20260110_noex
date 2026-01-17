"use client";

import { authClient } from "@/lib/auth-client";
import { useEffect, useState } from "react";

const SESSION_CACHE_KEY = "jotion-session-cache";

export const useCachedSession = () => {
    // 1. Start with null to match Server-Side Rendering (avoids hydration mismatch)
    const [session, setSession] = useState<any>(null);
    // Track if we have read from cache yet - only use effect once
    const [isRestored, setIsRestored] = useState(false);
    // Track if we're in an OAuth callback (URL has auth params)
    const [isOAuthCallback, setIsOAuthCallback] = useState(false);

    // 2. Read from localStorage immediately on mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            // Check if we're in OAuth callback (Better Auth uses these params)
            const urlParams = new URLSearchParams(window.location.search);
            const hasAuthParams = urlParams.has("code") || urlParams.has("state") ||
                window.location.pathname.includes("/api/auth/callback");
            setIsOAuthCallback(hasAuthParams);

            const cached = localStorage.getItem(SESSION_CACHE_KEY);
            if (cached) {
                try {
                    setSession(JSON.parse(cached));
                } catch (e) {
                    console.error("Failed to parse cached session", e);
                }
            }
            setIsRestored(true);
        }
    }, []);

    // 3. Fetch real session in background
    const { data: serverSession, isPending: isServerLoading } = authClient.useSession();

    useEffect(() => {
        if (!isServerLoading) {
            // Server response received
            if (serverSession) {
                // Login valid: Update cache and state
                setSession(serverSession);
                localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(serverSession));
            } else {
                // Login invalid/logout: Clear cache and state
                setSession(null);
                localStorage.removeItem(SESSION_CACHE_KEY);
            }
        }
    }, [serverSession, isServerLoading]);

    return {
        data: session,
        // Loading logic:
        // 1. If NOT restored yet, we are pending
        // 2. If restored but server is still loading AND no cached session, we are pending
        // 3. If in OAuth callback, wait for server to confirm (don't redirect immediately)
        isPending: (!isRestored) ||
            (isServerLoading && !session) ||
            (isOAuthCallback && isServerLoading),
        isOptimistic: !!session && isServerLoading
    };
};

