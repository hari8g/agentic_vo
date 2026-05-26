/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useIsDark } from '../util/services.js';
import '../styles.css'
import { SidebarChat } from './SidebarChat.js';
import { JiraTicketPanel } from './JiraTicketPanel.js';
import ErrorBoundary from './ErrorBoundary.js';

export const Sidebar = ({ className }: { className: string }) => {

	const isDark = useIsDark()
	return <div
		className={`@@agentic-scope ${isDark ? 'dark' : ''}`}
		style={{ width: '100%', height: '100%' }}
	>
		<div
			className="w-full h-full flex flex-col min-h-0 bg-agentic-bg-2 text-agentic-fg-1"
		>
			<ErrorBoundary>
				<div className="@@jira-workflow-slot flex flex-col min-h-0 min-w-0 overflow-hidden">
					<JiraTicketPanel />
				</div>
			</ErrorBoundary>
			<div className="flex-1 min-h-[120px] w-full overflow-hidden">
				<ErrorBoundary>
					<SidebarChat />
				</ErrorBoundary>
			</div>
		</div>
	</div>
}
