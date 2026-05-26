/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { CheckpointStrip } from './CheckpointStrip.js'
import { InstructionComposer } from './InstructionComposer.js'
import { IssueListPanel } from './IssueListPanel.js'
import { SelectedIssueWorkspace, WorkflowActionBar } from './SelectedIssueWorkspace.js'
import { useJiraWorkflow } from './useJiraWorkflow.js'
import { WorkflowHeader } from './WorkflowHeader.js'

export const JiraWorkflowPage = () => {
	const wf = useJiraWorkflow()

	if (!wf.atlassianOn) {
		return (
			<p className="@@jira-empty">
				Enable the <strong>atlassian</strong> MCP server in Settings → MCP to use Jira workflow.
			</p>
		)
	}

	if (wf.atlassianError) {
		return (
			<p className="@@jira-empty @@jira-empty--error" role="alert">
				Atlassian MCP error: {wf.atlassianError}
			</p>
		)
	}

	return (
		<div className="@@jira-workflow-page">
			<WorkflowHeader workflowStatus={wf.workflowStatus} />

			<div className="@@jira-workflow-page__body">
				<IssueListPanel
					issues={wf.filteredIssues}
					loading={wf.loading}
					selectedIssueId={wf.selectedIssueId}
					workflowPhaseByIssueKey={wf.workflowPhaseByIssueKey}
					listScope={wf.listScope}
					projectKey={wf.projectKey}
					searchQuery={wf.searchQuery}
					onScopeChange={wf.setListScope}
					onProjectKeyChange={wf.setProjectKey}
					onSearchChange={wf.setSearchQuery}
					onRefresh={wf.refreshIssues}
					onSelect={wf.selectIssue}
					isAvailable={wf.isAvailable}
				/>

				<div className="@@jira-workflow-page__main">
					{wf.error && (
						<div className="@@jira-workflow-page__banner" role="alert">{wf.error}</div>
					)}

					{wf.selectedIssue ? (
						<>
							<SelectedIssueWorkspace
								issue={wf.selectedIssue}
								activeTab={wf.activeDetailTab}
								onTabChange={wf.setActiveDetailTab}
								requirementsText={wf.requirementsText}
								planMarkdown={wf.planMarkdown}
								planSections={wf.planSections}
								changedFiles={wf.changedFiles}
								executionSteps={wf.executionSteps}
								workflowStatus={wf.workflowStatus}
								canPlan={wf.canPlan}
								onGeneratePlan={wf.onPlan}
							/>
							<CheckpointStrip
								label={wf.checkpointLabel}
								lastSaved={wf.checkpointTime}
								filesChangedCount={wf.changedFiles.length}
								canRestore={wf.canRestoreCheckpoint}
								onRestore={wf.onRestoreCheckpoint}
							/>
							<WorkflowActionBar
								hasSelection={!!wf.selectedIssueId}
								canPlan={wf.canPlan}
								canApprove={wf.canApprove}
								canRevise={wf.canRevise}
								running={wf.running || wf.isStreaming}
								onPlan={wf.onPlan}
								onReviewPlan={wf.onReviewPlan}
								onApproveAndRun={wf.onApproveAndRun}
								onRevisePlan={wf.onRevisePlan}
								onReject={wf.onReject}
							/>
						</>
					) : (
						<div className="@@jira-workspace @@jira-workspace--empty">
							<div className="@@jira-empty">
								<p className="@@jira-empty__title">No ticket selected</p>
								<p className="@@jira-empty__hint">Select a Jira issue to generate an implementation plan.</p>
							</div>
						</div>
					)}

					<InstructionComposer
						threadId={wf.threadId}
						disabled={!wf.selectedIssueId}
						isStreaming={wf.isStreaming}
					/>
				</div>
			</div>
		</div>
	)
}
