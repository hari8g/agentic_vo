import { URI } from '../../../../base/common/uri.js';

export type AgenticDirectoryItem = {
	uri: URI;
	name: string;
	isSymbolicLink: boolean;
	children: AgenticDirectoryItem[] | null;
	isDirectory: boolean;
	isGitIgnoredDirectory: false | { numChildren: number }; // if directory is gitignored, we ignore children
}
