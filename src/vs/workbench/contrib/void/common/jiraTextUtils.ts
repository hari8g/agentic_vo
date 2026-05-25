/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { JIRA_PLAN_READY_MARKER, JIRA_WORKFLOW_COMPLETE_MARKER } from './jiraTypes.js'

export const JIRA_DESC_PROMPT_MAX = 1500
export const JIRA_PLAN_PROMPT_MAX = 2200
export const JIRA_PLAN_UI_MAX = 12000

export const truncateForPrompt = (text: string, maxLen: number): string => {
	const t = text.trim()
	if (t.length <= maxLen) return t
	return t.slice(0, maxLen) + '\n\n…(truncated for token limits)'
}

export const stripJiraWorkflowMarkers = (text: string): string => {
	return text
		.replaceAll(JIRA_PLAN_READY_MARKER, '')
		.replaceAll(JIRA_WORKFLOW_COMPLETE_MARKER, '')
		.trim()
}

/** Plain-text requirements blurb for sidebar (no ADF JSON). */
export const formatRequirementsForUI = (description: string, maxLen = 1200): string => {
	let text = description.trim()
	if (!text) return '(No description on ticket.)'
	// Unwrap simple ADF-style JSON blobs
	if (text.startsWith('{') && text.includes('"type"')) {
		try {
			const json = JSON.parse(text)
			const parts: string[] = []
			const walk = (node: unknown) => {
				if (!node || typeof node !== 'object') return
				const n = node as Record<string, unknown>
				if (n.type === 'text' && typeof n.text === 'string') parts.push(n.text)
				if (Array.isArray(n.content)) n.content.forEach(walk)
			}
			walk(json)
			if (parts.length) text = parts.join('\n')
		} catch { /* keep original */ }
	}
	text = text.replace(/\n{3,}/g, '\n\n')
	return truncateForPrompt(text, maxLen)
}

export const summarizePlanForPrompt = (planMarkdown: string): string => {
	return truncateForPrompt(stripJiraWorkflowMarkers(planMarkdown), JIRA_PLAN_PROMPT_MAX)
}
