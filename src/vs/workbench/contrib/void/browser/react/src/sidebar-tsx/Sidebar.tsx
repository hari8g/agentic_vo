/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useIsDark } from '../util/services.js';
// import { SidebarThreadSelector } from './SidebarThreadSelector.js';
// import { SidebarChat } from './SidebarChat.js';

import '../styles.css'
import { SidebarChat } from './SidebarChat.js';
import { JiraTicketPanel } from './JiraTicketPanel.js';
import ErrorBoundary from './ErrorBoundary.js';

export const Sidebar = ({ className }: { className: string }) => {

	const isDark = useIsDark()
	return <div
		className={`@@void-scope ${isDark ? 'dark' : ''}`}
		style={{ width: '100%', height: '100%' }}
	>
		<div
			className={`
				w-full h-full flex flex-col min-h-0
				bg-void-bg-2
				text-void-fg-1
			`}
		>
			<ErrorBoundary>
				<div className="shrink-0 px-2 pt-2 pb-1">
					<JiraTicketPanel defaultExpanded />
				</div>
			</ErrorBoundary>
			<div className="flex-1 min-h-0 w-full">
				<ErrorBoundary>
					<SidebarChat />
				</ErrorBoundary>
			</div>
		</div>
	</div>


}

