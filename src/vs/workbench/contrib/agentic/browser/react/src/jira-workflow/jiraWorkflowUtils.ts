/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { ChatMessage } from '../../../../common/chatThreadServiceTypes.js'
import { JIRA_WORKFLOW_COMPLETE_MARKER, JiraWorkflowPhase, JiraWorkflowState, LinkedJiraIssue } from '../../../../common/jiraTypes.js'
import { JiraTicketSummary } from '../../../../common/jiraTypes.js'
import type { ExecutionLogStep, LogStepStatus, PlanSection, SelectedIssueDetail, WorkflowStatus, WorkflowStepId } from './types.js'

const EDIT_TOOL_NAMES = new Set(['edit_file', 'rewrite_file'])
const READ_TOOL_NAMES = new Set(['read_file'])
const SEARCH_TOOL_NAMES = new Set(['search_pathnames_only', 'search_for_files', 'search_in_file', 'ls_dir', 'get_dir_tree'])

export type JiraExecutionFacts = {
	readFileCount: number
	editFileCount: number
	searchCount: number
	editedPaths: string[]
	hasCompletionMarker: boolean
	toolErrorCount: number
	lastSuccessfulTool?: string
}

export const extractJiraExecutionFacts = (messages: readonly ChatMessage[]): JiraExecutionFacts => {
	const editedPaths = new Set<string>()
	let readFileCount = 0
	let editFileCount = 0
	let searchCount = 0
	let toolErrorCount = 0
	let hasCompletionMarker = false
	let lastSuccessfulTool: string | undefined

	for (const m of messages) {
		if (m.role === 'assistant' && m.displayContent.includes(JIRA_WORKFLOW_COMPLETE_MARKER)) {
			hasCompletionMarker = true
		}
		if (m.role === 'checkpoint' && m.type === 'tool_edit') {
			for (const fsPath of Object.keys(m.agenticFileSnapshotOfURI)) {
				if (m.agenticFileSnapshotOfURI[fsPath]) editedPaths.add(fsPath)
			}
		}
		if (m.role !== 'tool') continue
		if (m.type === 'tool_error') {
			toolErrorCount++
			continue
		}
		if (m.type !== 'success') continue
		lastSuccessfulTool = m.name
		if (READ_TOOL_NAMES.has(m.name)) readFileCount++
		if (SEARCH_TOOL_NAMES.has(m.name)) searchCount++
		if (EDIT_TOOL_NAMES.has(m.name)) {
			editFileCount++
			const uri = 'uri' in m.params ? m.params.uri : undefined
			if (uri && typeof uri === 'object' && 'fsPath' in uri) editedPaths.add((uri as { fsPath: string }).fsPath)
		}
	}

	return {
		readFileCount,
		editFileCount,
		searchCount,
		editedPaths: [...editedPaths],
		hasCompletionMarker,
		toolErrorCount,
		lastSuccessfulTool,
	}
}

const PLAN_SECTION_TITLES = [
	'Scope & Understanding',
	'Proposed Technical Approach',
	'Files likely to change',
	'Validation & Tests',
	'Risks / Assumptions',
] as const

export const deriveWorkflowStatus = (opts: {
	phase?: JiraWorkflowPhase
	hasSelection: boolean
	hasPlan: boolean
	finalizeStatus?: JiraWorkflowState['jiraFinalizeStatus']
	isStreaming?: boolean
}): WorkflowStatus => {
	const { phase, hasSelection, hasPlan, finalizeStatus, isStreaming } = opts
	if (finalizeStatus === 'error') return 'failed'
	if (phase === 'completed') return 'completed'
	if (phase === 'executing' || isStreaming) return 'running'
	if (phase === 'awaiting_plan_approval') return 'plan_ready'
	if (phase === 'planning') return 'planning'
	if (hasSelection && hasPlan) return 'awaiting_approval'
	if (hasSelection) return 'idle'
	return 'idle'
}

export const subtitleForStatus = (status: WorkflowStatus): string => {
	switch (status) {
		case 'idle': return 'Select a ticket to generate a plan'
		case 'planning': return 'Generating implementation plan…'
		case 'plan_ready':
		case 'awaiting_approval': return 'Plan ready — review before execution'
		case 'running': return 'Running workflow'
		case 'completed': return 'Execution complete'
		case 'failed': return 'Workflow failed — review the log'
		default: return 'Select a ticket to generate a plan'
	}
}

export const workflowStepState = (status: WorkflowStatus): Record<WorkflowStepId, LogStepStatus> => {
	const pending: LogStepStatus = 'pending'
	const running: LogStepStatus = 'running'
	const completed: LogStepStatus = 'completed'
	switch (status) {
		case 'idle':
			return { select: completed, plan: pending, review: pending, run: pending, done: pending }
		case 'planning':
			return { select: completed, plan: running, review: pending, run: pending, done: pending }
		case 'plan_ready':
		case 'awaiting_approval':
			return { select: completed, plan: completed, review: running, run: pending, done: pending }
		case 'running':
			return { select: completed, plan: completed, review: completed, run: running, done: pending }
		case 'completed':
			return { select: completed, plan: completed, review: completed, run: completed, done: completed }
		case 'failed':
			return { select: completed, plan: completed, review: completed, run: 'failed', done: pending }
		default:
			return { select: pending, plan: pending, review: pending, run: pending, done: pending }
	}
}

export const parsePlanSections = (markdown: string): PlanSection[] => {
	const text = markdown.trim()
	if (!text) {
		return PLAN_SECTION_TITLES.map(title => ({ id: slug(title), title, body: '' }))
	}

	const sections: PlanSection[] = []
	const headingRe = /^#{1,3}\s+(.+)$/gm
	const matches = [...text.matchAll(headingRe)]
	if (matches.length === 0) {
		return [{ id: 'plan', title: 'Implementation Plan', body: text }]
	}

	for (let i = 0; i < matches.length; i++) {
		const match = matches[i]
		const title = match[1]?.trim() ?? 'Section'
		const start = (match.index ?? 0) + match[0].length
		const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length
		sections.push({ id: slug(title), title, body: text.slice(start, end).trim() })
	}

	for (const expected of PLAN_SECTION_TITLES) {
		if (!sections.some(s => s.title.toLowerCase().includes(expected.toLowerCase().slice(0, 8)))) {
			sections.push({ id: slug(expected), title: expected, body: '' })
		}
	}
	return sections
}

export const buildSelectedIssueDetail = (
	selectedIssueId: string | null,
	issues: JiraTicketSummary[],
	linked?: LinkedJiraIssue,
): SelectedIssueDetail | null => {
	if (!selectedIssueId) return null
	const fromList = issues.find(i => i.key.toUpperCase() === selectedIssueId.toUpperCase())
	const projectMatch = /^([A-Z][A-Z0-9]+)-\d+$/i.exec(selectedIssueId)
	const projectKey = projectMatch?.[1]?.toUpperCase()

	if (linked && linked.key.toUpperCase() === selectedIssueId.toUpperCase()) {
		return {
			key: linked.key,
			summary: linked.summary,
			status: linked.status ?? fromList?.status,
			assignee: fromList?.assignee,
			description: linked.description,
			projectKey,
		}
	}
	if (fromList) {
		return { ...fromList, projectKey }
	}
	if (selectedIssueId) {
		return { key: selectedIssueId, summary: selectedIssueId, projectKey }
	}
	return null
}

export const buildExecutionLog = (opts: {
	status: WorkflowStatus
	phase?: JiraWorkflowPhase
	hasPlan: boolean
	hasSelection: boolean
	facts: JiraExecutionFacts
	isStreaming?: boolean
	finalizeStatus?: JiraWorkflowState['jiraFinalizeStatus']
	errorMessage?: string
}): ExecutionLogStep[] => {
	const { status, phase, hasPlan, hasSelection, facts, isStreaming, finalizeStatus, errorMessage } = opts
	const step = (id: string, label: string, s: LogStepStatus, detail?: string): ExecutionLogStep => ({ id, label, status: s, detail })

	const isExecutePhase = phase === 'executing' || status === 'running' || (phase === 'completed' && facts.editFileCount > 0)
	const explored = facts.readFileCount + facts.searchCount > 0
	const editedCount = Math.max(facts.editFileCount, facts.editedPaths.length)

	const fetched = step(
		'fetch',
		'Fetched Jira ticket',
		hasSelection ? 'completed' : 'pending',
	)
	const understood = step(
		'understand',
		'Understood requirement',
		hasPlan || phase === 'planning' || phase === 'awaiting_plan_approval' || isExecutePhase || phase === 'completed'
			? 'completed'
			: hasSelection ? 'running' : 'pending',
	)
	const located = step(
		'locate',
		'Located files in workspace',
		explored
			? 'completed'
			: isExecutePhase && isStreaming
				? 'running'
				: hasPlan
					? 'completed'
					: status === 'planning' && isStreaming
						? 'running'
						: 'pending',
		explored
			? `${facts.readFileCount} read, ${facts.searchCount} search`
			: undefined,
	)
	const proposed = step(
		'propose',
		'Proposed changes (plan)',
		hasPlan ? 'completed' : status === 'planning' && isStreaming ? 'running' : 'pending',
		hasPlan ? 'Plan ready for approval' : undefined,
	)
	const approval = step(
		'approval',
		'Plan approved',
		status === 'plan_ready' || status === 'awaiting_approval'
			? 'running'
			: isExecutePhase || phase === 'completed'
				? 'completed'
				: 'pending',
	)

	let appliedStatus: LogStepStatus = 'pending'
	let appliedDetail: string | undefined
	if (editedCount > 0) {
		appliedStatus = isExecutePhase && isStreaming ? 'running' : 'completed'
		appliedDetail = `${editedCount} edit(s) on ${facts.editedPaths.length || editedCount} file(s)`
	} else if (isExecutePhase) {
		if (isStreaming) {
			appliedStatus = explored ? 'running' : 'pending'
			appliedDetail = explored
				? `Explored workspace (${facts.readFileCount} reads) — waiting for edits`
				: 'Waiting for edit_file / rewrite_file'
		} else if (facts.hasCompletionMarker || finalizeStatus === 'error') {
			appliedStatus = 'failed'
			appliedDetail = explored
				? 'Agent finished without modifying any files'
				: 'No file edits were applied'
		} else if (explored) {
			appliedStatus = 'running'
			appliedDetail = `${facts.readFileCount} file(s) opened/read, no edits yet`
		}
	}
	if (facts.toolErrorCount > 0 && appliedStatus !== 'completed') {
		appliedDetail = `${appliedDetail ? appliedDetail + ' · ' : ''}${facts.toolErrorCount} tool error(s)`
	}
	const applied = step('apply', 'Applied changes', appliedStatus, appliedDetail)

	let jiraStatus: LogStepStatus = 'pending'
	if (finalizeStatus === 'success' && phase === 'completed') jiraStatus = 'completed'
	else if (finalizeStatus === 'error') jiraStatus = 'failed'
	else if (finalizeStatus === 'pending') jiraStatus = 'running'
	const jiraUpdate = step('jira', 'Updated Jira status', jiraStatus, errorMessage)

	return [fetched, understood, located, proposed, approval, applied, jiraUpdate]
}

export const inferProjectKeyFromIssues = (issues: JiraTicketSummary[]): string => {
	const counts = new Map<string, number>()
	for (const issue of issues) {
		const match = /^([A-Z][A-Z0-9]+)-\d+$/i.exec(issue.key)
		if (match) {
			const p = match[1].toUpperCase()
			counts.set(p, (counts.get(p) ?? 0) + 1)
		}
	}
	let best = ''
	let bestN = 0
	for (const [k, n] of counts) {
		if (n > bestN) { best = k; bestN = n }
	}
	return best
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
