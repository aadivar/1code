import type { Chat } from "@ai-sdk/react"

/**
 * Simple module-level storage for Chat objects.
 * Lives outside React lifecycle so chats persist across component mount/unmount.
 */

const chats = new Map<string, Chat<any>>()
const streamIds = new Map<string, string | null>()
const parentChatIds = new Map<string, string>() // subChatId → parentChatId (stored at creation time)
const manuallyAborted = new Map<string, boolean>() // Track if chat was manually stopped

export const agentChatStore = {
  get: (id: string) => chats.get(id),

  set: (id: string, chat: Chat<any>, parentChatId: string) => {
    chats.set(id, chat)
    parentChatIds.set(id, parentChatId)
  },

  has: (id: string) => chats.has(id),

  delete: (id: string) => {
    const chat = chats.get(id) as any
    chat?.transport?.cleanup?.()
    chats.delete(id)
    streamIds.delete(id)
    parentChatIds.delete(id)
    manuallyAborted.delete(id)
  },

  // Get the ORIGINAL parentChatId that was set when the Chat was created
  getParentChatId: (subChatId: string) => parentChatIds.get(subChatId),

  getStreamId: (id: string) => streamIds.get(id),
  setStreamId: (id: string, streamId: string | null) => {
    streamIds.set(id, streamId)
  },

  // Track manual abort to prevent completion sound
  setManuallyAborted: (id: string, aborted: boolean) => {
    manuallyAborted.set(id, aborted)
  },
  wasManuallyAborted: (id: string) => manuallyAborted.get(id) ?? false,
  clearManuallyAborted: (id: string) => {
    manuallyAborted.delete(id)
  },

  clear: () => {
    for (const chat of chats.values()) {
      ;(chat as any)?.transport?.cleanup?.()
    }
    chats.clear()
    streamIds.clear()
    parentChatIds.clear()
    manuallyAborted.clear()
  },
}
