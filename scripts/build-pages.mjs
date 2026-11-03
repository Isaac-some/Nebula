import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const stage = path.join(root, 'temp', 'pages-build');
await fs.rm(stage, { recursive: true, force: true });
await fs.mkdir(stage, { recursive: true });
for (const file of ['src', 'seed', 'public', 'package.json', 'package-lock.json', 'tsconfig.json', 'next.config.ts', 'postcss.config.mjs']) {
  await fs.cp(path.join(root, file), path.join(stage, file), { recursive: true });
}
// Keep server APIs in the source repository and local app; they are not routes
// of the browser-only export. Build in isolation from the running local service.
await fs.rm(path.join(stage, 'src/app/api'), { recursive: true });
await fs.symlink(path.join(root, 'node_modules'), path.join(stage, 'node_modules'), 'dir');
const build = spawnSync(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'build', '--webpack'], {
  cwd: stage, stdio: 'inherit', env: {...process.env, NEXT_PUBLIC_NEBULA_BROWSER:'true', PAGES_BASE_PATH:process.env.PAGES_BASE_PATH ?? '/Nebula'},
});
if (build.status !== 0) process.exit(build.status || 1);
await fs.rm(path.join(root, 'out'), {recursive:true,force:true});
await fs.cp(path.join(stage, 'out'), path.join(root, 'out'), {recursive:true});
await fs.writeFile(path.join(root, 'out/.nojekyll'), '');
