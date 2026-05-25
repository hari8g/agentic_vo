/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useCallback, useState, type ReactNode } from 'react'
import { useAccessor, useChatThreadsState, useMCPServiceState, useSettingsState } from '../util/services.js'
import { JiraTicketSummary, JiraWorkflowPhase } from '../../../../common/jiraTypes.js'
import { ATLASSIAN_MCP_SERVER_NAME } from '../../../jiraTicketService.js'
import { ChatMarkdownRender } from '../markdown/ChatMarkdownRender.js'

const phaseMeta: Record<JiraWorkflowPhase, { label: string, className: string }> = {
	planning: { label: 'Planning', className: 'bg-amber-500/15 text-amber-200 border-amber-500/30' },
	awaiting_plan_approval: { label: 'Review plan', className: 'bg-blue-500/15 text-blue-200 border-blue-500/30' },
	executing: { label: 'Implementing', className: 'bg-violet-500/15 text-violet-200 border-violet-500/30' },
	completed: { label: 'Completed', className: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30' },
}

const PhaseBadge = ({ phase }: { phase: JiraWorkflowPhase }) => {
	const meta = phaseMeta[phase]
	return (
		<span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${meta.className}`}>
			{meta.label}
		</span>
	)
}

const Section = ({ title, children, defaultOpen = true }: { title: string, children: ReactNode, defaultOpen?: boolean }) => (
	<details open={defaultOpen} className="rounded-md border border-void-border-3 bg-void-bg-2-alt overflow-hidden">
		<summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-void-fg-1 hover:bg-void-bg-2-hover select-none">
			{title}
		</summary>
		<div className="px-3 pb-3 pt-1 text-xs text-void-fg-2 border-t border-void-border-3 max-h-56 overflow-y-auto">
			{children}
		</div>
	</details>
)

export const JiraTicketPanel = ({ defaultExpanded = false }: { defaultExpanded?: boolean }) => {
	const accessor = useAccessor()
	const jiraTicketService = accessor.get('IJiraTicketService')
	const chatThreadsService = accessor.get('IChatThreadService')
	const voidSettingsService = accessor.get('IVoidSettingsService')
	const chatThreadsState = useChatThreadsState()
	const mcpState = useMCPServiceState()
	const settingsState = useSettingsState()

	const threadId = chatThreadsState.currentThreadId
	const threadState = chatThreadsState.allThreads[threadId]?.state
	const linked = threadState?.linkedJiraIssue
	const jiraWorkflow = threadState?.jiraWorkflow
	const phase = jiraWorkflow?.phase

	const atlassianServer = mcpState.mcpServerOfName[ATLASSIAN_MCP_SERVER_NAME]
	const atlassianOn = settingsState.mcpUserStateOfName[ATLASSIAN_MCP_SERVER_NAME]?.isOn !== false
	const isAvailable = atlassianOn && jiraTicketService.isAtlassianAvailable()

	const [expanded, setExpanded] = useState(defaultExpanded)
	const [issues, setIssues] = useState<JiraTicketSummary[]>([])
	const [selectedKey, setSelectedKey] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [running, setRunning] = useState(false)

	const refreshIssues = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const list = await jiraTicketService.listMyIssues()
			setIssues(list)
			if (list.length && !selectedKey) setSelectedKey(list[0].key)
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e))
			setIssues([])
		} finally {
			setLoading(false)
		}
	}, [jiraTicketService, selectedKey])

	const onPlanImplementation = useCallback(async () => {
		if (!selectedKey || running) return
		setRunning(true)
		setError(null)
		try {
			const issue = await jiraTicketService.fetchIssue(selectedKey)
			await chatThreadsService.startJiraPlanning(threadId, issue)
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e))
		} finally {
			setRunning(false)
		}
	}, [selectedKey, running, jiraTicketService, chatThreadsService, threadId])

	const onApproveAndExecute = useCallback(async () => {
		if (running) return
		setRunning(true)
		setError(null)
		try {
			await chatThreadsService.approveJiraPlanAndExecute(threadId)
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e))
		} finally {
			setRunning(false)
		}
	}, [running, chatThreadsService, threadId])

	const onClearLink = useCallback(() => {
		chatThreadsService.setLinkedJiraIssue(threadId, undefined)
	}, [chatThreadsService, threadId])

	if (!atlassianOn) {
		return (
			<div className="text-xs text-void-fg-3 px-1 py-2">
				Enable the <span className="font-medium">atlassian</span> MCP server in Settings → MCP to use Jira tickets.
			</div>
		)
	}

	if (atlassianServer?.status === 'error') {
		return (
			<div className="text-xs text-rose-500 px-1 py-2">
				Atlassian MCP error: {atlassianServer.error}
			</div>
		)
	}

	const canPlan = selectedKey && isAvailable && phase !== 'planning' && phase !== 'executing'
	const canApprove = phase === 'awaiting_plan_approval' && !!jiraWorkflow?.planMarkdown
	const requirementsText = jiraWorkflow?.requirementsSummary
		?? (linked ? linked.summary : '')
	const planForDisplay = jiraWorkflow?.planMarkdown ?? ''

	return (
		<div className="border border-void-border-3 rounded-md bg-void-bg-1 text-void-fg-1 text-sm overflow-hidden">
			<button
				type="button"
				className="w-full flex items-center justify-between px-3 py-2 hover:bg-void-bg-2-hover text-left gap-2"
				onClick={() => setExpanded(e => !e)}
			>
				<span className="font-medium">Jira workflow</span>
				<span className="flex items-center gap-2 shrink-0">
					{phase && <PhaseBadge phase={phase} />}
					<span className="text-void-fg-3 text-xs">{expanded ? '▾' : '▸'}</span>
				</span>
			</button>

			{linked && (
				<div className="px-3 pb-3 flex flex-col gap-2 border-t border-void-border-3 bg-void-bg-2-alt">
					<div className="flex items-start justify-between gap-2 pt-2">
						<div className="min-w-0">
							<div className="font-medium text-sm">{linked.key}</div>
							<div className="text-xs text-void-fg-2 truncate" title={linked.summary}>{linked.summary}</div>
							{linked.status && <div className="text-[10px] text-void-fg-4 mt-0.5">Jira status: {linked.status}</div>}
						</div>
						<button type="button" className="text-xs text-void-fg-3 hover:text-void-fg-1 shrink-0" onClick={onClearLink}>
							Unlink
						</button>
					</div>

					{(requirementsText || linked.description) && phase !== 'completed' && (
						<Section title="Requirements" defaultOpen={phase === 'planning' || phase === 'awaiting_plan_approval'}>
							<ChatMarkdownRender
								string={requirementsText || linked.summary}
								chatMessageLocation={undefined}
							/>
						</Section>
					)}

					{planForDisplay && (phase === 'awaiting_plan_approval' || phase === 'executing' || phase === 'completed') && (
						<Section title="Implementation plan" defaultOpen={phase === 'awaiting_plan_approval'}>
							<ChatMarkdownRender string={planForDisplay} chatMessageLocation={undefined} />
						</Section>
					)}

					{phase === 'executing' && (
						<div className="text-[10px] text-void-fg-3 px-1">
							Agent is implementing. Jira will be updated automatically when the run finishes.
						</div>
					)}

					{jiraWorkflow?.jiraFinalizeStatus && (
						<div className={`text-xs px-2 py-1.5 rounded border ${
							jiraWorkflow.jiraFinalizeStatus === 'success'
								? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
								: jiraWorkflow.jiraFinalizeStatus === 'error'
									? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
									: 'border-void-border-3 bg-void-bg-1 text-void-fg-3'
						}`}>
							{jiraWorkflow.jiraFinalizeStatus === 'pending' && 'Updating Jira…'}
							{jiraWorkflow.jiraFinalizeStatus === 'success' && (jiraWorkflow.jiraFinalizeMessage ?? 'Jira updated.')}
							{jiraWorkflow.jiraFinalizeStatus === 'error' && (jiraWorkflow.jiraFinalizeMessage ?? 'Jira update failed.')}
						</div>
					)}
				</div>
			)}

			{expanded && (
				<div className="px-3 pb-3 border-t border-void-border-3 space-y-2">
					<div className="flex flex-wrap gap-2 pt-2">
						<button
							type="button"
							className="px-2 py-1 rounded bg-void-bg-2 hover:bg-void-bg-2-hover text-xs disabled:opacity-50"
							disabled={loading || !isAvailable}
							onClick={() => refreshIssues()}
						>
							{loading ? 'Loading…' : 'Refresh issues'}
						</button>
						<button
							type="button"
							className="px-2 py-1 rounded bg-[#306dce] text-white text-xs disabled:opacity-50"
							disabled={!canPlan || running}
							onClick={() => onPlanImplementation()}
						>
							{running && phase !== 'awaiting_plan_approval' ? 'Working…' : 'Plan'}
						</button>
						{canApprove && (
							<button
								type="button"
								className="px-2 py-1 rounded bg-emerald-600 text-white text-xs disabled:opacity-50"
								disabled={running}
								onClick={() => onApproveAndExecute()}
							>
								{running ? 'Starting…' : 'Approve & run'}
							</button>
						)}
					</div>

					{!isAvailable && atlassianServer?.status === 'loading' && (
						<div className="text-xs text-void-fg-3">Connecting to Atlassian MCP…</div>
					)}
					{!isAvailable && atlassianServer?.status !== 'loading' && (
						<div className="text-xs text-void-fg-3">Atlassian MCP not ready. Check ~/.agentic-editor-dev/mcp.json and restart Agentic.</div>
					)}

					{error && <div className="text-xs text-rose-500">{error}</div>}

					<div className="max-h-36 overflow-y-auto space-y-1">
						{issues.length === 0 && !loading && isAvailable && (
							<div className="text-xs text-void-fg-3">Refresh to load your assigned issues.</div>
						)}
						{issues.map(issue => (
							<button
								key={issue.key}
								type="button"
								className={`w-full text-left px-2 py-1.5 rounded text-xs ${selectedKey === issue.key ? 'bg-[#306dce]/20 border border-[#306dce]/40' : 'hover:bg-void-bg-2-hover border border-transparent'}`}
								onClick={() => setSelectedKey(issue.key)}
							>
								<span className="font-medium">{issue.key}</span>
								<span className="text-void-fg-3"> — </span>
								<span>{issue.summary}</span>
								{issue.status && <span className="text-void-fg-4 block mt-0.5">{issue.status}</span>}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	)
}
