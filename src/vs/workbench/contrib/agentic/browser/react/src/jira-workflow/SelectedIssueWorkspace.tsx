/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { DetailTab, ExecutionLogStep, PlanSection, SelectedIssueDetail, WorkflowStatus } from './types.js'
import {
	DetailTabs,
	ExecutionLogTab,
	FilesTab,
	ImplementationPlanTab,
	IssueMetadataBar,
	RequirementTab,
} from './WorkspaceTabs.js'

export const SelectedIssueWorkspace = ({
	issue,
	activeTab,
	onTabChange,
	requirementsText,
	planMarkdown,
	planSections,
	changedFiles,
	executionSteps,
	workflowStatus,
	canPlan,
	onGeneratePlan,
}: {
	issue: SelectedIssueDetail
	activeTab: DetailTab
	onTabChange: (tab: DetailTab) => void
	requirementsText: string
	planMarkdown: string
	planSections: PlanSection[]
	changedFiles: string[]
	executionSteps: ExecutionLogStep[]
	workflowStatus: WorkflowStatus
	canPlan: boolean
	onGeneratePlan: () => void
}) => (
	<section className="@@jira-workspace" aria-label="Selected ticket workspace">
		<IssueMetadataBar issue={issue} />
		<DetailTabs activeTab={activeTab} onTabChange={onTabChange} />
		<div
			className="@@jira-workspace__panel agentic-scrollable-element"
			role="tabpanel"
			id={`jira-tabpanel-${activeTab}`}
			aria-labelledby={`jira-tab-${activeTab}`}
		>
			{activeTab === 'requirement' && (
				<RequirementTab text={requirementsText || issue.description || ''} />
			)}
			{activeTab === 'plan' && (
				<ImplementationPlanTab
					sections={planSections}
					planMarkdown={planMarkdown}
					onGeneratePlan={onGeneratePlan}
					canPlan={canPlan}
				/>
			)}
			{activeTab === 'files' && <FilesTab files={changedFiles} />}
			{activeTab === 'log' && <ExecutionLogTab steps={executionSteps} />}
		</div>
		{workflowStatus === 'failed' && (
			<div className="@@jira-workspace__error" role="alert">
				Workflow failed. Review the execution log and retry from the action bar.
			</div>
		)}
	</section>
)

export const WorkflowActionBar = ({
	canPlan,
	canApprove,
	canRevise,
	running,
	onPlan,
	onReviewPlan,
	onApproveAndRun,
	onRevisePlan,
	onReject,
	hasSelection,
}: {
	canPlan: boolean
	canApprove: boolean
	canRevise: boolean
	running: boolean
	onPlan: () => void
	onReviewPlan: () => void
	onApproveAndRun: () => void
	onRevisePlan: () => void
	onReject: () => void
	hasSelection: boolean
}) => {
	if (!hasSelection) return null

	return (
		<footer className="@@jira-action-bar" aria-label="Workflow actions">
			<div className="@@jira-action-bar__secondary">
				<button type="button" className="@@jira-btn @@jira-btn--ghost" disabled={running} onClick={onReject}>
					Reject
				</button>
				<button type="button" className="@@jira-btn @@jira-btn--ghost" disabled={!canRevise || running} onClick={onRevisePlan}>
					Revise Plan
				</button>
				<button type="button" className="@@jira-btn @@jira-btn--ghost" disabled={running} onClick={onReviewPlan}>
					Review Plan
				</button>
				<button type="button" className="@@jira-btn @@jira-btn--ghost" disabled={!canPlan || running} onClick={onPlan}>
					Plan
				</button>
			</div>
			<button
				type="button"
				className="@@jira-btn @@jira-btn--primary @@jira-btn--cta"
				disabled={!canApprove || running}
				onClick={onApproveAndRun}
				aria-label="Approve and run implementation plan"
			>
				{running ? 'Working…' : 'Approve & Run'}
			</button>
		</footer>
	)
}
