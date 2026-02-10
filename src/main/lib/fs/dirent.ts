import type { Dirent } from "fs"
import * as fs from "fs/promises"
import * as path from "path"

export interface DirentType {
  isDirectory: boolean
  isFile: boolean
}

/**
 * Resolve entry type, following symlinks when needed.
 */
export async function resolveDirentType(
  dir: string,
  entry: Dirent,
): Promise<DirentType> {
  let isDirectory = entry.isDirectory()
  let isFile = entry.isFile()

  if (!isDirectory && !isFile && entry.isSymbolicLink()) {
    try {
      const targetPath = path.join(dir, entry.name)
      const stat = await fs.stat(targetPath) // stat() follows symlinks
      isDirectory = stat.isDirectory()
      isFile = stat.isFile()
    } catch {
      return { isDirectory: false, isFile: false }
    }
  }

  return { isDirectory, isFile }
}

/**
 * Check if a Dirent resolves to a directory (including symlink targets).
 */
export async function isDirentDirectory(
  dir: string,
  entry: Dirent,
): Promise<boolean> {
  const { isDirectory } = await resolveDirentType(dir, entry)
  return isDirectory
}
