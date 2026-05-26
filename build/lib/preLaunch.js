"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-check
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const rootDir = path_1.default.resolve(__dirname, '..', '..');
function runProcess(command, args = []) {
    return new Promise((resolve, reject) => {
        const child = (0, child_process_1.spawn)(command, args, { cwd: rootDir, stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
        child.on('exit', err => !err ? resolve() : process.exit(err ?? 1));
        child.on('error', reject);
    });
}
async function exists(subdir) {
    try {
        await fs_1.promises.stat(path_1.default.join(rootDir, subdir));
        return true;
    }
    catch {
        return false;
    }
}
async function ensureNodeModules() {
    if (!(await exists('node_modules'))) {
        await runProcess(npm, ['ci']);
    }
}
async function getElectron() {
    await runProcess(npm, ['run', 'electron']);
}
async function ensureReactBuilt() {
    const reactOutSrc = path_1.default.join(rootDir, 'src/vs/workbench/contrib/agentic/browser/react/out/sidebar-tsx/index.js');
    const reactOutDest = path_1.default.join(rootDir, 'out/vs/workbench/contrib/agentic/browser/react/out/sidebar-tsx/index.js');
    const reactSources = [
        path_1.default.join(rootDir, 'src/vs/workbench/contrib/agentic/browser/react/src/sidebar-tsx/JiraTicketPanel.tsx'),
        path_1.default.join(rootDir, 'src/vs/workbench/contrib/agentic/browser/react/src/sidebar-tsx/Sidebar.tsx'),
        path_1.default.join(rootDir, 'src/vs/workbench/contrib/agentic/browser/react/src/styles.css'),
    ];
    let needsBuild = false;
    try {
        const outStat = await fs_1.promises.stat(reactOutSrc);
        for (const srcPath of reactSources) {
            const srcStat = await fs_1.promises.stat(srcPath);
            if (srcStat.mtimeMs > outStat.mtimeMs) {
                needsBuild = true;
                break;
            }
        }
    }
    catch {
        needsBuild = true;
    }
    let needsSync = needsBuild;
    if (!needsSync) {
        try {
            const [srcBundle, destBundle] = await Promise.all([
                fs_1.promises.stat(reactOutSrc),
                fs_1.promises.stat(reactOutDest),
            ]);
            needsSync = srcBundle.mtimeMs > destBundle.mtimeMs;
        }
        catch {
            needsSync = true;
        }
    }
    if (needsBuild) {
        await runProcess(npm, ['run', 'buildreact']);
    }
    else if (needsSync) {
        await runProcess('node', ['src/vs/workbench/contrib/agentic/browser/react/build.js', '--sync-only']);
    }
}
async function ensureCompiled() {
    const agenticContribution = path_1.default.join(rootDir, 'out/vs/workbench/contrib/agentic/browser/agentic.contribution.js');
    const staleVoidOut = path_1.default.join(rootDir, 'out/vs/workbench/contrib/void/browser/void.contribution.js');
    const jiraTextUtilsSrc = path_1.default.join(rootDir, 'src/vs/workbench/contrib/agentic/common/jiraTextUtils.ts');
    const jiraTextUtilsOut = path_1.default.join(rootDir, 'out/vs/workbench/contrib/agentic/common/jiraTextUtils.js');
    let needsCompile = !(await exists('out/main.js'));
    try {
        await fs_1.promises.stat(agenticContribution);
    }
    catch {
        needsCompile = true;
    }
    try {
        await fs_1.promises.stat(staleVoidOut);
        needsCompile = true;
    }
    catch { /* void path gone — good */ }
    if (!needsCompile) {
        try {
            const [srcStat, outStat] = await Promise.all([
                fs_1.promises.stat(jiraTextUtilsSrc),
                fs_1.promises.stat(jiraTextUtilsOut),
            ]);
            if (srcStat.mtimeMs > outStat.mtimeMs) {
                needsCompile = true;
            }
        }
        catch {
            needsCompile = true;
        }
    }
    if (needsCompile) {
        await runProcess(npm, ['run', 'gulp', '--', 'compile-client']);
    }
}
async function main() {
    await ensureNodeModules();
    await getElectron();
    await ensureCompiled();
    await ensureReactBuilt();
    // Can't require this until after dependencies are installed
    const { getBuiltInExtensions } = require('./builtInExtensions');
    await getBuiltInExtensions();
}
if (require.main === module) {
    main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
//# sourceMappingURL=preLaunch.js.map
