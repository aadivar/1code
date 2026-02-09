"use client"

import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { getDefaultRatios } from "../atoms"
import { useAgentSubChatStore } from "../stores/sub-chat-store"
import { cn } from "../../../lib/utils"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../../../components/ui/context-menu"

const MIN_PANE_WIDTH = 350

interface SplitViewContainerProps {
  panes: Array<{ id: string; content: React.ReactNode }>
  hiddenTabs?: React.ReactNode
  onCloseSplit: () => void
}

export function SplitViewContainer({
  panes,
  hiddenTabs,
  onCloseSplit,
}: SplitViewContainerProps) {
  const splitRatios = useAgentSubChatStore((s) => s.splitRatios)
  const setSplitRatios = useAgentSubChatStore((s) => s.setSplitRatios)
  const [localRatios, setLocalRatios] = useState<number[] | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const ratiosRef = useRef(splitRatios)
  ratiosRef.current = splitRatios

  // Use local ratios during drag, else persisted. Auto-fix if length mismatch.
  const currentRatios = (() => {
    if (localRatios && localRatios.length === panes.length) return localRatios
    if (splitRatios.length === panes.length) return splitRatios
    return getDefaultRatios(panes.length)
  })()

  // When pane count changes, reset ratios if they don't match
  useEffect(() => {
    if (splitRatios.length !== panes.length && panes.length >= 2) {
      setSplitRatios(getDefaultRatios(panes.length))
    }
  }, [panes.length, splitRatios.length, setSplitRatios])

  return (
    <div ref={containerRef} className="flex h-full w-full relative">
      {panes.map((pane, i) => (
        <Fragment key={pane.id}>
          {/* Pane */}
          <div
            style={{ width: `${currentRatios[i] * 100}%` }}
            className="h-full overflow-hidden relative flex flex-col"
          >
            {pane.content}
          </div>

          {/* Divider between pane i and pane i+1 */}
          {i < panes.length - 1 && (
            <SplitDivider
              index={i}
              containerRef={containerRef}
              ratiosRef={ratiosRef}
              paneCount={panes.length}
              onLocalRatiosChange={setLocalRatios}
              onCommitRatios={setSplitRatios}
              onCloseSplit={onCloseSplit}
            />
          )}
        </Fragment>
      ))}

      {/* Hidden keep-alive tabs */}
      {hiddenTabs}
    </div>
  )
}

// --- Divider sub-component ---

interface SplitDividerProps {
  index: number
  containerRef: React.RefObject<HTMLDivElement | null>
  ratiosRef: React.RefObject<number[]>
  paneCount: number
  onLocalRatiosChange: (ratios: number[] | null) => void
  onCommitRatios: (ratios: number[]) => void
  onCloseSplit: () => void
}

function SplitDivider({
  index,
  containerRef,
  ratiosRef,
  paneCount,
  onLocalRatiosChange,
  onCommitRatios,
  onCloseSplit,
}: SplitDividerProps) {
  const [isResizing, setIsResizing] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current)
        tooltipTimeoutRef.current = null
      }
      // Cleanup any in-progress drag on unmount
      if (abortRef.current) {
        abortRef.current.abort()
        abortRef.current = null
      }
    }
  }, [])

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()

      const container = containerRef.current
      if (!container) return

      const startX = event.clientX
      const startRatios = [...ratiosRef.current]
      const containerWidth = container.getBoundingClientRect().width
      const pointerId = event.pointerId
      const target = event.currentTarget

      target.setPointerCapture(pointerId)

      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current)
        tooltipTimeoutRef.current = null
      }
      setIsResizing(true)
      setIsHovering(false)
      setTooltipPos(null)

      // Abort any previous drag session
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const { signal } = controller

      let hasMoved = false
      let finalRatios = startRatios

      const minRatio = MIN_PANE_WIDTH / containerWidth
      // Combined width of the two adjacent panes stays constant
      const combined = startRatios[index] + startRatios[index + 1]

      const onMove = (e: PointerEvent) => {
        const deltaX = e.clientX - startX
        if (!hasMoved && Math.abs(deltaX) < 3) return
        hasMoved = true

        const deltaRatio = deltaX / containerWidth
        let newLeft = startRatios[index] + deltaRatio
        let newRight = combined - newLeft

        // Clamp both panes to minimum
        if (newLeft < minRatio) { newLeft = minRatio; newRight = combined - minRatio }
        if (newRight < minRatio) { newRight = minRatio; newLeft = combined - minRatio }

        const newRatios = [...startRatios]
        newRatios[index] = newLeft
        newRatios[index + 1] = newRight
        finalRatios = newRatios
        onLocalRatiosChange(newRatios)
      }

      const finish = () => {
        controller.abort()
        if (target.hasPointerCapture(pointerId)) {
          target.releasePointerCapture(pointerId)
        }
        setIsResizing(false)

        if (!hasMoved) {
          onLocalRatiosChange(null)
          // With >2 panes, click removes the right-side pane; with 2 panes, close all
          if (paneCount <= 2) {
            onCloseSplit()
          } else {
            const store = useAgentSubChatStore.getState()
            const rightPaneId = store.splitPaneIds[index + 1]
            if (rightPaneId) store.removeFromSplit(rightPaneId)
          }
        } else {
          onCommitRatios(finalRatios)
          onLocalRatiosChange(null)
        }
      }

      document.addEventListener("pointermove", onMove, { signal })
      document.addEventListener("pointerup", finish, { once: true, signal })
      document.addEventListener("pointercancel", finish, { once: true, signal })
    },
    [index, containerRef, ratiosRef, paneCount, onLocalRatiosChange, onCommitRatios, onCloseSplit],
  )

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      if (isResizing) return
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current)
      const y = e.clientY
      tooltipTimeoutRef.current = setTimeout(() => {
        if (handleRef.current) {
          const rect = handleRef.current.getBoundingClientRect()
          setTooltipPos({ x: rect.right + 8, y })
        }
        setIsHovering(true)
      }, 300)
    },
    [isResizing],
  )

  const handleMouseLeave = useCallback(() => {
    if (isResizing) return
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current)
      tooltipTimeoutRef.current = null
    }
    setIsHovering(false)
    setTooltipPos(null)
  }, [isResizing])

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={handleRef}
            className="relative flex-shrink-0 z-10"
            style={{ width: "1px", touchAction: "none" }}
          >
            {/* Visible 1px border */}
            <div
              className={cn(
                "absolute inset-0 transition-colors duration-100",
                "bg-border",
              )}
            />

            {/* Hit area */}
            <div
              className="absolute top-0 bottom-0 cursor-col-resize"
              style={{ left: "-4px", width: "9px" }}
              onPointerDown={handlePointerDown}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-40">
          <ContextMenuItem onClick={onCloseSplit}>
            Separate Chats
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Tooltip */}
      {isHovering &&
        !isResizing &&
        tooltipPos &&
        createPortal(
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y}px`,
              transform: "translateY(-50%)",
            }}
          >
            <div className="rounded-md border border-border bg-popover px-2 py-1 flex flex-col items-start gap-0.5 text-xs text-popover-foreground shadow-lg">
              <div className="flex items-center gap-1">
                <span>Separate</span>
                <span className="text-muted-foreground">Click</span>
              </div>
              <div className="flex items-center gap-1">
                <span>Resize</span>
                <span className="text-muted-foreground">Drag</span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
