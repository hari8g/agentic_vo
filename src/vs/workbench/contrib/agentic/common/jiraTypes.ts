/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export type JiraTicketSummary = {
	key: string
	summary: string
	status?: string
	assignee?: string
}

export type LinkedJiraIssue = {
	key: string
	summary: string
	description: string
	status?: string
	cloudId: string
	siteUrl?: string
}

export type JiraWorkflowPhase = 'planning' | 'awaiting_plan_approval' | 'executing' | 'completed'

export type JiraFinalizeStatus = 'pending' | 'success' | 'error'

export type JiraWorkflowState = {
	phase: JiraWorkflowPhase
	/** Full plan for sidebar UI */
	planMarkdown?: string
	/** Short plan digest sent to the model on execute */
	planSummary?: string
	/** Cleaned ticket description for sidebar */
	requirementsSummary?: string
	jiraFinalizeStatus?: JiraFinalizeStatus
	jiraFinalizeMessage?: string
}

export const JIRA_PLAN_READY_MARKER = '[[JIRA_PLAN_READY]]'
export const JIRA_WORKFLOW_COMPLETE_MARKER = '[[JIRA_WORKFLOW_COMPLETE]]'
/** User message that starts the post-approval execution phase (used to trim planning history for the model). */
export const JIRA_EXECUTE_USER_PREFIX = 'Execute approved plan for JIRA'
