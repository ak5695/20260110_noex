/**
 * Canvas Server Actions
 *
 * Handles canvas CRUD operations and canvas-document associations
 */

"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { canvases, canvasElements } from "@/db/canvas-schema";
import { eq, and } from "drizzle-orm";

/**
 * Get or create a canvas for a document
 * Each document has one associated canvas
 */
export async function getOrCreateCanvas(documentId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    // Check if canvas exists
    const existing = await db
      .select()
      .from(canvases)
      .where(eq(canvases.documentId, documentId))
      .limit(1);

    if (existing.length > 0) {
      // Load canvas elements
      const elements = await db
        .select()
        .from(canvasElements)
        .where(
          and(
            eq(canvasElements.canvasId, existing[0].id),
            eq(canvasElements.isDeleted, false)
          )
        );

      return {
        success: true,
        canvas: existing[0],
        elements: elements.map((el) => el.data),
      };
    }

    // Create new canvas
    const [newCanvas] = await db
      .insert(canvases)
      .values({
        documentId,
        userId,
        lastEditedBy: userId,
        name: "Canvas",
      })
      .returning();

    console.log("[getOrCreateCanvas] Canvas created:", newCanvas.id);

    return {
      success: true,
      canvas: newCanvas,
      elements: [],
    };
  } catch (error) {
    console.error("[getOrCreateCanvas] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get or create canvas",
    };
  }
}

/**
 * Update canvas viewport state
 */
export async function updateCanvasViewport(
  canvasId: string,
  viewport: {
    x: number;
    y: number;
    zoom: number;
  }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const [updated] = await db
      .update(canvases)
      .set({
        viewportX: viewport.x,
        viewportY: viewport.y,
        zoom: viewport.zoom,
        updatedAt: new Date(),
      })
      .where(eq(canvases.id, canvasId))
      .returning();

    return {
      success: true,
      canvas: updated,
    };
  } catch (error) {
    console.error("[updateCanvasViewport] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update viewport",
    };
  }
}
