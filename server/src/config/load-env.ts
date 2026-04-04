import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const candidateEnvPaths = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'Backend', '.env'),
  resolve(import.meta.dir, '../../.env'),
];

const parseEnvValue = (rawValue: string) => {
  const value = rawValue.trim();

  if (!value) return '';

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'");
  }

  return value;
};

const loadEnvFile = (filePath: string) => {
  const contents = readFileSync(filePath, 'utf8');

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) continue;

    const normalized = trimmed.startsWith('export ') ? trimmed.slice(7) : trimmed;
    const separatorIndex = normalized.indexOf('=');

    if (separatorIndex === -1) continue;

    const key = normalized.slice(0, separatorIndex).trim();
    if (!key) continue;

    const value = parseEnvValue(normalized.slice(separatorIndex + 1));

    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = value;
    }

    if (Bun.env[key] == null || Bun.env[key] === '') {
      Bun.env[key] = value;
    }
  }
};

let loadedEnvPath: string | null = null;

for (const candidatePath of candidateEnvPaths) {
  if (!existsSync(candidatePath)) continue;

  loadEnvFile(candidatePath);
  loadedEnvPath = candidatePath;
  break;
}

export { loadedEnvPath };
