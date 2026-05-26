// Normally you'd want to put these exports in the files that register them, but if you do that you'll get an import order error if you import them in certain cases.
// (importing them runs the whole file to get the ID, causing an import error). I guess it's best practice to separate out IDs, pretty annoying...

export const AGENTIC_CTRL_L_ACTION_ID = 'agentic.ctrlLAction'

export const AGENTIC_CTRL_K_ACTION_ID = 'agentic.ctrlKAction'

export const AGENTIC_ACCEPT_DIFF_ACTION_ID = 'agentic.acceptDiff'

export const AGENTIC_REJECT_DIFF_ACTION_ID = 'agentic.rejectDiff'

export const AGENTIC_GOTO_NEXT_DIFF_ACTION_ID = 'agentic.goToNextDiff'

export const AGENTIC_GOTO_PREV_DIFF_ACTION_ID = 'agentic.goToPrevDiff'

export const AGENTIC_GOTO_NEXT_URI_ACTION_ID = 'agentic.goToNextUri'

export const AGENTIC_GOTO_PREV_URI_ACTION_ID = 'agentic.goToPrevUri'

export const AGENTIC_ACCEPT_FILE_ACTION_ID = 'agentic.acceptFile'

export const AGENTIC_REJECT_FILE_ACTION_ID = 'agentic.rejectFile'

export const AGENTIC_ACCEPT_ALL_DIFFS_ACTION_ID = 'agentic.acceptAllDiffs'

export const AGENTIC_REJECT_ALL_DIFFS_ACTION_ID = 'agentic.rejectAllDiffs'
