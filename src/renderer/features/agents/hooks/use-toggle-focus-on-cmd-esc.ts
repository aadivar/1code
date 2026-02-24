import { useEffect, type RefObject } from "react"

/**
 * Hook to toggle focus when Cmd+Esc (or Ctrl+Esc) is pressed.
 * - If focused → blur
 * - If not focused → focus
 * Does not interfere with stop generation (Esc without modifiers).
 *
 * @param editorRef - Ref to the editor/input element
 */
export function useToggleFocusOnCmdEsc(
  editorRef: RefObject<{ focus: () => void; blur: () => void } | null>,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Cmd+Esc (or Ctrl+Esc on Windows/Linux)
      if (
        e.key !== "Escape" ||
        !(e.metaKey || e.ctrlKey) ||
        e.shiftKey ||
        e.altKey
      ) {
        return
      }

      e.preventDefault()
      e.stopPropagation()

      const editor = editorRef.current
      if (!editor) return

      // Check if any input/contenteditable is currently focused
      const activeElement = document.activeElement
      const isInputFocused =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute("contenteditable") === "true" ||
        (activeElement?.hasAttribute("contenteditable") &&
          activeElement.getAttribute("contenteditable") !== "false")

      if (isInputFocused) {
        // Blur if any input is focused
        editor.blur()
      } else {
        // Focus if no input is focused
        editor.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true })
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true })
  }, [editorRef, enabled])
}
