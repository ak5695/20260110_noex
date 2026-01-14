/**
 * Dagre-based automatic layout for Excalidraw elements
 * 
 * Uses dagre for directed acyclic graph layout with support for:
 * - Hierarchical (top-to-bottom, left-to-right) layouts
 * - Automatic node spacing
 * - Edge routing
 * - Compound/nested graphs (frames containing children)
 */

import dagre from 'dagre'
import type { CompactElement } from './excalidraw-converter'

// Type mapping from compact to full
const TYPE_MAP: Record<string, string> = {
    'r': 'rectangle',
    'el': 'ellipse',
    'd': 'diamond',
    'a': 'arrow',
    'tx': 'text',
    'ln': 'line',
    'fr': 'frame',
    'rectangle': 'rectangle',
    'ellipse': 'ellipse',
    'diamond': 'diamond',
    'arrow': 'arrow',
    'text': 'text',
    'line': 'line',
    'frame': 'frame',
}

/**
 * Calculate text width based on character count
 */
function calculateTextWidth(text: string): number {
    if (!text) return 100
    
    let width = 0
    for (const char of text) {
        if (/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(char)) {
            width += 18  // CJK characters
        } else {
            width += 10  // Latin characters
        }
    }
    
    // Add padding for Excalidraw's internal text padding (~12px each side)
    return Math.max(100, width + 24)
}

/**
 * Calculate node height based on text and container width
 * 
 * @param text - The text content
 * @param containerWidth - The container width (already calculated)
 * @returns Estimated height that fits all wrapped lines
 */
function calculateNodeHeight(text: string, containerWidth: number): number {
    if (!text) return 50
    
    // Excalidraw internal padding reduces available width for text
    const INTERNAL_PADDING = 24 // ~12px each side
    const availableWidth = Math.max(50, containerWidth - INTERNAL_PADDING)
    
    // Calculate text width and detect CJK content
    let textWidth = 0
    let hasCJK = false
    for (const char of text) {
        if (/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(char)) {
            textWidth += 18  // CJK char width
            hasCJK = true
        } else {
            textWidth += 10
        }
    }
    
    // Estimate line count based on wrapping
    const lineCount = Math.max(1, Math.ceil(textWidth / availableWidth))
    
    // Standard values with small CJK adjustment
    const LINE_HEIGHT = 32  // Reduced from 40
    const VERTICAL_PADDING = hasCJK ? 35 : 30  // Small extra for CJK
    
    return VERTICAL_PADDING + lineCount * LINE_HEIGHT
}

/**
 * Resolve overlapping sibling frames by shifting them horizontally
 * Also align their tops for a cleaner look
 */
function resolveFrameOverlaps(
    siblingFrames: CompactElement[],
    elementsById: Map<string, CompactElement>,
    childToParent: Map<string, string>
): void {
    if (siblingFrames.length < 2) return
    
    // Sort by x position
    siblingFrames.sort((a, b) => (a.x ?? 0) - (b.x ?? 0))
    
    const GAP = 40 // Minimum gap between sibling frames
    
    // Step 1: Resolve horizontal overlaps
    for (let i = 1; i < siblingFrames.length; i++) {
        const prev = siblingFrames[i - 1]
        const curr = siblingFrames[i]
        
        const prevRight = (prev.x ?? 0) + (prev.w ?? 0)
        const currLeft = curr.x ?? 0
        
        // Check if overlapping or too close
        if (currLeft < prevRight + GAP) {
            const shift = prevRight + GAP - currLeft
            
            // Shift current frame and all its descendants
            shiftElementAndDescendants(curr, shift, 0, elementsById)
        }
    }
    
    // Step 2: Align tops of sibling frames
    // Only align if they are roughly on the same vertical level (same rank)
    // If dy is large, it means they are on different ranks, so don't force align
    const ALIGN_THRESHOLD = 150 
    
    // Find the minimum Y (topmost) among siblings
    const minY = Math.min(...siblingFrames.map(f => f.y ?? 0))
    
    for (const frame of siblingFrames) {
        const currentY = frame.y ?? 0
        if (currentY > minY) {
            const dy = minY - currentY
            
            // Only align if the vertical difference is small enough (likely same rank)
            if (Math.abs(dy) < ALIGN_THRESHOLD) {
                // Shift frame and descendants to align top
                shiftElementAndDescendants(frame, 0, dy, elementsById)
            }
        }
}
}

/**
 * Reflow children of wide frames into a grid to prevent extreme aspect ratios
 */
function reflowFrameChildren(
    elements: CompactElement[],
    elementsById: Map<string, CompactElement>
): void {
    const frames = elements.filter(el => el.t === 'f')
    
    for (const frame of frames) {
        if (!frame.ch || frame.ch.length < 4) continue
        
        // collect children
        const children = frame.ch
             .map(id => elementsById.get(id))
             .filter((e): e is CompactElement => !!e && e.t !== 'a') // skip arrows
             
        if (children.length === 0) continue
        
        // Calculate current aspect ratio
        const minX = Math.min(...children.map(c => c.x ?? 0))
        const maxX = Math.max(...children.map(c => (c.x ?? 0) + (c.w ?? 0)))
        const width = maxX - minX
        
        // Heuristic: If we have many children (size > 3) and it's essentially a single row
        // try to make it a square-ish grid
        const isSingleRow = children.every(c => Math.abs((c.y ?? 0) - (children[0].y ?? 0)) < 100)
        
        if (isSingleRow && children.length > 3) {
            // Target columns = sqrt(count) * 1.5 (prefer slightly landscape)
            const targetCols = Math.ceil(Math.sqrt(children.length) * 1.5)
            
            reflowToGrid(children, targetCols, frame, elementsById)
        }
    }
}

/**
 * Reflow a list of elements into a grid layout
 */
function reflowToGrid(
    children: CompactElement[],
    columns: number,
    parentFrame: CompactElement,
    elementsById: Map<string, CompactElement>
): void {
    // Sort children by original X to maintain relative order
    children.sort((a, b) => (a.x ?? 0) - (b.x ?? 0))

    const GAP_X = 60
    const GAP_Y = 60
    
    let currentX = 0
    let currentY = 0
    let rowHeight = 0
    let colIndex = 0
    
    // Calculate starting position (use top-left of the first child)
    const startX = children[0].x ?? 0
    const startY = children[0].y ?? 0
    
    // First pass: Calculate positions relative to (0,0)
    const newPositions: {id: string, x: number, y: number}[] = []
    
    for (const child of children) {
        newPositions.push({
            id: child.i,
            x: currentX,
            y: currentY
        })
        
        rowHeight = Math.max(rowHeight, child.h ?? 0)
        currentX += (child.w ?? 0) + GAP_X
        colIndex++
        
        if (colIndex >= columns) {
            colIndex = 0
            currentX = 0
            currentY += rowHeight + GAP_Y
            rowHeight = 0
        }
    }
    
    // Apply new positions
    for (const pos of newPositions) {
        const child = elementsById.get(pos.id)
        if (child) {
            // Apply absolute position based on start
            const newAbsX = startX + pos.x
            const newAbsY = startY + pos.y
            
            // Move child and its sub-elements (if it's a nested frame?)
            // For now assuming these are leaf nodes. If nested frame, complex shift needed.
            // Simple approach: direct set for leaf nodes
            if (child.t !== 'f') {
                 child.x = newAbsX
                 child.y = newAbsY
            } else {
                 // For nested frames, we need delta shift
                 const dx = newAbsX - (child.x ?? 0)
                 const dy = newAbsY - (child.y ?? 0)
                 shiftElementAndDescendants(child, dx, dy, elementsById)
            }
        }
    }
    
    // Note: Parent frame boundary will be recalculated by the main loop's second pass
}
function shiftElementAndDescendants(
    el: CompactElement,
    dx: number,
    dy: number,
    elementsById: Map<string, CompactElement>
): void {
    el.x = (el.x ?? 0) + dx
    el.y = (el.y ?? 0) + dy
    
    if (el.ch) {
        for (const childId of el.ch) {
            const child = elementsById.get(childId)
            if (child) {
                shiftElementAndDescendants(child, dx, dy, elementsById)
            }
        }
    }
}

interface LayoutConfig {
    rankdir: 'TB' | 'LR' | 'BT' | 'RL'
    ranksep: number  // Vertical gap between levels
    nodesep: number  // Horizontal gap between nodes
    marginx: number  // Graph margin
    marginy: number  // Graph margin
}

const DEFAULT_CONFIG: LayoutConfig = {
    rankdir: 'TB',    // Top to bottom
    ranksep: 120,     // Increased from 80 to 120 for better vertical separation
    nodesep: 60,      // Increased from 50 to 60 for better horizontal spacing
    marginx: 50,
    marginy: 50,
}

/**
 * Layout elements using Dagre algorithm
 */
export function layoutWithDagre(
    elements: CompactElement[],
    config: Partial<LayoutConfig> = {}
): CompactElement[] {
    const cfg = { ...DEFAULT_CONFIG, ...config }
    
    // Quick check: if most elements have coordinates, skip auto-layout
    const elementsWithCoords = elements.filter(el => 
        el.x !== undefined && el.y !== undefined && el.t !== 'a'
    )
    const nonArrowElements = elements.filter(el => el.t !== 'a')
    
    if (nonArrowElements.length > 0 && elementsWithCoords.length > nonArrowElements.length * 0.5) {
        console.log('[Dagre] Skipping - elements already have coordinates (V1 format)')
        return elements
    }
    
    console.log(`[Dagre] Layout start: ${elements.length} elements`)
    
    // Create dagre graph - disable compound mode to avoid setParent errors
    const g = new dagre.graphlib.Graph()
    g.setGraph({
        rankdir: cfg.rankdir,
        ranksep: cfg.ranksep,
        nodesep: cfg.nodesep,
        marginx: cfg.marginx,
        marginy: cfg.marginy,
    })
    g.setDefaultEdgeLabel(() => ({}))
    
    // Index elements
    const elementsById = new Map<string, CompactElement>()
    const childToParent = new Map<string, string>()
    
    for (const el of elements) {
        elementsById.set(el.i, el)
        
        // Build child-parent relationships from ch property (for frame sizing later)
        if (el.ch) {
            for (const childId of el.ch) {
                childToParent.set(childId, el.i)
            }
        }
    }
    
    // First pass: Add all non-arrow, non-frame elements as nodes
    for (const el of elements) {
        const type = TYPE_MAP[el.t] || el.t
        if (type === 'arrow') continue
        if (type === 'frame') continue // Frames are positioned based on children later
        
        // Calculate size based on text
        const width = el.w || calculateTextWidth(el.l || '')
        const height = el.h || calculateNodeHeight(el.l || '', width)
        
        g.setNode(el.i, { width, height, label: el.l || '' })
    }
    
    // Skip setParent - we'll calculate frame bounds after layout instead
    
    // Second pass: Add edges from arrows
    for (const el of elements) {
        const type = TYPE_MAP[el.t] || el.t
        if (type !== 'arrow') continue
        
        if (el.si && el.ei && g.hasNode(el.si) && g.hasNode(el.ei)) {
            g.setEdge(el.si, el.ei, { label: el.l || '' })
        }
    }
    
    // Also infer edges from element order if no arrows
    const arrows = elements.filter(el => (TYPE_MAP[el.t] || el.t) === 'arrow')
    if (arrows.length === 0) {
        // No explicit arrows - create edges based on element order
        const rootElements = elements.filter(el => 
            !childToParent.has(el.i) && (TYPE_MAP[el.t] || el.t) !== 'arrow'
        )
        
        for (let i = 0; i < rootElements.length - 1; i++) {
            const current = rootElements[i]
            const next = rootElements[i + 1]
            
            // Don't auto-connect frames to their siblings
            if ((TYPE_MAP[current.t] || current.t) !== 'frame' && 
                (TYPE_MAP[next.t] || next.t) !== 'frame') {
                // Only add edge if both nodes exist in graph
                if (g.hasNode(current.i) && g.hasNode(next.i)) {
                    g.setEdge(current.i, next.i)
                }
            }
        }
    }
    
    try {
        // Validate graph before layout - prevent crash on empty/invalid graphs
        const nodeCount = g.nodeCount()
        const edgeCount = g.edgeCount()
        
        if (nodeCount === 0) {
            console.log('[Dagre] Skipping layout - no nodes')
            return elements
        }
        
        // Diagnostic: Log graph stats in one line
        console.log(`[Dagre] Graph: ${nodeCount} nodes, ${edgeCount} edges`)
        
        // Run dagre layout
        dagre.layout(g)
        
        // Diagnostic: Check first few node positions
        const allNodes = g.nodes()
        if (allNodes.length > 0) {
            const sample = allNodes.slice(0, 3).map(id => {
                const n = g.node(id)
                return `${id}:(${Math.round(n?.x || 0)},${Math.round(n?.y || 0)})`
            })
            console.log(`[Dagre] Sample positions: ${sample.join(', ')}`)
        }
        
        // Apply calculated positions to elements
        let positioned = 0
        for (const el of elements) {
            const type = TYPE_MAP[el.t] || el.t
            if (type === 'arrow') continue
            if (type === 'frame') continue // Frames are handled separately
            
            const node = g.node(el.i)
            if (node) {
                // Dagre gives center coordinates, convert to top-left
                el.x = Math.round(node.x - node.width / 2)
                el.y = Math.round(node.y - node.height / 2)
                el.w = Math.round(node.width)
                el.h = Math.round(node.height)
                positioned++
            }
        }
        
        // Handle frames: ensure they contain all children with UNIFORM padding
        // Process frames from innermost to outermost (sort by depth)
        const frames = elements.filter(el => (TYPE_MAP[el.t] || el.t) === 'frame' && el.ch && el.ch.length > 0)
        
        // Calculate depth for each frame (how many parent frames it has)
        const getFrameDepth = (frameId: string, visited = new Set<string>()): number => {
            if (visited.has(frameId)) return 0
            visited.add(frameId)
            for (const f of frames) {
                if (f.ch?.includes(frameId)) {
                    return 1 + getFrameDepth(f.i, visited)
                }
            }
            return 0
        }
        
        // Sort frames by depth (deepest first)
        frames.sort((a, b) => getFrameDepth(b.i) - getFrameDepth(a.i))
        
        for (const el of frames) {
            // Recursively collect ALL descendants (including nested frame contents)
            const collectDescendants = (ids: string[]): CompactElement[] => {
                const result: CompactElement[] = []
                for (const id of ids) {
                    const child = elementsById.get(id)
                    if (!child) continue
                    
                    const childType = TYPE_MAP[child.t] || child.t
                    if (childType === 'frame' && child.ch && child.ch.length > 0) {
                        // For nested frames, use the frame's bounds (already calculated)
                        result.push(child)
                    } else if (childType !== 'arrow') {
                        result.push(child)
                    }
                }
                return result
            }
            
            const descendants = collectDescendants(el.ch || [])
            if (descendants.length === 0) continue
            
            // Calculate bounding box
            const PADDING = 50 // Increased for more spacing from external elements
            const TITLE_OFFSET = 30 // Space for frame label above
            
            const minX = Math.min(...descendants.map(c => c.x ?? 0)) - PADDING
            const maxX = Math.max(...descendants.map(c => (c.x ?? 0) + (c.w ?? 120))) + PADDING
            const minY = Math.min(...descendants.map(c => c.y ?? 0)) - PADDING - TITLE_OFFSET
            const maxY = Math.max(...descendants.map(c => (c.y ?? 0) + (c.h ?? 60))) + PADDING
            
            el.x = minX
            el.y = minY
            el.w = maxX - minX
            el.h = maxY - minY
        }
        
        // NEW STEP: Reflow wide frames internally before resolving sibling overlaps
        // This prevents frames from being super wide single rows
        reflowFrameChildren(elements, elementsById)
        
        // Recalculate frame boundaries after reflow (important!)
        for (const el of frames) {
            const collectDescendants = (ids: string[]): CompactElement[] => {
                const result: CompactElement[] = []
                for (const id of ids) {
                    const child = elementsById.get(id)
                    if (!child) continue
                    
                    const childType = TYPE_MAP[child.t] || child.t
                    if (childType === 'frame' && child.ch && child.ch.length > 0) {
                        result.push(child)
                    } else if (childType !== 'arrow') {
                        result.push(child)
                    }
                }
                return result
            }
            const descendants = collectDescendants(el.ch || [])
            if (descendants.length === 0) continue
            const PADDING = 50 
            const TITLE_OFFSET = 30
            const minX = Math.min(...descendants.map(c => c.x ?? 0)) - PADDING
            const maxX = Math.max(...descendants.map(c => (c.x ?? 0) + (c.w ?? 120))) + PADDING
            const minY = Math.min(...descendants.map(c => c.y ?? 0)) - PADDING - TITLE_OFFSET
            const maxY = Math.max(...descendants.map(c => (c.y ?? 0) + (c.h ?? 60))) + PADDING
            el.x = minX; el.y = minY; el.w = maxX - minX; el.h = maxY - minY;
        }

        // Resolve overlapping sibling frames
        // Find frames that share the same parent (or are all top-level)
        const topLevelFrames = frames.filter(f => !childToParent.has(f.i))
        resolveFrameOverlaps(topLevelFrames, elementsById, childToParent)
        
        // Also resolve overlaps within each parent frame
        for (const parentFrame of frames) {
            if (!parentFrame.ch) continue
            const childFrames = parentFrame.ch
                .map(id => elementsById.get(id))
                .filter(el => el && (TYPE_MAP[el.t] || el.t) === 'frame') as CompactElement[]
            if (childFrames.length > 1) {
                resolveFrameOverlaps(childFrames, elementsById, childToParent)
            }
        }
        
        // After overlap resolution, recalculate outer frame boundaries
        // Process from innermost to outermost again
        for (const el of frames) {
            const collectDescendants = (ids: string[]): CompactElement[] => {
                const result: CompactElement[] = []
                for (const id of ids) {
                    const child = elementsById.get(id)
                    if (!child) continue
                    
                    const childType = TYPE_MAP[child.t] || child.t
                    if (childType === 'frame' && child.ch && child.ch.length > 0) {
                        result.push(child)
                    } else if (childType !== 'arrow') {
                        result.push(child)
                    }
                }
                return result
            }
            
            const descendants = collectDescendants(el.ch || [])
            if (descendants.length === 0) continue
            
            const PADDING = 50 // Increased for more spacing from external elements
            const TITLE_OFFSET = 30
            
            const minX = Math.min(...descendants.map(c => c.x ?? 0)) - PADDING
            const maxX = Math.max(...descendants.map(c => (c.x ?? 0) + (c.w ?? 120))) + PADDING
            const minY = Math.min(...descendants.map(c => c.y ?? 0)) - PADDING - TITLE_OFFSET
            const maxY = Math.max(...descendants.map(c => (c.y ?? 0) + (c.h ?? 60))) + PADDING
            
            el.x = minX
            el.y = minY
            el.w = maxX - minX
            el.h = maxY - minY
        }
        
        console.log(`[Dagre] Layout complete, positioned ${positioned}/${nonArrowElements.length} elements`)
    } catch (err) {
        // Silently ignore known streaming errors (incomplete graph data)
        const errMsg = err instanceof Error ? err.message : String(err)
        if (errMsg.includes('weight') || errMsg.includes('rank') || errMsg.includes('undefined')) {
            // Expected during streaming - don't log
        } else {
            console.warn(`[Dagre] Layout skipped: ${errMsg}`)
        }
    }
    
    return elements
}

/**
 * Alias for backward compatibility
 */
export const autoLayoutElements = layoutWithDagre
