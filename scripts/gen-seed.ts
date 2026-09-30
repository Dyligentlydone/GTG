// Writes supabase/seed.sql from the Game 1 config. Run: `npm run gen:seed` (tsx scripts/gen-seed.ts).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { game1 } from '../src/games/game1/config';
import { buildSeedSql } from '../src/games/seedSql';
import { validateGameConfig } from '../src/core/validate';

const check = validateGameConfig(game1);
if (!check.ok) {
  console.error(`Game 1 config is invalid:\n- ${check.errors.join('\n- ')}`);
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'supabase/seed.sql');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, buildSeedSql([{ game: game1, type: 'free', status: 'active' }]));
console.log(`Wrote ${target}`);
