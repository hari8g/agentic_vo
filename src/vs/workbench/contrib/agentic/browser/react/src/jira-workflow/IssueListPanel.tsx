/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { JiraTicketSummary } from '../../../../common/jiraTypes.js'
import { getJiraWorkflowHighlight, jiraHighlightStatusBadgeClass, jiraIssueAccent } from '../../../../common/jiraTextUtils.js'
import { JiraWorkflowPhase } from '../../../../common/jiraTypes.js'
import { JiraIssueListScope } from '../../../jiraTicketService.js'

const StatusPill = ({ status, highlight }: { status: string, highlight: ReturnType<typeof getJiraWorkflowHighlight> }) => (
	<span
		className={`@@jira-status-pill ${jiraHighlightStatusBadgeClass(highlight)}`}
		title={status}
	>
		<span className={`@@jira-status-pill__dot ${jiraIssueAccent(highlight).dot}`} aria-hidden />
		<span className="@@jira-status-pill__text">{status}</span>
	</span>
)

export const IssueListItem = ({
	issue,
	selected,
	workflowPhase,
	onSelect,
}: {
	issue: JiraTicketSummary
	selected: boolean
	workflowPhase?: JiraWorkflowPhase
	onSelect: () => void
}) => {
	const highlight = getJiraWorkflowHighlight({ workflowPhase, jiraStatus: issue.status })
	const initial = issue.assignee?.trim()?.charAt(0)?.toUpperCase() ?? '·'

	return (
		<button
			type="button"
			role="option"
			aria-selected={selected}
			className={`@@jira-list-item${selected ? ' @@jira-list-item--selected' : ''}`}
			onClick={onSelect}
		>
			<div className="@@jira-list-item__main">
				<span className="@@jira-list-item__key">{issue.key}</span>
				<span className="@@jira-list-item__title">{issue.summary}</span>
			</div>
			<div className="@@jira-list-item__meta">
				{issue.status && <StatusPill status={issue.status} highlight={highlight} />}
				<span className="@@jira-list-item__avatar" title={issue.assignee ?? 'Unassigned'} aria-label={issue.assignee ?? 'Unassigned'}>
					{initial}
				</span>
			</div>
		</button>
	)
}

export const IssueListPanel = ({
	issues,
	loading,
	selectedIssueId,
	workflowPhaseByIssueKey,
	listScope,
	projectKey,
	searchQuery,
	onScopeChange,
	onProjectKeyChange,
	onSearchChange,
	onRefresh,
	onSelect,
	isAvailable,
}: {
	issues: JiraTicketSummary[]
	loading: boolean
	selectedIssueId: string | null
	workflowPhaseByIssueKey: Map<string, JiraWorkflowPhase>
	listScope: JiraIssueListScope
	projectKey: string
	searchQuery: string
	onScopeChange: (scope: JiraIssueListScope) => void
	onProjectKeyChange: (key: string) => void
	onSearchChange: (q: string) => void
	onRefresh: () => void
	onSelect: (key: string) => void
	isAvailable: boolean
}) => {
	const scopes: { id: JiraIssueListScope, label: string }[] = [
		{ id: 'assigned', label: 'Assigned to me' },
		{ id: 'project', label: 'Project' },
		{ id: 'recent', label: 'Recent' },
	]

	return (
		<aside className="@@jira-list-panel" aria-label="Jira issues">
			<div className="@@jira-list-panel__tabs" role="tablist">
				{scopes.map(s => (
					<button
						key={s.id}
						type="button"
						role="tab"
						aria-selected={listScope === s.id}
						className={`@@jira-list-panel__tab${listScope === s.id ? ' @@jira-list-panel__tab--active' : ''}`}
						onClick={() => onScopeChange(s.id)}
					>
						{s.label}
					</button>
				))}
			</div>

			{listScope === 'project' && (
				<input
					type="text"
					className="@@jira-list-panel__project-input"
					value={projectKey}
					onChange={e => onProjectKeyChange(e.target.value.toUpperCase())}
					placeholder="PROJECT KEY"
					aria-label="Project key"
				/>
			)}

			<div className="@@jira-list-panel__search-wrap">
				<input
					type="search"
					className="@@jira-list-panel__search"
					value={searchQuery}
					onChange={e => onSearchChange(e.target.value)}
					placeholder="Filter by key, title, or status…"
					aria-label="Filter issues"
				/>
			</div>

			<div className="@@jira-list-panel__toolbar">
				<button type="button" className="@@jira-btn @@jira-btn--ghost" disabled={loading || !isAvailable} onClick={onRefresh}>
					{loading ? 'Syncing…' : 'Refresh'}
				</button>
				<span className="@@jira-list-panel__count">{loading ? '…' : `${issues.length} issues`}</span>
			</div>

			<div className="@@jira-list-panel__list agentic-scrollable-element" role="listbox" aria-label="Issue list">
				{loading && issues.length === 0 && (
					<p className="@@jira-empty @@jira-empty--inline">Syncing with Jira…</p>
				)}
				{!loading && issues.length === 0 && (
					<p className="@@jira-empty @@jira-empty--inline">No issues match this filter.</p>
				)}
				{issues.map(issue => (
					<IssueListItem
						key={issue.key}
						issue={issue}
						selected={selectedIssueId === issue.key}
						workflowPhase={workflowPhaseByIssueKey.get(issue.key.toUpperCase())}
						onSelect={() => onSelect(issue.key)}
					/>
				))}
			</div>
		</aside>
	)
}
