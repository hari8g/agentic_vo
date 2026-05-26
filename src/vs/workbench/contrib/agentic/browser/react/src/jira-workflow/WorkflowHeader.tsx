/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { LogStepStatus, WorkflowStatus, WorkflowStepId } from './types.js'
import { subtitleForStatus, workflowStepState } from './jiraWorkflowUtils.js'

const STEPS: { id: WorkflowStepId, label: string }[] = [
	{ id: 'select', label: 'Select' },
	{ id: 'plan', label: 'Plan' },
	{ id: 'review', label: 'Review' },
	{ id: 'run', label: 'Run' },
	{ id: 'done', label: 'Done' },
]

const stepDotClass = (status: LogStepStatus, isActive: boolean): string => {
	if (status === 'failed') return '@@jira-wf-step__dot @@jira-wf-step__dot--failed'
	if (status === 'running' || isActive) return '@@jira-wf-step__dot @@jira-wf-step__dot--active'
	if (status === 'completed') return '@@jira-wf-step__dot @@jira-wf-step__dot--done'
	return '@@jira-wf-step__dot'
}

export const WorkflowHeader = ({ workflowStatus }: { workflowStatus: WorkflowStatus }) => {
	const steps = workflowStepState(workflowStatus)
	const activeIdx = STEPS.findIndex(s => steps[s.id] === 'running')

	return (
		<header className="@@jira-wf-header">
			<div className="@@jira-wf-header__titles">
				<h1 className="@@jira-wf-header__title">Jira Workflow</h1>
				<p className="@@jira-wf-header__subtitle">{subtitleForStatus(workflowStatus)}</p>
			</div>
			<nav className="@@jira-wf-steps" aria-label="Workflow progress">
				{STEPS.map((step, i) => {
					const status = steps[step.id]
					const isActive = i === activeIdx || status === 'running'
					return (
						<div key={step.id} className="@@jira-wf-step" aria-current={isActive ? 'step' : undefined}>
							<span className={stepDotClass(status, isActive)} aria-hidden />
							<span className={`@@jira-wf-step__label${isActive ? ' @@jira-wf-step__label--active' : ''}`}>
								{step.label}
							</span>
							{i < STEPS.length - 1 && <span className="@@jira-wf-step__connector" aria-hidden />}
						</div>
					)
				})}
			</nav>
		</header>
	)
}
