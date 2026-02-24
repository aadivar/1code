import { clearMessageStateCacheByMessageIds } from "../main/assistant-message-item"
import { clearTextPartStoreByMessageIds } from "../main/isolated-text-part"
import { clearToolStateCachesByToolCallIds } from "../ui/agent-tool-utils"
import { clearSubChatCaches } from "./message-store"

export function clearSubChatRuntimeCaches(subChatId: string) {
  const { messageIds, toolCallIds } = clearSubChatCaches(subChatId)
  clearMessageStateCacheByMessageIds(subChatId, messageIds)
  clearTextPartStoreByMessageIds(subChatId, messageIds)
  clearToolStateCachesByToolCallIds(toolCallIds)
}
