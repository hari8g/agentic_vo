/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js'
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js'
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js'
import { IMCPService } from '../common/mcpService.js'
import { removeMCPToolNamePrefix } from '../common/mcpServiceTypes.js'
import { JIRA_EXECUTE_USER_PREFIX, JiraTicketSummary, LinkedJiraIssue } from '../common/jiraTypes.js'
import { formatRequirementsForUI, JIRA_DESC_PROMPT_MAX, summarizePlanForPrompt, truncateForPrompt } from '../common/jiraTextUtils.js'

export const ATLASSIAN_MCP_SERVER_NAME = 'atlassian'

export type JiraIssueListScope = 'assigned' | 'project' | 'recent'

export interface IJiraTicketService {
	readonly _serviceBrand: undefined
	isAtlassianAvailable(): boolean
	listMyIssues(opts?: { jql?: string, maxResults?: number, scope?: JiraIssueListScope, projectKey?: string }): Promise<JiraTicketSummary[]>
	fetchIssue(issueKey: string): Promise<LinkedJiraIssue>
	buildPlanTicketUserMessage(issue: LinkedJiraIssue): string
	buildExecuteAfterApprovalMessage(issue: LinkedJiraIssue, planMarkdown: string): string
	finalizeTicket(issue: LinkedJiraIssue, opts: { commentMarkdown: string, preferredTransitionNames?: string[] }): Promise<{ success: boolean, message: string }>
}

export const IJiraTicketService = createDecorator<IJiraTicketService>('jiraTicketService')

class JiraTicketService extends Disposable implements IJiraTicketService {
	_serviceBrand: undefined

	private _cloudIdCache: string | undefined

	constructor(
		@IMCPService private readonly mcpService: IMCPService,
	) {
		super()
	}

	isAtlassianAvailable(): boolean {
		const server = this.mcpService.state.mcpServerOfName[ATLASSIAN_MCP_SERVER_NAME]
		return !!server && server.status === 'success' && (server.tools?.length ?? 0) > 0
	}

	async listMyIssues(opts?: { jql?: string, maxResults?: number, scope?: JiraIssueListScope, projectKey?: string }): Promise<JiraTicketSummary[]> {
		const cloudId = await this._resolveCloudId()
		const maxResults = Math.min(opts?.maxResults ?? 100, 100)
		const scope = opts?.scope ?? 'assigned'
		const jql = opts?.jql ?? this._jqlForScope(scope, opts?.projectKey)

		const searchTool = this._findTool(['searchJiraIssuesUsingJql', 'search_jira_issues_using_jql'])
		if (searchTool) {
			return this._searchIssuesPaginated(searchTool, cloudId, jql, maxResults)
		}

		const assignedTool = this._findTool(['issues_assigned_to_me', 'issuesAssignedToMe'])
		if (assignedTool && scope === 'assigned') {
			const text = await this._callTool(assignedTool, { cloudId, maxResults })
			return this._parseIssueList(text).slice(0, maxResults)
		}

		const searchTool2 = this._findTool(['atlassian_search', 'search'])
		if (searchTool2) {
			const text = await this._callTool(searchTool2, {
				query: scope === 'project' && opts?.projectKey
					? `issues in project ${opts.projectKey}`
					: 'my jira issues',
			})
			return this._parseIssueList(text).slice(0, maxResults)
		}

		throw new Error('No Jira list/search MCP tool found on the Atlassian server. Enable the atlassian MCP server in Settings → MCP.')
	}

	private _jqlForScope(scope: JiraIssueListScope, projectKey?: string): string {
		switch (scope) {
			case 'project':
				if (projectKey?.trim()) {
					return `project = "${projectKey.trim().toUpperCase()}" ORDER BY updated DESC`
				}
				return 'ORDER BY updated DESC'
			case 'recent':
				return 'updated >= -90d ORDER BY updated DESC'
			case 'assigned':
			default:
				return 'assignee = currentUser() ORDER BY updated DESC'
		}
	}

	private async _searchIssuesPaginated(
		searchTool: { toolName: string, serverName: string },
		cloudId: string,
		jql: string,
		maxResults: number,
	): Promise<JiraTicketSummary[]> {
		const pageSize = 50
		const seen = new Set<string>()
		const merged: JiraTicketSummary[] = []
		let startAt = 0

		while (merged.length < maxResults) {
			const text = await this._callTool(searchTool, {
				cloudId,
				jql,
				maxResults: Math.min(pageSize, maxResults - merged.length),
				startAt,
			})
			const page = this._parseIssueList(text)
			if (page.length === 0) {
				break
			}
			for (const issue of page) {
				const id = issue.key.toUpperCase()
				if (!id || seen.has(id)) {
					continue
				}
				seen.add(id)
				merged.push(issue)
				if (merged.length >= maxResults) {
					break
				}
			}
			if (page.length < pageSize) {
				break
			}
			startAt += page.length
		}

		return merged
	}

	async fetchIssue(issueKey: string): Promise<LinkedJiraIssue> {
		const cloudId = await this._resolveCloudId()
		const getTool = this._findTool(['getJiraIssue', 'get_jira_issue', 'issues_get_detail', 'get_issue'])
		if (!getTool) {
			throw new Error('No Jira get-issue MCP tool found on the Atlassian server.')
		}

		const text = await this._callTool(getTool, {
			cloudId,
			issueIdOrKey: issueKey,
			issueKey,
			key: issueKey,
		})

		return this._parseIssueDetail(text, issueKey, cloudId)
	}

	buildPlanTicketUserMessage(issue: LinkedJiraIssue): string {
		const desc = truncateForPrompt(formatRequirementsForUI(issue.description, JIRA_DESC_PROMPT_MAX), JIRA_DESC_PROMPT_MAX)
		return [
			`Plan implementation for JIRA ${issue.key}: ${issue.summary}`,
			'',
			`Requirements (summary):`,
			desc,
			'',
			'Tasks: (1) Use read-only tools only. (2) Output a concise implementation plan: scope, files, steps, tests, Jira note you will post. (3) End with [[JIRA_PLAN_READY]] on its own line.',
		].join('\n')
	}

	buildExecuteAfterApprovalMessage(issue: LinkedJiraIssue, planMarkdown: string): string {
		const planDigest = summarizePlanForPrompt(planMarkdown)
		return [
			`${JIRA_EXECUTE_USER_PREFIX} ${issue.key}. cloudId=${issue.cloudId}`,
			'',
			'## Plan (digest)',
			planDigest,
			'',
			'Tasks: Implement in workspace using edit_file or rewrite_file (required). Run tests if needed. Agentic updates Jira only after real file edits — end with [[JIRA_WORKFLOW_COMPLETE]] on its own line after edits succeed. Do not ask for approvals.',
		].join('\n')
	}

	async finalizeTicket(
		issue: LinkedJiraIssue,
		opts: { commentMarkdown: string, preferredTransitionNames?: string[] },
	): Promise<{ success: boolean, message: string }> {
		const cloudId = issue.cloudId || await this._resolveCloudId()
		const preferred = opts.preferredTransitionNames ?? ['Done', 'Complete', 'Resolved', 'In Review', 'Ready for Review', 'To Do']

		let commentOk = false
		let transitionOk = false
		const errors: string[] = []

		const commentTool = this._findTool([
			'addCommentToJiraIssue', 'add_comment_to_jira_issue', 'jira_add_comment', 'add_comment',
		])
		if (commentTool) {
			try {
				const body = opts.commentMarkdown.trim()
				await this._callTool(commentTool, {
					cloudId,
					issueIdOrKey: issue.key,
					issueKey: issue.key,
					key: issue.key,
					commentBody: body,
					body,
					comment: body,
					text: body,
				})
				commentOk = true
			} catch (e) {
				errors.push(`comment: ${e instanceof Error ? e.message : String(e)}`)
			}
		} else {
			errors.push('comment: no add-comment MCP tool found')
		}

		const transitionsTool = this._findTool([
			'getTransitionsForJiraIssue', 'get_transitions_for_jira_issue', 'jira_get_transitions', 'get_transitions',
		])
		const transitionTool = this._findTool([
			'transitionJiraIssue', 'transition_jira_issue', 'jira_transition_issue', 'update_status',
		])

		if (transitionsTool && transitionTool) {
			try {
				const transitionsText = await this._callTool(transitionsTool, {
					cloudId,
					issueIdOrKey: issue.key,
					issueKey: issue.key,
					key: issue.key,
				})
				const transitionId = this._pickTransitionId(transitionsText, preferred)
				if (transitionId) {
					await this._callTool(transitionTool, {
						cloudId,
						issueIdOrKey: issue.key,
						issueKey: issue.key,
						key: issue.key,
						transition: { id: transitionId },
						transitionId,
						id: transitionId,
					})
					transitionOk = true
				} else {
					errors.push('transition: no matching transition in workflow')
				}
			} catch (e) {
				errors.push(`transition: ${e instanceof Error ? e.message : String(e)}`)
			}
		} else {
			errors.push('transition: MCP transition tools not found')
		}

		if (commentOk && transitionOk) {
			return { success: true, message: `Jira updated: comment added and status transitioned for ${issue.key}.` }
		}
		if (commentOk) {
			return { success: true, message: `Comment added on ${issue.key}. Status transition failed: ${errors.join('; ')}` }
		}
		return { success: false, message: errors.join('; ') || 'Failed to update Jira' }
	}

	private _pickTransitionId(transitionsText: string, preferredNames: string[]): string | undefined {
		try {
			const json = JSON.parse(transitionsText)
			const list = json.transitions ?? json.values ?? (Array.isArray(json) ? json : [])
			if (!Array.isArray(list)) return undefined
			const normalized = list.map((t: Record<string, unknown>) => {
				const to = t.to as Record<string, unknown> | undefined
				return {
					id: String(t.id ?? t.transitionId ?? ''),
					name: String(t.name ?? to?.name ?? ''),
				}
			}).filter(t => t.id)

			for (const pref of preferredNames) {
				const match = normalized.find(t => t.name.toLowerCase() === pref.toLowerCase())
				if (match) return match.id
			}
			for (const pref of preferredNames) {
				const match = normalized.find(t => t.name.toLowerCase().includes(pref.toLowerCase()))
				if (match) return match.id
			}
			return normalized[0]?.id
		} catch {
			const idMatch = transitionsText.match(/"id"\s*:\s*"(\d+)"/)
			return idMatch?.[1]
		}
	}

	private async _resolveCloudId(): Promise<string> {
		if (this._cloudIdCache) return this._cloudIdCache

		const resourcesTool = this._findTool([
			'getAccessibleAtlassianResources',
			'get_accessible_atlassian_resources',
		])
		if (resourcesTool) {
			const text = await this._callTool(resourcesTool, {})
			const cloudId = this._extractCloudId(text)
			if (cloudId) {
				this._cloudIdCache = cloudId
				return cloudId
			}
		}

		throw new Error('Could not resolve Atlassian cloudId. Ensure the atlassian MCP server is connected and authorized.')
	}

	private _findTool(nameSuffixes: string[]): { toolName: string, serverName: string } | undefined {
		const tools = this.mcpService.getMCPTools() ?? []
		for (const tool of tools) {
			if (tool.mcpServerName !== ATLASSIAN_MCP_SERVER_NAME) continue
			const base = removeMCPToolNamePrefix(tool.name)
			const normalized = base.toLowerCase().replace(/-/g, '_')
			for (const suffix of nameSuffixes) {
				if (normalized === suffix.toLowerCase() || normalized.endsWith(suffix.toLowerCase())) {
					return { toolName: tool.name, serverName: ATLASSIAN_MCP_SERVER_NAME }
				}
			}
		}
		return undefined
	}

	private async _callTool(
		tool: { toolName: string, serverName: string },
		params: Record<string, unknown>,
	): Promise<string> {
		const { result } = await this.mcpService.callMCPTool({
			serverName: tool.serverName,
			toolName: tool.toolName,
			params,
		})
		return this.mcpService.stringifyResult(result)
	}

	private _extractCloudId(text: string): string | undefined {
		try {
			const json = JSON.parse(text)
			if (typeof json.cloudId === 'string') return json.cloudId
			if (Array.isArray(json) && json[0]?.id) return String(json[0].id)
			if (Array.isArray(json?.resources) && json.resources[0]?.id) return String(json.resources[0].id)
		} catch { /* markdown or plain text */ }

		const match = text.match(/cloudId["\s:]+([a-f0-9-]{36})/i)
			?? text.match(/"id"\s*:\s*"([a-f0-9-]{36})"/i)
		return match?.[1]
	}

	private _parseIssueList(text: string): JiraTicketSummary[] {
		const fromJson = this._parseIssueListFromJson(text)
		if (fromJson.length) {
			return fromJson
		}

		const summaries: JiraTicketSummary[] = []
		const seen = new Set<string>()

		const add = (key: string, summary: string, status?: string) => {
			const k = key.toUpperCase()
			if (!k || seen.has(k)) {
				return
			}
			seen.add(k)
			summaries.push({ key: k, summary: summary.trim(), status })
		}

		// KEY-123 — summary (Status) or KEY-123: summary
		const lineRe = /([A-Z][A-Z0-9]+-\d+)\s*[-:–]\s*([^\n|]+?)(?:\s*[\[(]([^)\]]+)[\])])?(?:\s*$|\s*\|)/gm
		let m: RegExpExecArray | null
		while ((m = lineRe.exec(text)) !== null) {
			add(m[1], m[2], m[3]?.trim())
		}

		// Markdown table rows: | KEY-1 | summary | Done |
		const tableRe = /\|\s*([A-Z][A-Z0-9]+-\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|/g
		while ((m = tableRe.exec(text)) !== null) {
			const status = m[3]?.trim()
			add(m[1], m[2], status || undefined)
		}

		// Bare keys with summary on next line
		const blockRe = /([A-Z][A-Z0-9]+-\d+)\s*\n\s*([^\n]+)/g
		while ((m = blockRe.exec(text)) !== null) {
			add(m[1], m[2])
		}

		if (summaries.length) {
			return summaries
		}

		throw new Error(`Could not parse Jira issue list from MCP response. Response preview: ${text.slice(0, 400)}`)
	}

	private _parseIssueListFromJson(text: string): JiraTicketSummary[] {
		try {
			const json = JSON.parse(text)
			const issues = json.issues ?? json.values ?? json.results ?? json.data?.issues ?? (Array.isArray(json) ? json : [])
			if (Array.isArray(issues)) {
				return issues.map((issue: Record<string, unknown>) => this._issueToSummary(issue)).filter(i => !!i.key)
			}
		} catch { /* fall through */ }
		return []
	}

	private _parseIssueDetail(text: string, issueKey: string, cloudId: string): LinkedJiraIssue {
		try {
			const json = JSON.parse(text)
			const fields = (json.fields ?? json) as Record<string, unknown>
			const summary = String(fields.summary ?? json.summary ?? issueKey)
			const description = this._fieldToDescription(fields.description ?? json.description)
			const status = this._nestedName(fields.status ?? json.status)
			return { key: issueKey, summary, description, status, cloudId }
		} catch { /* markdown */ }

		return {
			key: issueKey,
			summary: issueKey,
			description: text,
			cloudId,
		}
	}

	private _issueToSummary(issue: Record<string, unknown>): JiraTicketSummary {
		const key = String(issue.key ?? issue.issueKey ?? '')
		const fields = (issue.fields ?? {}) as Record<string, unknown>
		const summary = String(fields.summary ?? issue.summary ?? key)
		const status = this._nestedName(fields.status ?? issue.status)
		const assignee = this._nestedName(fields.assignee ?? issue.assignee)
		return { key, summary, status, assignee }
	}

	private _nestedName(val: unknown): string | undefined {
		if (!val || typeof val !== 'object') return typeof val === 'string' ? val : undefined
		const o = val as Record<string, unknown>
		return typeof o.name === 'string' ? o.name : undefined
	}

	private _fieldToDescription(val: unknown): string {
		if (!val) return ''
		if (typeof val === 'string') return val
		if (typeof val === 'object') {
			const content = (val as Record<string, unknown>).content
			if (Array.isArray(content)) {
				return content.map((c: Record<string, unknown>) => {
					if (c.type === 'text' && typeof c.text === 'string') return c.text
					return ''
				}).join('\n')
			}
		}
		return JSON.stringify(val, null, 2)
	}
}

registerSingleton(IJiraTicketService, JiraTicketService, InstantiationType.Eager)
