import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve the project's data/ dir whether running via tsx (server/) or the
// compiled build (dist/server/). Falls back to cwd()/data.
function resolveDataDir(): string {
  const candidates = [
    path.resolve(__dirname, '../data'), // dev: server/../data
    path.resolve(__dirname, '../../data'), // prod: dist/server/../../data
    path.resolve(process.cwd(), 'data'),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

export const DATA_DIR = resolveDataDir();
export const DB_PATH = path.join(DATA_DIR, 'stats.sqlite');
export const LAYOUT_DIR = path.join(DATA_DIR, 'layouts');
