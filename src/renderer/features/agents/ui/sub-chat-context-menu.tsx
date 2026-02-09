import React, { useMemo, useCallback } from "react"
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "../../../components/ui/context-menu"
import { Kbd } from "../../../components/ui/kbd"
import { isMac } from "../../../lib/utils"
import { isDesktopApp } from "../../../lib/utils/platform"
import type { SubChatMeta } from "../stores/sub-chat-store"
import { useResolvedHotkeyDisplay } from "../../../lib/hotkeys"
import { exportChat, copyChat, type ExportFormat } from "../lib/export-chat"

const openInNewWindow = (chatId: string, subChatId: string, splitPaneIds?: string[]) => {
  window.desktopApi?.newWindow({ chatId, subChatId, splitPaneIds })
}

// Platform-aware keyboard shortcut for close tab
// Uses custom hotkey from settings if configured
const useCloseTabShortcut = () => {
  const archiveAgentHotkey = useResolvedHotkeyDisplay("archive-agent")
  return useMemo(() => {
    if (!isMac) return "Alt+Ctrl+W"
    return archiveAgentHotkey || "⌘W"
  }, [archiveAgentHotkey])
}

interface SubChatContextMenuProps {
  subChat: SubChatMeta
  isPinned: boolean
  onTogglePin: (subChatId: string) => void
  onRename: (subChat: SubChatMeta) => void
  onArchive: (subChatId: string) => void
  onArchiveOthers: (subChatId: string) => void
  onArchiveAllBelow?: (subChatId: string) => void
  isOnlyChat: boolean
  currentIndex?: number
  totalCount?: number
  showCloseTabOptions?: boolean
  onCloseTab?: (subChatId: string) => void
  onCloseOtherTabs?: (subChatId: string) => void
  onCloseTabsToRight?: (subChatId: string, visualIndex: number) => void
  visualIndex?: number
  hasTabsToRight?: boolean
  canCloseOtherTabs?: boolean
  /** Parent chat ID for export functionality */
  chatId?: string | null
  /** Open this sub-chat in split view */
  onOpenInSplit?: (subChatId: string) => void
  /** Close the current split view */
  onCloseSplit?: () => void
  /** Whether this tab is the currently active (left pane) tab */
  isActiveTab?: boolean
  /** Whether this tab is already in the split (right pane) */
  isSplitTab?: boolean
  /** Remove this specific pane from the split group */
  onRemoveFromSplit?: (subChatId: string) => void
  /** Number of panes currently in the split group */
  splitPaneCount?: number
  /** IDs of all panes in the split group (for opening in new window) */
  splitPaneIds?: string[]
}

export function SubChatContextMenu({
  subChat,
  isPinned,
  onTogglePin,
  onRename,
  onArchive,
  onArchiveOthers,
  onArchiveAllBelow,
  isOnlyChat,
  currentIndex,
  totalCount,
  showCloseTabOptions = false,
  onCloseTab,
  onCloseOtherTabs,
  onCloseTabsToRight,
  visualIndex = 0,
  hasTabsToRight = false,
  canCloseOtherTabs = false,
  chatId,
  onOpenInSplit,
  onCloseSplit,
  isActiveTab = false,
  isSplitTab = false,
  onRemoveFromSplit,
  splitPaneCount = 0,
  splitPaneIds,
}: SubChatContextMenuProps) {
  const closeTabShortcut = useCloseTabShortcut()

  const handleExport = useCallback((format: ExportFormat) => {
    if (!chatId) return
    exportChat({ chatId, subChatId: subChat.id, format })
  }, [chatId, subChat.id])

  const handleCopy = useCallback((format: ExportFormat) => {
    if (!chatId) return
    copyChat({ chatId, subChatId: subChat.id, format })
  }, [chatId, subChat.id])

  return (
    <ContextMenuContent className="w-48">
      <ContextMenuItem onClick={() => onTogglePin(subChat.id)}>
        {isPinned ? "Unpin chat" : "Pin chat"}
      </ContextMenuItem>
      <ContextMenuItem onClick={() => onRename(subChat)}>
        Rename chat
      </ContextMenuItem>
      {chatId && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>Export chat</ContextMenuSubTrigger>
          <ContextMenuSubContent sideOffset={6} alignOffset={-4}>
            <ContextMenuItem onClick={() => handleExport("markdown")}>
              Download as Markdown
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleExport("json")}>
              Download as JSON
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleExport("text")}>
              Download as Text
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => handleCopy("markdown")}>
              Copy as Markdown
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleCopy("json")}>
              Copy as JSON
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleCopy("text")}>
              Copy as Text
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}
      {isDesktopApp() && chatId && (
        <ContextMenuItem onClick={() => openInNewWindow(chatId, subChat.id, isSplitTab ? splitPaneIds : undefined)}>
          Open in new window
        </ContextMenuItem>
      )}
      {isSplitTab ? (
        <>
          {splitPaneCount > 2 && onRemoveFromSplit && (
            <ContextMenuItem onClick={() => onRemoveFromSplit(subChat.id)}>
              Remove from Split
            </ContextMenuItem>
          )}
          {onCloseSplit && (
            <ContextMenuItem onClick={onCloseSplit}>
              Separate Chats
            </ContextMenuItem>
          )}
        </>
      ) : onOpenInSplit ? (
        <ContextMenuItem
          onClick={() => onOpenInSplit(subChat.id)}
          disabled={isActiveTab || isOnlyChat || splitPaneCount >= 6}
        >
          Add as Split
        </ContextMenuItem>
      ) : null}
      <ContextMenuSeparator />

      {showCloseTabOptions ? (
        <>
          <ContextMenuItem
            onClick={() => onCloseTab?.(subChat.id)}
            className="justify-between"
            disabled={isOnlyChat}
          >
            Close chat
            {!isOnlyChat && <Kbd>{closeTabShortcut}</Kbd>}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onCloseOtherTabs?.(subChat.id)}
            disabled={!canCloseOtherTabs}
          >
            Close other chats
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onCloseTabsToRight?.(subChat.id, visualIndex)}
            disabled={!hasTabsToRight}
          >
            Close chats to the right
          </ContextMenuItem>
        </>
      ) : (
        <>
          <ContextMenuItem
            onClick={() => onArchive(subChat.id)}
            className="justify-between"
            disabled={isOnlyChat}
          >
            Archive chat
            {!isOnlyChat && <Kbd>{closeTabShortcut}</Kbd>}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onArchiveAllBelow?.(subChat.id)}
            disabled={
              currentIndex === undefined ||
              currentIndex >= (totalCount || 0) - 1
            }
          >
            Archive chats below
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onArchiveOthers(subChat.id)}
            disabled={isOnlyChat}
          >
            Archive other chats
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  )
}
