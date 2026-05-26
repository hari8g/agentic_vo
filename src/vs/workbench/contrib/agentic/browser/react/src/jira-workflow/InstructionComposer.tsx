/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { KeyboardEvent, useCallback, useRef, useState } from 'react'
import { useAccessor } from '../util/services.js'
import { AgenticInputBox2 } from '../util/inputs.js'

export const InstructionComposer = ({
	threadId,
	disabled,
	isStreaming,
}: {
	threadId: string
	disabled: boolean
	isStreaming: boolean
}) => {
	const accessor = useAccessor()
	const chatThreadsService = accessor.get('IChatThreadService')
	const textAreaRef = useRef<HTMLTextAreaElement>(null)
	const textAreaFnsRef = useRef<{ setValue: (v: string) => void } | null>(null)
	const [submitting, setSubmitting] = useState(false)

	const onSubmit = useCallback(async () => {
		const text = textAreaRef.current?.value?.trim()
		if (!text || disabled || isStreaming || submitting) return
		setSubmitting(true)
		try {
			await chatThreadsService.addUserMessageAndStreamResponse({ threadId, userMessage: text })
			textAreaFnsRef.current?.setValue('')
		} finally {
			setSubmitting(false)
		}
	}, [threadId, disabled, isStreaming, submitting, chatThreadsService])

	const onKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
			e.preventDefault()
			void onSubmit()
		}
	}, [onSubmit])

	return (
		<div className="@@jira-instruction-composer">
			<AgenticInputBox2
				enableAtToMention
				className="@@jira-instruction-composer__input"
				placeholder="Add instructions, constraints, or review comments…"
				onKeyDown={onKeyDown}
				ref={textAreaRef}
				fnsRef={textAreaFnsRef}
				multiline
			/>
			<button
				type="button"
				className="@@jira-btn @@jira-btn--primary"
				disabled={disabled || isStreaming || submitting}
				onClick={() => void onSubmit()}
				aria-label="Send instruction"
			>
				Send
			</button>
		</div>
	)
}
