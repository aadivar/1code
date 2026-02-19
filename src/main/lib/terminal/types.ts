import type * as pty from "node-pty"

export interface TerminalSession {
	pty: pty.IPty
	paneId: string
	workspaceId: string
	/** Terminal scope key: "path:<dir>" for shared (local mode) or "ws:<chatId>" for isolated (worktree mode) */
	scopeKey: string
	cwd: string
	cols: number
	rows: number
	lastActive: number
	serializedState?: string
	isAlive: boolean
	shell: string
	startTime: number
	usedFallback: boolean
}

export interface TerminalDataEvent {
	type: "data"
	data: string
}

export interface TerminalExitEvent {
	type: "exit"
	exitCode: number
	signal?: number
}

export type TerminalEvent = TerminalDataEvent | TerminalExitEvent

export interface SessionResult {
	isNew: boolean
	/** Serialized terminal state from xterm's SerializeAddon */
	serializedState: string
}

export interface CreateSessionParams {
	paneId: string
	tabId?: string
	workspaceId?: string
	/** Terminal scope key: "path:<dir>" for shared (local mode) or "ws:<chatId>" for isolated (worktree mode) */
	scopeKey?: string
	workspaceName?: string
	workspacePath?: string
	rootPath?: string
	cwd?: string
	cols?: number
	rows?: number
	initialCommands?: string[]
}

export interface InternalCreateSessionParams extends CreateSessionParams {
	useFallbackShell?: boolean
}

export interface DetectedPort {
	port: number
	pid: number
	processName: string
	paneId: string
	workspaceId: string
	detectedAt: number
	address: string
}
