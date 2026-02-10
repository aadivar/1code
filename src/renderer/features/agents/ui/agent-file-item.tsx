"use client"

import { useState } from "react"
import { X, FileText, FileCode, FileJson } from "lucide-react"
import { IconSpinner } from "../../../components/ui/icons"

interface AgentFileItemProps {
  id: string
  filename: string
  url: string
  size?: number
  isLoading?: boolean
  onRemove?: () => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase()

  // Code files
  if (["js", "ts", "jsx", "tsx", "py", "rb", "go", "rs", "java", "kt", "swift", "c", "cpp", "h", "hpp", "cs", "php"].includes(ext || "")) {
    return FileCode
  }

  // JSON/YAML/XML
  if (["json", "yaml", "yml", "xml"].includes(ext || "")) {
    return FileJson
  }

  return FileText
}

export function AgentFileItem({
  id,
  filename,
  url,
  size,
  isLoading = false,
  onRemove,
}: AgentFileItemProps) {
  const [isHovered, setIsHovered] = useState(false)
  const Icon = getFileIcon(filename)

  return (
    <div
      className="relative flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg bg-muted/50 min-w-[120px] max-w-[200px]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center justify-center w-8 self-stretch rounded-md bg-muted shrink-0">
        {isLoading ? (
          <IconSpinner className="size-4 text-muted-foreground" />
        ) : (
          <Icon className="size-4 text-muted-foreground" />
        )}
      </div>

      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium text-foreground truncate" title={filename}>
          {filename}
        </span>
        {size !== undefined && (
          <span className="text-[10px] text-muted-foreground">
            {formatFileSize(size)}
          </span>
        )}
      </div>

      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className={`absolute -top-1.5 -right-1.5 size-4 rounded-full bg-background border border-border
                     flex items-center justify-center transition-[opacity,transform] duration-150 ease-out active:scale-[0.97] z-10
                     text-muted-foreground hover:text-foreground
                     ${isHovered ? "opacity-100" : "opacity-0"}`}
          type="button"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  )
}
