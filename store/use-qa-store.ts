import { create } from "zustand";
import { persist } from "zustand/middleware";

export type QuestionType = "what" | "why" | "how" | "custom";
export type QuestionStatus = "unasked" | "asked";

export interface QuestionItem {
    id: string;
    text: string;
    type?: QuestionType;
    status: QuestionStatus;
    answer?: string;
    createdAt: number;
}

interface QaStore {
    items: QuestionItem[];
    addItem: (text: string) => void;
    updateItem: (id: string, updates: Partial<QuestionItem>) => void;
    removeItem: (id: string) => void;
    markAsAsked: (id: string) => void;
    markAsUnasked: (id: string) => void;
}

export const useQaStore = create<QaStore>()(
    persist(
        (set) => ({
            items: [],
            addItem: (text: string) =>
                set((state) => ({
                    items: [
                        ...state.items,
                        {
                            id: Date.now().toString(),
                            text,
                            status: "unasked",
                            createdAt: Date.now(),
                        },
                    ],
                })),
            updateItem: (id, updates) =>
                set((state) => ({
                    items: state.items.map((item) =>
                        item.id === id ? { ...item, ...updates } : item
                    ),
                })),
            removeItem: (id) =>
                set((state) => ({
                    items: state.items.filter((item) => item.id !== id),
                })),
            markAsAsked: (id) =>
                set((state) => ({
                    items: state.items.map((item) =>
                        item.id === id ? { ...item, status: "asked" } : item
                    ),
                })),
            markAsUnasked: (id) =>
                set((state) => ({
                    items: state.items.map((item) =>
                        item.id === id ? { ...item, status: "unasked" } : item
                    ),
                })),
        }),
        {
            name: "qa-storage",
        }
    )
);
