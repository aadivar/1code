"use client"

import { useAtomValue } from "jotai"
import { forwardRef, memo, useLayoutEffect, useState } from "react"
import { Virtuoso, type FollowOutput, type VirtuosoHandle } from "react-virtuoso"
import { currentSubChatIdAtom, userMessageIdsPerChatAtom } from "../stores/message-store"
import { USE_VIRTUOSO_CHAT, VIRTUOSO_FOLLOW_BOTTOM_THRESHOLD_PX } from "./chat-render-flags"
import { IsolatedMessageGroup } from "./isolated-message-group"

// ============================================================================
// VIRTUOSO COMPONENTS (Module-level to prevent infinite re-renders)
// ============================================================================
// CRITICAL: These MUST be defined outside the component function.
// Defining forwardRef components inside a component (even with useMemo) causes
// react-virtuoso to see "new" component types on each render, triggering
// unmount/remount cycles that lead to "Maximum update depth exceeded" errors.
// See: https://virtuoso.dev/customize-structure/
// ============================================================================

type VirtuosoListProps = React.HTMLAttributes<HTMLDivElement> & {
  "transform-origin"?: string
}

const VirtuosoListComponent = forwardRef<HTMLDivElement, VirtuosoListProps>(
  function VirtuosoListComponent(rawProps, ref) {
    const {
      className,
      style,
      "transform-origin": _transformOrigin,
      ...props
    } = rawProps

    return (
      <div
        ref={ref}
        className={`flex flex-col w-full px-2 max-w-2xl mx-auto ${className ?? ""}`}
        style={{ paddingBottom: "16px", ...(style ?? {}) }}
        {...props}
      />
    )
  }
)

type VirtuosoItemProps = React.HTMLAttributes<HTMLDivElement> & {
  "transform-origin"?: string
  "data-index"?: number
  "data-known-size"?: number
  "data-item-index"?: number
}

const VirtuosoItemComponent = forwardRef<HTMLDivElement, VirtuosoItemProps>(
  function VirtuosoItemComponent(rawProps, ref) {
    const {
      className,
      "transform-origin": _transformOrigin,
      ...props
    } = rawProps

    return (
      <div
        ref={ref}
        className={`pb-4 ${className ?? ""}`}
        {...props}
      />
    )
  }
)

function VirtuosoFooterComponent() {
  return <div style={{ height: "32px" }} />
}

// Static components object - never changes, never causes re-renders
const VIRTUOSO_COMPONENTS = {
  List: VirtuosoListComponent,
  Item: VirtuosoItemComponent,
  Footer: VirtuosoFooterComponent,
}

// ============================================================================
// ISOLATED MESSAGES SECTION (LAYER 3)
// ============================================================================
// Renders ALL message groups by subscribing to userMessageIdsAtom.
// Only re-renders when a new user message is added (new conversation turn).
// Each group independently subscribes to its own data via IsolatedMessageGroup.
//
// During streaming:
// - This component does NOT re-render (userMessageIds don't change)
// - Individual groups don't re-render (their user msg + assistant IDs don't change)
// - Only the AssistantMessageItem for the streaming message re-renders
// ============================================================================

interface IsolatedMessagesSectionProps {
  subChatId: string
  chatId: string
  isMobile: boolean
  isSplitPane?: boolean
  followOutput?: FollowOutput
  sandboxSetupStatus: "cloning" | "ready" | "error"
  stickyTopClass: string
  sandboxSetupError?: string
  onRetrySetup?: () => void
  onRollback?: (msg: any) => void
  scrollParentRef?: React.RefObject<HTMLElement | null>
  virtuosoRef?: React.RefObject<VirtuosoHandle | null>
  // Components passed from parent - must be stable references
  UserBubbleComponent: React.ComponentType<{
    messageId: string
    textContent: string
    imageParts: any[]
    skipTextMentionBlocks?: boolean
  }>
  ToolCallComponent: React.ComponentType<{
    icon: any
    title: string
    isPending: boolean
    isError: boolean
  }>
  MessageGroupWrapper: React.ComponentType<{ children: React.ReactNode; isLastGroup?: boolean }>
  toolRegistry: Record<string, { icon: any; title: (args: any) => string }>
  onAtBottomStateChange?: (atBottom: boolean) => void
}

function areSectionPropsEqual(
  prev: IsolatedMessagesSectionProps,
  next: IsolatedMessagesSectionProps
): boolean {
  return (
    prev.subChatId === next.subChatId &&
    prev.chatId === next.chatId &&
    prev.isMobile === next.isMobile &&
    prev.isSplitPane === next.isSplitPane &&
    prev.followOutput === next.followOutput &&
    prev.sandboxSetupStatus === next.sandboxSetupStatus &&
    prev.stickyTopClass === next.stickyTopClass &&
    prev.sandboxSetupError === next.sandboxSetupError &&
    prev.onRetrySetup === next.onRetrySetup &&
    prev.onRollback === next.onRollback &&
    prev.scrollParentRef === next.scrollParentRef &&
    prev.virtuosoRef === next.virtuosoRef &&
    prev.UserBubbleComponent === next.UserBubbleComponent &&
    prev.ToolCallComponent === next.ToolCallComponent &&
    prev.MessageGroupWrapper === next.MessageGroupWrapper &&
    prev.toolRegistry === next.toolRegistry &&
    prev.onAtBottomStateChange === next.onAtBottomStateChange
  )
}

export const IsolatedMessagesSection = memo(function IsolatedMessagesSection({
  subChatId,
  chatId,
  isMobile,
  isSplitPane = false,
  followOutput,
  sandboxSetupStatus,
  stickyTopClass,
  sandboxSetupError,
  onRetrySetup,
  onRollback,
  scrollParentRef,
  virtuosoRef,
  UserBubbleComponent,
  ToolCallComponent,
  MessageGroupWrapper,
  toolRegistry,
  onAtBottomStateChange,
}: IsolatedMessagesSectionProps) {
  const useVirtuosoChat = USE_VIRTUOSO_CHAT

  // Global atoms reflect the currently synced sub-chat.
  // In split view, each pane must render its own sub-chat regardless of
  // currentSubChatIdAtom, so we bypass this guard for split panes.
  const currentSubChatId = useAtomValue(currentSubChatIdAtom)
  const rawUserMsgIds = useAtomValue(userMessageIdsPerChatAtom(subChatId))
  const isActiveChat = currentSubChatId === subChatId
  const shouldRenderForSubChat = isSplitPane || isActiveChat

  // Guard: in single-pane mode, feed an empty list until the active sub-chat
  // catches up, avoiding stale-message flashes during tab switches.
  const userMsgIds = shouldRenderForSubChat ? rawUserMsgIds : []

  // Preserve initial bottom positioning by mounting Virtuoso only once
  // data is available for this sub-chat.
  const hasVirtuosoData = userMsgIds.length > 0
  const shouldDelayVirtuosoMount = useVirtuosoChat && !hasVirtuosoData

  // Initialize from ref immediately — the scroll parent (chat container div) is
  // already in the DOM before this component mounts.  Avoids an extra render
  // cycle where Virtuoso would first create an internal scroller (null parent)
  // then switch to the external one, which is the most expensive part of init.
  const [scrollParentEl, setScrollParentEl] = useState<HTMLElement | null>(
    () => scrollParentRef?.current ?? null
  )
  useLayoutEffect(() => {
    const nextEl = scrollParentRef?.current ?? null
    setScrollParentEl((prev) => (nextEl && nextEl !== prev ? nextEl : prev))
  }, [scrollParentRef])

  if (!useVirtuosoChat) {
    // Non-Virtuoso path: guard against stale data from other sub-chats
    if (!shouldRenderForSubChat) return null
    return (
      <div
        className="flex flex-col w-full px-2 max-w-2xl mx-auto -mb-4"
        style={{ paddingBottom: "32px" }}
      >
        {rawUserMsgIds.map((userMsgId) => (
          <IsolatedMessageGroup
            key={userMsgId}
            userMsgId={userMsgId}
            subChatId={subChatId}
            chatId={chatId}
            isMobile={isMobile}
            sandboxSetupStatus={sandboxSetupStatus}
            stickyTopClass={stickyTopClass}
            sandboxSetupError={sandboxSetupError}
            onRetrySetup={onRetrySetup}
            onRollback={onRollback}
            UserBubbleComponent={UserBubbleComponent}
            ToolCallComponent={ToolCallComponent}
            MessageGroupWrapper={MessageGroupWrapper}
            toolRegistry={toolRegistry}
          />
        ))}
      </div>
    )
  }

  if (shouldDelayVirtuosoMount) {
    return <div style={{ height: "100%", width: "100%" }} />
  }

  return (
    <Virtuoso
      data={userMsgIds}
      computeItemKey={(_, userMsgId) => userMsgId}
      customScrollParent={scrollParentEl ?? undefined}
      followOutput={shouldRenderForSubChat ? followOutput : false}
      atBottomStateChange={onAtBottomStateChange}
      atBottomThreshold={VIRTUOSO_FOLLOW_BOTTOM_THRESHOLD_PX}
      initialTopMostItemIndex={
        userMsgIds.length > 0 ? { index: "LAST", align: "end" } : undefined
      }
      ref={virtuosoRef}
      style={{ height: "100%", width: "100%" }}
      increaseViewportBy={{ top: 300, bottom: 300 }}
      defaultItemHeight={38}
      components={VIRTUOSO_COMPONENTS}
      itemContent={(_, userMsgId) => (
        <IsolatedMessageGroup
          userMsgId={userMsgId}
          subChatId={subChatId}
          chatId={chatId}
          isMobile={isMobile}
          sandboxSetupStatus={sandboxSetupStatus}
          stickyTopClass={stickyTopClass}
          sandboxSetupError={sandboxSetupError}
          onRetrySetup={onRetrySetup}
          onRollback={onRollback}
          UserBubbleComponent={UserBubbleComponent}
          ToolCallComponent={ToolCallComponent}
          MessageGroupWrapper={MessageGroupWrapper}
          toolRegistry={toolRegistry}
        />
      )}
    />
  )
}, areSectionPropsEqual)
