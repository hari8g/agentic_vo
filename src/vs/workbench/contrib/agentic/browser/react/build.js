/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { execSync } from 'child_process';
import { spawn } from 'cross-spawn'
// Added lines below
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function doesPathExist(filePath) {
	try {
		const stats = fs.statSync(filePath);

		return stats.isFile();
	} catch (err) {
		if (err.code === 'ENOENT') {
			return false;
		}
		throw err;
	}
}

/*

This function finds `globalDesiredPath` given `localDesiredPath` and `currentPath`

Diagram:

...basePath/
└── agentic/
	├── ...currentPath/ (defined globally)
	└── ...localDesiredPath/ (defined locally)

*/
function findDesiredPathFromLocalPath(localDesiredPath, currentPath) {

	// walk upwards until currentPath + localDesiredPath exists
	while (!doesPathExist(path.join(currentPath, localDesiredPath))) {
		const parentDir = path.dirname(currentPath);

		if (parentDir === currentPath) {
			return undefined;
		}

		currentPath = parentDir;
	}

	// return the `globallyDesiredPath`
	const globalDesiredPath = path.join(currentPath, localDesiredPath)
	return globalDesiredPath;
}

// hack to refresh styles automatically
function saveStylesFile() {
	setTimeout(() => {
		try {
			const pathToCssFile = findDesiredPathFromLocalPath('./src/vs/workbench/contrib/agentic/browser/react/src2/styles.css', __dirname);

			if (pathToCssFile === undefined) {
				console.error('[scope-tailwind] Error finding styles.css');
				return;
			}

			// Or re-write with the same content:
			const content = fs.readFileSync(pathToCssFile, 'utf8');
			fs.writeFileSync(pathToCssFile, content, 'utf8');
			console.log('[scope-tailwind] Force-saved styles.css');
		} catch (err) {
			console.error('[scope-tailwind] Error saving styles.css:', err);
		}
	}, 6000);
}

/** Dev app loads from out/vs/.../react/out — tsup writes to ./out beside src; keep them in sync. */
const WORKBENCH_REACT_OUT_REL = 'out/vs/workbench/contrib/agentic/browser/react/out';

function findRepoRoot(startDir) {
	let currentPath = startDir;
	while (currentPath !== path.dirname(currentPath)) {
		if (doesPathExist(path.join(currentPath, 'product.json'))) {
			return currentPath;
		}
		currentPath = path.dirname(currentPath);
	}
	return undefined;
}

function syncReactBundleToWorkbenchOut() {
	const localOut = path.join(__dirname, 'out');
	const repoRoot = findRepoRoot(__dirname);

	if (!fs.existsSync(localOut)) {
		console.warn('[buildreact] Local ./out missing — run tsup first');
		return false;
	}
	if (repoRoot === undefined) {
		console.warn('[buildreact] Could not find repo root (product.json)');
		return false;
	}

	const destOut = path.join(repoRoot, WORKBENCH_REACT_OUT_REL);
	fs.mkdirSync(destOut, { recursive: true });
	fs.cpSync(localOut, destOut, { recursive: true, force: true });
	console.log(`[buildreact] Synced bundle → ${destOut}`);
	return true;
}

const args = process.argv.slice(2);
const isWatch = args.includes('--watch') || args.includes('-w');
const syncOnly = args.includes('--sync-only');

if (syncOnly) {
	if (!syncReactBundleToWorkbenchOut()) {
		process.exit(1);
	}
	process.exit(0);
}

if (isWatch) {
	// this just builds it if it doesn't exist instead of waiting for the watcher to trigger
	// Check if src2/ exists; if not, do an initial scope-tailwind build
	if (!fs.existsSync('src2')) {
		try {
			console.log('🔨 Running initial scope-tailwind build to create src2 folder...');
			execSync(
				'npx scope-tailwind ./src -o src2/ -s agentic-scope -c styles.css -p "agentic-"',
				{ stdio: 'inherit' }
			);
			console.log('✅ src2/ created successfully.');
		} catch (err) {
			console.error('❌ Error running initial scope-tailwind build:', err);
			process.exit(1);
		}
	}

	// Watch mode
	const scopeTailwindWatcher = spawn('npx', [
		'nodemon',
		'--watch', 'src',
		'--ext', 'ts,tsx,css',
		'--exec',
		'npx scope-tailwind ./src -o src2/ -s agentic-scope -c styles.css -p "agentic-"'
	]);

	const tsupWatcher = spawn('npx', [
		'tsup',
		'--watch'
	]);

	scopeTailwindWatcher.stdout.on('data', (data) => {
		console.log(`[scope-tailwind] ${data}`);
		// If the output mentions "styles.css", trigger the save:
		if (data.toString().includes('styles.css')) {
			saveStylesFile();
		}
	});

	scopeTailwindWatcher.stderr.on('data', (data) => {
		console.error(`[scope-tailwind] ${data}`);
	});

	// Handle tsup watcher output
	tsupWatcher.stdout.on('data', (data) => {
		console.log(`[tsup] ${data}`);
		const text = data.toString();
		if (text.includes('Build success') || text.includes('⚡️ Build success')) {
			syncReactBundleToWorkbenchOut();
		}
	});

	tsupWatcher.stderr.on('data', (data) => {
		console.error(`[tsup] ${data}`);
	});

	// Handle process termination
	process.on('SIGINT', () => {
		scopeTailwindWatcher.kill();
		tsupWatcher.kill();
		process.exit();
	});

	console.log('🔄 Watchers started! Press Ctrl+C to stop both watchers.');
} else {
	// Build mode
	console.log('📦 Building...');

	// Run scope-tailwind once
	execSync('npx scope-tailwind ./src -o src2/ -s agentic-scope -c styles.css -p "agentic-"', { stdio: 'inherit' });

	// Run tsup once
	execSync('npx tsup', { stdio: 'inherit' });

	syncReactBundleToWorkbenchOut();
	console.log('✅ Build complete!');
}
