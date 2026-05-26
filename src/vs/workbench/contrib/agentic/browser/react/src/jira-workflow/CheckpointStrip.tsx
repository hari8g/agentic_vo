/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export const CheckpointStrip = ({
	label,
	lastSaved,
	filesChangedCount,
	canRestore,
	onRestore,
}: {
	label: string
	lastSaved: string | null
	filesChangedCount: number
	canRestore: boolean
	onRestore: () => void
}) => (
	<div className="@@jira-checkpoint-strip" aria-label="Checkpoint status">
		<span className="@@jira-checkpoint-strip__item">
			<span className="@@jira-checkpoint-strip__label">Checkpoint</span>
			<span className="@@jira-checkpoint-strip__value">{label}</span>
		</span>
		{lastSaved && (
			<span className="@@jira-checkpoint-strip__item">
				<span className="@@jira-checkpoint-strip__label">Saved</span>
				<span className="@@jira-checkpoint-strip__value">{new Date(lastSaved).toLocaleTimeString()}</span>
			</span>
		)}
		<span className="@@jira-checkpoint-strip__item">
			<span className="@@jira-checkpoint-strip__label">Files</span>
			<span className="@@jira-checkpoint-strip__value">
				{filesChangedCount === 0 ? 'None yet' : `${filesChangedCount} changed`}
			</span>
		</span>
		{canRestore && (
			<button type="button" className="@@jira-btn @@jira-btn--ghost @@jira-checkpoint-strip__restore" onClick={onRestore}>
				Restore checkpoint
			</button>
		)}
	</div>
)
