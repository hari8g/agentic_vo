/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { formatRequirementsForUI } from '../../../../common/jiraTextUtils.js'
import { ChatMarkdownRender } from '../markdown/ChatMarkdownRender.js'
import type { DetailTab, ExecutionLogStep, PlanSection } from './types.js'
import type { SelectedIssueDetail } from './types.js'
import { getJiraWorkflowHighlight, jiraHighlightStatusBadgeClass, jiraIssueAccent } from '../../../../common/jiraTextUtils.js'

type RequirementBlock = {
	title: string
	points: string[]
	paragraphs: string[]
}

const REQUIREMENT_SECTION_TITLES = [
	'Business context',
	'Functional requirements',
	'Acceptance criteria',
	'Constraints',
	'Notes',
]

const parseRequirementBlocks = (raw: string): RequirementBlock[] => {
	const text = raw
		.replace(/\r\n/g, '\n')
		.replace(/\t/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.trim()
	if (!text) return []

	const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
	const blocks: RequirementBlock[] = []
	let current: RequirementBlock = { title: 'Summary', points: [], paragraphs: [] }

	const pushCurrent = () => {
		if (!current.points.length && !current.paragraphs.length) return
		blocks.push(current)
	}

	for (const line of lines) {
		const markdownHeadingMatch = /^#{1,6}\s+(.+)$/.exec(line)
		if (markdownHeadingMatch) {
			pushCurrent()
			current = { title: markdownHeadingMatch[1].trim(), points: [], paragraphs: [] }
			continue
		}

		const headingMatch = /^(?:#+\s*)?([A-Za-z][A-Za-z0-9\s/&-]{2,40}):$/.exec(line)
		if (headingMatch) {
			pushCurrent()
			current = { title: headingMatch[1].trim(), points: [], paragraphs: [] }
			continue
		}

		if (line === '```') {
			continue
		}

		const bullet = /^[-*•]\s+(.+)$/.exec(line) ?? /^\d+[.)]\s+(.+)$/.exec(line)
		if (bullet) {
			current.points.push(bullet[1].replace(/^#{1,6}\s+/, '').trim())
			continue
		}

		current.paragraphs.push(line.replace(/^#{1,6}\s+/, '').trim())
	}
	pushCurrent()

	if (blocks.length === 1 && !blocks[0].points.length) {
		const sentences = blocks[0].paragraphs
			.join(' ')
			.split(/(?<=[.?!])\s+/)
			.map(s => s.trim())
			.filter(Boolean)
		const chunked = REQUIREMENT_SECTION_TITLES.map((title, idx) => ({
			title,
			points: [],
			paragraphs: sentences.slice(idx * 2, idx * 2 + 2),
		})).filter(b => b.paragraphs.length > 0)
		if (chunked.length > 1) return chunked
	}

	return blocks
}

export const IssueMetadataBar = ({ issue }: { issue: SelectedIssueDetail }) => {
	const highlight = getJiraWorkflowHighlight({ jiraStatus: issue.status })
	return (
		<div className="@@jira-meta-bar">
			<div className="@@jira-meta-bar__primary">
				<span className="@@jira-meta-bar__key">{issue.key}</span>
				<h2 className="@@jira-meta-bar__title">{issue.summary}</h2>
			</div>
			<dl className="@@jira-meta-bar__fields">
				{issue.status && (
					<div className="@@jira-meta-bar__field">
						<dt>Status</dt>
						<dd>
							<span className={`@@jira-status-pill ${jiraHighlightStatusBadgeClass(highlight)}`}>
								<span className={`@@jira-status-pill__dot ${jiraIssueAccent(highlight).dot}`} />
								<span className="@@jira-status-pill__text">{issue.status}</span>
							</span>
						</dd>
					</div>
				)}
				{issue.assignee && (
					<div className="@@jira-meta-bar__field">
						<dt>Assignee</dt>
						<dd>{issue.assignee}</dd>
					</div>
				)}
				{issue.projectKey && (
					<div className="@@jira-meta-bar__field">
						<dt>Project</dt>
						<dd>{issue.projectKey}</dd>
					</div>
				)}
				{issue.priority && (
					<div className="@@jira-meta-bar__field">
						<dt>Priority</dt>
						<dd>{issue.priority}</dd>
					</div>
				)}
			</dl>
		</div>
	)
}

const TABS: { id: DetailTab, label: string }[] = [
	{ id: 'requirement', label: 'Requirement' },
	{ id: 'plan', label: 'Implementation Plan' },
	{ id: 'files', label: 'Files' },
	{ id: 'log', label: 'Execution Log' },
]

export const DetailTabs = ({
	activeTab,
	onTabChange,
}: {
	activeTab: DetailTab
	onTabChange: (tab: DetailTab) => void
}) => (
	<div className="@@jira-detail-tabs" role="tablist" aria-label="Ticket details">
		{TABS.map(tab => (
			<button
				key={tab.id}
				type="button"
				role="tab"
				id={`jira-tab-${tab.id}`}
				aria-selected={activeTab === tab.id}
				aria-controls={`jira-tabpanel-${tab.id}`}
				className={`@@jira-detail-tabs__tab${activeTab === tab.id ? ' @@jira-detail-tabs__tab--active' : ''}`}
				onClick={() => onTabChange(tab.id)}
			>
				{tab.label}
			</button>
		))}
	</div>
)

export const RequirementTab = ({ text }: { text: string }) => {
	const content = text.trim()
		? formatRequirementsForUI(text, 4000)
		: ''
	if (!content) {
		return (
			<div className="@@jira-tab-empty">
				<p className="@@jira-empty__title">No requirement text available</p>
				<p className="@@jira-empty__hint">Once this ticket has a description in Jira, it will appear here.</p>
			</div>
		)
	}
	const blocks = parseRequirementBlocks(content)
	return (
		<div className="@@jira-tab-content @@jira-tab-content--prose">
			<div className="@@jira-requirement-hero">
				<h3 className="@@jira-plan-section__title">Requirement Brief</h3>
				<p className="@@jira-requirement-hero__hint">Cleaned from Jira description for faster review.</p>
			</div>
			<div className="@@jira-requirement-grid">
				{blocks.map((block, idx) => (
					<section key={`${block.title}-${idx}`} className="@@jira-requirement-card">
						<h4 className="@@jira-requirement-card__title">{block.title}</h4>
						{block.paragraphs.map((line, i) => (
							<p key={i} className="@@jira-prose-p">{line}</p>
						))}
						{block.points.length > 0 && (
							<ul className="@@jira-requirement-list">
								{block.points.map((point, i) => (
									<li key={i} className="@@jira-requirement-list__item">{point}</li>
								))}
							</ul>
						)}
					</section>
				))}
			</div>
		</div>
	)
}

export const ImplementationPlanTab = ({
	sections,
	planMarkdown,
	onGeneratePlan,
	canPlan,
}: {
	sections: PlanSection[]
	planMarkdown: string
	onGeneratePlan: () => void
	canPlan: boolean
}) => {
	if (!planMarkdown.trim()) {
		return (
			<div className="@@jira-tab-empty">
				<p>No implementation plan yet. Click Plan to generate one.</p>
				{canPlan && (
					<button type="button" className="@@jira-btn @@jira-btn--primary" onClick={onGeneratePlan}>
						Generate plan
					</button>
				)}
			</div>
		)
	}

	return (
		<div className="@@jira-tab-content">
			{sections.filter(s => s.body.trim()).length > 0 ? (
				sections.map(section => (
					<section key={section.id} className="@@jira-plan-section">
						<h3 className="@@jira-plan-section__title">{section.title}</h3>
						<div className="@@jira-plan-section__body">
							<ChatMarkdownRender string={section.body} chatMessageLocation={undefined} />
						</div>
					</section>
				))
			) : (
				<div className="@@jira-tab-content--prose">
					<ChatMarkdownRender string={planMarkdown} chatMessageLocation={undefined} />
				</div>
			)}
		</div>
	)
}

export const FilesTab = ({ files }: { files: string[] }) => {
	if (files.length === 0) {
		return (
			<div className="@@jira-tab-empty @@jira-tab-empty--subtle">
				<p>No file changes yet. They will appear after the workflow runs.</p>
			</div>
		)
	}
	return (
		<ul className="@@jira-files-list">
			{files.map(f => (
				<li key={f} className="@@jira-files-list__item">
					<span className="@@jira-files-list__path">{f.split('/').pop()}</span>
					<span className="@@jira-files-list__full">{f}</span>
				</li>
			))}
		</ul>
	)
}

const logIcon = (status: ExecutionLogStep['status']) => {
	switch (status) {
		case 'completed': return '✓'
		case 'running': return '◉'
		case 'failed': return '✕'
		default: return '○'
	}
}

export const ExecutionLogTab = ({ steps }: { steps: ExecutionLogStep[] }) => (
	<ol className="@@jira-exec-log">
		{steps.map(step => (
			<li key={step.id} className={`@@jira-exec-log__item @@jira-exec-log__item--${step.status}`}>
				<span className="@@jira-exec-log__icon" aria-hidden>{logIcon(step.status)}</span>
				<div className="@@jira-exec-log__body">
					<span className="@@jira-exec-log__label">{step.label}</span>
					{step.detail && <span className="@@jira-exec-log__detail">{step.detail}</span>}
				</div>
			</li>
		))}
	</ol>
)
