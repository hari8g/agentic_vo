/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { JIRA_PLAN_READY_MARKER, JIRA_WORKFLOW_COMPLETE_MARKER, JiraWorkflowPhase } from './jiraTypes.js'

/** UI highlight tier for Jira tickets in the sidebar list */
export type JiraWorkflowHighlight = 'done' | 'in_progress' | 'not_started'

const DONE_STATUS_RE = /\b(done|complete|completed|closed|resolved|finished|cancelled|canceled)\b/i
const IN_PROGRESS_STATUS_RE = /\b(in\s*progress|in\s*review|review|implement|development|dev|testing|blocked|active|under\s*way|wip|planning)\b/i

export const getJiraWorkflowHighlight = (opts: {
	workflowPhase?: JiraWorkflowPhase
	jiraStatus?: string
}): JiraWorkflowHighlight => {
	const { workflowPhase, jiraStatus } = opts
	if (workflowPhase === 'completed') {
		return 'done'
	}
	if (
		workflowPhase === 'planning'
		|| workflowPhase === 'executing'
		|| workflowPhase === 'awaiting_plan_approval'
	) {
		return 'in_progress'
	}
	const status = (jiraStatus ?? '').trim()
	if (status && DONE_STATUS_RE.test(status)) {
		return 'done'
	}
	if (status && IN_PROGRESS_STATUS_RE.test(status)) {
		return 'in_progress'
	}
	return 'not_started'
}

export const jiraHighlightRowClass = (tier: JiraWorkflowHighlight, selected: boolean): string => {
	const base = {
		done: 'border-emerald-500/50 bg-emerald-500/15 hover:bg-emerald-500/25',
		in_progress: 'border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25',
		not_started: 'border-rose-500/50 bg-rose-500/15 hover:bg-rose-500/25',
	}[tier]
	if (selected) {
		return `w-full text-left px-2 py-1.5 rounded text-xs border ring-1 ring-[#306dce]/50 ${base}`
	}
	return `w-full text-left px-2 py-1.5 rounded text-xs border border-transparent hover:opacity-90 ${base}`
}

export const jiraHighlightStatusClass = (tier: JiraWorkflowHighlight): string => ({
	done: 'text-emerald-600 dark:text-emerald-300',
	in_progress: 'text-amber-600 dark:text-amber-300',
	not_started: 'text-rose-600 dark:text-rose-300',
}[tier])

export const jiraHighlightStatusBadgeClass = (tier: JiraWorkflowHighlight): string => ({
	done: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-500/30',
	in_progress: 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30',
	not_started: 'bg-indigo-500/12 text-indigo-800 dark:text-indigo-200 border-indigo-500/25',
}[tier])

/** Left accent + glow for modern issue cards */
export const jiraIssueAccent = (tier: JiraWorkflowHighlight): { bar: string, glow: string, dot: string } => ({
	done: { bar: '#34d399', glow: 'rgba(52, 211, 153, 0.22)', dot: 'bg-emerald-400' },
	in_progress: { bar: '#fbbf24', glow: 'rgba(251, 191, 36, 0.2)', dot: 'bg-amber-400' },
	not_started: { bar: '#818cf8', glow: 'rgba(129, 140, 248, 0.18)', dot: 'bg-indigo-400' },
}[tier])

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
