/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { JiraTicketSummary } from '../../../../common/jiraTypes.js'
import { JiraIssueListScope } from '../../../jiraTicketService.js'

export type WorkflowStatus =
	| 'idle'
	| 'planning'
	| 'plan_ready'
	| 'running'
	| 'awaiting_approval'
	| 'completed'
	| 'failed'

export type DetailTab = 'requirement' | 'plan' | 'files' | 'log'

export type WorkflowStepId = 'select' | 'plan' | 'review' | 'run' | 'done'

export type LogStepStatus = 'pending' | 'running' | 'completed' | 'failed'

export type ExecutionLogStep = {
	id: string
	label: string
	status: LogStepStatus
	detail?: string
}

export type PlanSection = {
	id: string
	title: string
	body: string
}

export type SelectedIssueDetail = JiraTicketSummary & {
	description?: string
	projectKey?: string
	priority?: string
}

export type JiraWorkflowContext = {
	issues: JiraTicketSummary[]
	filteredIssues: JiraTicketSummary[]
	selectedIssueId: string | null
	selectedIssue: SelectedIssueDetail | null
	workflowStatus: WorkflowStatus
	activeDetailTab: DetailTab
	listScope: JiraIssueListScope
	projectKey: string
	searchQuery: string
	loading: boolean
	error: string | null
	running: boolean
	isAvailable: boolean
	requirementsText: string
	planMarkdown: string
	planSections: PlanSection[]
	executionSteps: ExecutionLogStep[]
	changedFiles: string[]
	checkpointLabel: string
	checkpointTime: string | null
	canApprove: boolean
	canPlan: boolean
	canRevise: boolean
}
