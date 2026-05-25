/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js'
import { isAbsolute, sep } from '../../../../base/common/path.js'
import { IFileService } from '../../../../platform/files/common/files.js'
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js'

/** POSIX paths that look absolute but are usually workspace-relative (e.g. /backend/...). */
const POSIX_SYSTEM_ROOT_SEGMENTS = new Set([
	'etc', 'usr', 'var', 'tmp', 'opt', 'bin', 'sbin', 'lib', 'proc', 'sys', 'dev', 'home',
	'applications', 'library', 'system', 'volumes', 'private',
])

const isUriInsideAnyWorkspaceFolder = (uri: URI, workspaceContextService: IWorkspaceContextService): boolean => {
	for (const folder of workspaceContextService.getWorkspace().folders) {
		const root = folder.uri.fsPath
		const rootWithSep = root.endsWith(sep) ? root : root + sep
		const fsPath = uri.fsPath
		if (fsPath === root || fsPath.startsWith(rootWithSep)) {
			return true
		}
	}
	return false
}

const workspaceRelativeCandidates = (uriStr: string): string[] => {
	const trimmed = uriStr.trim()
	const normalized = trimmed.replace(/\\/g, '/')
	const candidates: string[] = []

	if (normalized.startsWith('/')) {
		const withoutLeading = normalized.slice(1)
		if (withoutLeading && !POSIX_SYSTEM_ROOT_SEGMENTS.has(withoutLeading.split('/')[0]?.toLowerCase() ?? '')) {
			candidates.push(withoutLeading)
		}
	} else if (!isAbsolute(trimmed)) {
		candidates.push(trimmed)
	}

	return candidates
}

/**
 * Resolve a tool path string to a workspace file URI.
 * LLMs often pass `/backend/foo.py` meaning "backend/foo.py under the workspace root", not `/backend` on disk.
 */
export const resolveToolFileUri = (
	uriStr: string,
	workspaceContextService: IWorkspaceContextService,
): URI => {
	if (uriStr.includes('://')) {
		return URI.parse(uriStr)
	}

	const trimmed = uriStr.trim()
	const directUri = URI.file(trimmed)

	if (isUriInsideAnyWorkspaceFolder(directUri, workspaceContextService)) {
		return directUri
	}

	const folders = workspaceContextService.getWorkspace().folders
	if (folders.length === 0) {
		return directUri
	}

	const relatives = workspaceRelativeCandidates(trimmed)
	for (const folder of folders) {
		for (const rel of relatives) {
			return URI.joinPath(folder.uri, rel)
		}
	}

	return directUri
}

/** If the URI does not exist on disk, try workspace-relative interpretations. */
export const resolveExistingToolFileUri = async (
	uri: URI,
	workspaceContextService: IWorkspaceContextService,
	fileService: IFileService,
): Promise<URI> => {
	if (await fileService.exists(uri)) {
		return uri
	}

	const folders = workspaceContextService.getWorkspace().folders
	const normalized = uri.fsPath.replace(/\\/g, '/')
	const relatives = workspaceRelativeCandidates(normalized.startsWith('/') ? normalized : uri.fsPath)

	for (const folder of folders) {
		for (const rel of relatives) {
			const candidate = URI.joinPath(folder.uri, rel)
			if (await fileService.exists(candidate)) {
				return candidate
			}
		}
		// Also try joining when fsPath was wrongly absolute, e.g. /backend/foo on mac
		if (normalized.startsWith('/')) {
			const candidate = URI.joinPath(folder.uri, normalized.slice(1))
			if (await fileService.exists(candidate)) {
				return candidate
			}
		}
	}

	// File may not exist yet (create); still map workspace-relative paths correctly.
	return resolveToolFileUri(uri.fsPath, workspaceContextService)
}
