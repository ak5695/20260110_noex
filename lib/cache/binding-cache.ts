/**
 * Binding Cache for Instant Loading
 * 
 * Stores bindings in IndexedDB for cache-first rendering
 */

const DB_NAME = "jotion-binding-cache";
const DB_VERSION = 1;
const STORE_NAME = "bindings";

interface CachedBindings {
    documentId: string;
    bindings: any[];
    timestamp: number;
}

class BindingCache {
    private db: IDBDatabase | null = null;
    private initPromise: Promise<void> | null = null;
    private memoryCache: Map<string, any[]> = new Map();

    async init(): Promise<void> {
        if (typeof window === "undefined") return;
        if (this.db) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                console.log("[BindingCache] Initialized");
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: "documentId" });
                }
            };
        });

        return this.initPromise;
    }

    async get(documentId: string): Promise<any[] | null> {
        // L1: Memory Cache
        if (this.memoryCache.has(documentId)) {
            console.log(`[BindingCache] Memory hit: ${documentId}`);
            return this.memoryCache.get(documentId)!;
        }

        await this.init();
        if (!this.db) return null;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(documentId);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const result = request.result as CachedBindings | undefined;
                if (result) {
                    this.memoryCache.set(documentId, result.bindings);
                    console.log(`[BindingCache] IndexedDB hit: ${documentId}, ${result.bindings.length} bindings`);
                    resolve(result.bindings);
                } else {
                    resolve(null);
                }
            };
        });
    }

    async set(documentId: string, bindings: any[]): Promise<void> {
        // L1: Memory Cache
        this.memoryCache.set(documentId, bindings);

        await this.init();
        if (!this.db) return;

        const entry: CachedBindings = {
            documentId,
            bindings,
            timestamp: Date.now(),
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(entry);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                console.log(`[BindingCache] Saved: ${documentId}, ${bindings.length} bindings`);
                resolve();
            };
        });
    }

    async clear(): Promise<void> {
        this.memoryCache.clear();
        await this.init();
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();
            request.onsuccess = () => resolve();
        });
    }
}

export const bindingCache = new BindingCache();

// Make available in browser console for debugging
if (typeof window !== "undefined") {
    (window as any).__BINDING_CACHE__ = bindingCache;
}
