/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
	useAccessor,
	useChatThreadsState,
	useChatThreadsStreamState,
	useCommandBarState,
	useMCPServiceState,
	useSettingsState,
} from '../util/services.js'
import { ATLASSIAN_MCP_SERVER_NAME, type JiraIssueListScope } from '../../../jiraTicketService.js'
import { JiraTicketSummary } from '../../../../common/jiraTypes.js'
import type { DetailTab } from './types.js'
import {
	buildExecutionLog,
	buildSelectedIssueDetail,
	deriveWorkflowStatus,
	extractJiraExecutionFacts,
	inferProjectKeyFromIssues,
	parsePlanSections,
} from './jiraWorkflowUtils.js'

const JIRA_ISSUE_LIST_MAX = 100

export const useJiraWorkflow = () => {
	const accessor = useAccessor()
	const jiraTicketService = accessor.get('IJiraTicketService')
	const chatThreadsService = accessor.get('IChatThreadService')
	const chatThreadsState = useChatThreadsState()
	const streamState = useChatThreadsStreamState()
	const mcpState = useMCPServiceState()
	const settingsState = useSettingsState()
	const commandBarState = useCommandBarState()

	const threadId = chatThreadsState.currentThreadId
	const thread = chatThreadsState.allThreads[threadId]
	const threadState = thread?.state
	const linked = threadState?.linkedJiraIssue
	const jiraWorkflow = threadState?.jiraWorkflow
	const phase = jiraWorkflow?.phase

	const atlassianServer = mcpState.mcpServerOfName[ATLASSIAN_MCP_SERVER_NAME]
	const atlassianOn = settingsState.mcpUserStateOfName[ATLASSIAN_MCP_SERVER_NAME]?.isOn !== false
	const isAvailable = atlassianOn && jiraTicketService.isAtlassianAvailable()
	const isStreaming = !!streamState?.isRunning

	const [issues, setIssues] = useState<JiraTicketSummary[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [running, setRunning] = useState(false)
	const [listScope, setListScope] = useState<JiraIssueListScope>('assigned')
	const [projectKey, setProjectKey] = useState('')
	const [searchQuery, setSearchQuery] = useState('')
	const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>('requirement')

	const selectedIssueId = threadState?.jiraIssueKey ?? threadState?.linkedJiraIssue?.key ?? null

	const selectedIssue = useMemo(
		() => buildSelectedIssueDetail(selectedIssueId, issues, linked),
		[selectedIssueId, issues, linked],
	)

	const requirementsText = jiraWorkflow?.requirementsSummary ?? ''
	const planMarkdown = jiraWorkflow?.planMarkdown ?? ''
	const hasPlan = planMarkdown.trim().length > 0

	const workflowStatus = deriveWorkflowStatus({
		phase,
		hasSelection: !!selectedIssueId,
		hasPlan,
		finalizeStatus: jiraWorkflow?.jiraFinalizeStatus,
		isStreaming: isStreaming && (phase === 'planning' || phase === 'executing'),
	})

	const executionFacts = useMemo(
		() => extractJiraExecutionFacts(thread?.messages ?? []),
		[thread?.messages],
	)

	const changedFiles = useMemo(() => {
		const fromEdits = executionFacts.editedPaths
		const fromDiffs = commandBarState.sortedURIs.map(uri => uri.fsPath)
		return [...new Set([...fromEdits, ...fromDiffs])]
	}, [executionFacts.editedPaths, commandBarState.sortedURIs])

	const filteredIssues = useMemo(() => {
		const q = searchQuery.trim().toLowerCase()
		if (!q) return issues
		return issues.filter(issue =>
			issue.key.toLowerCase().includes(q)
			|| issue.summary.toLowerCase().includes(q)
			|| (issue.status?.toLowerCase().includes(q) ?? false)
		)
	}, [issues, searchQuery])

	const workflowPhaseByIssueKey = useMemo(() => {
		const map = new Map<string, typeof phase>()
		for (const tid in chatThreadsState.allThreads) {
			const t = chatThreadsState.allThreads[tid]
			if (!t) continue
			const key = t.state.jiraIssueKey ?? t.state.linkedJiraIssue?.key
			const wfPhase = t.state.jiraWorkflow?.phase
			if (key && wfPhase) map.set(key.toUpperCase(), wfPhase)
		}
		return map
	}, [chatThreadsState.allThreads])

	const fetchIssues = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const list = await jiraTicketService.listMyIssues({
				maxResults: JIRA_ISSUE_LIST_MAX,
				scope: listScope,
				projectKey: listScope === 'project' ? projectKey : undefined,
			})
			setIssues(list)
			if (listScope === 'assigned' && !projectKey) {
				const inferred = inferProjectKeyFromIssues(list)
				if (inferred) setProjectKey(inferred)
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e))
			setIssues([])
		} finally {
			setLoading(false)
		}
	}, [jiraTicketService, listScope, projectKey])

	const refreshIssues = useCallback(async () => {
		chatThreadsService.openJiraBrowseSession()
		await fetchIssues()
	}, [chatThreadsService, fetchIssues])

	const selectIssue = useCallback(async (issueKey: string) => {
		// Switch thread first so state (selectedIssueId) is the single source of truth
		const targetThreadId = chatThreadsService.switchToJiraIssue(issueKey)
		setActiveDetailTab('requirement')

		// Fetch full issue details so Requirement tab can render even before planning
		try {
			const issue = await jiraTicketService.fetchIssue(issueKey)
			chatThreadsService.setLinkedJiraIssue(targetThreadId, issue)
		} catch {
			// If Atlassian fetch fails, keep the lightweight summary; Requirement tab will
			// fall back to any description once planning starts.
		}
	}, [chatThreadsService, jiraTicketService])

	useEffect(() => {
		if (!isAvailable || loading) return
		void fetchIssues()
	}, [isAvailable, listScope])

	useEffect(() => {
		if (workflowStatus === 'plan_ready' || workflowStatus === 'awaiting_approval') {
			setActiveDetailTab('plan')
		}
	}, [workflowStatus, selectedIssueId])

	const onPlan = useCallback(async () => {
		if (!selectedIssueId || running) return
		setRunning(true)
		setError(null)
		try {
			const planThreadId = chatThreadsService.switchToJiraIssue(selectedIssueId)
			const issue = await jiraTicketService.fetchIssue(selectedIssueId)
			await chatThreadsService.startJiraPlanning(planThreadId, issue)
			setActiveDetailTab('plan')
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e))
		} finally {
			setRunning(false)
		}
	}, [selectedIssueId, running, jiraTicketService, chatThreadsService])

	const onApproveAndRun = useCallback(async () => {
		if (running) return
		setRunning(true)
		setError(null)
		try {
			await chatThreadsService.approveJiraPlanAndExecute(threadId)
			setActiveDetailTab('log')
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e))
		} finally {
			setRunning(false)
		}
	}, [running, chatThreadsService, threadId])

	const onRevisePlan = useCallback(async () => {
		if (running) return
		setRunning(true)
		setError(null)
		try {
			await chatThreadsService.addUserMessageAndStreamResponse({
				threadId,
				userMessage: 'Please revise the implementation plan based on my latest feedback. Keep the same structured sections.',
			})
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e))
		} finally {
			setRunning(false)
		}
	}, [running, chatThreadsService, threadId])

	const onReject = useCallback(() => {
		chatThreadsService.setLinkedJiraIssue(threadId, undefined)
		setActiveDetailTab('requirement')
	}, [chatThreadsService, threadId])

	const onReviewPlan = useCallback(() => setActiveDetailTab('plan'), [])

	const onRestoreCheckpoint = useCallback(() => {
		const idx = threadState?.currCheckpointIdx
		if (idx != null) {
			chatThreadsService.jumpToCheckpointBeforeMessageIdx({ threadId, messageIdx: idx + 1, jumpToUserModified: false })
		}
	}, [chatThreadsService, threadId, threadState?.currCheckpointIdx])

	const checkpointTime = thread?.lastModified ?? null
	const checkpointLabel = threadState?.currCheckpointIdx != null
		? `Checkpoint ${threadState.currCheckpointIdx + 1}`
		: 'Latest state'

	const canPlan = !!selectedIssueId && isAvailable && phase !== 'planning' && phase !== 'executing' && !isStreaming
	const canApprove = workflowStatus === 'plan_ready' && hasPlan
	const canRevise = hasPlan && (workflowStatus === 'plan_ready' || workflowStatus === 'awaiting_approval')

	return {
		atlassianOn,
		atlassianError: atlassianServer?.status === 'error' ? atlassianServer.error : null,
		isAvailable,
		issues,
		filteredIssues,
		selectedIssueId,
		selectedIssue,
		workflowStatus,
		activeDetailTab,
		setActiveDetailTab,
		listScope,
		setListScope,
		projectKey,
		setProjectKey,
		searchQuery,
		setSearchQuery,
		loading,
		error,
		running,
		requirementsText,
		planMarkdown,
		planSections: parsePlanSections(planMarkdown),
		executionSteps: buildExecutionLog({
			status: workflowStatus,
			phase,
			hasPlan,
			hasSelection: !!selectedIssueId,
			facts: executionFacts,
			isStreaming: isStreaming && phase === 'executing',
			finalizeStatus: jiraWorkflow?.jiraFinalizeStatus,
			errorMessage: jiraWorkflow?.jiraFinalizeMessage,
		}),
		changedFiles,
		checkpointLabel,
		checkpointTime,
		workflowPhaseByIssueKey,
		canPlan,
		canApprove,
		canRevise,
		canRestoreCheckpoint: threadState?.currCheckpointIdx != null,
		refreshIssues,
		selectIssue,
		onPlan,
		onApproveAndRun,
		onRevisePlan,
		onReject,
		onReviewPlan,
		onRestoreCheckpoint,
		threadId,
		isStreaming,
	}
}
