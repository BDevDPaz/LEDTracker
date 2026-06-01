import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface SourceFile {
  path: string;
  content: string;
  lines: string[];
}

const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json']);

function hasAllowedExtension(filePath: string): boolean {
  return [...EXTENSIONS].some(ext => filePath.endsWith(ext));
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}

export function readTextFile(path: string): string {
  return readFileSync(path, 'utf8');
}

export function readJsonFile<T = unknown>(path: string): T {
  return JSON.parse(readTextFile(path)) as T;
}

export function collectSourceFiles(roots: readonly string[]): SourceFile[] {
  const files: SourceFile[] = [];

  function walk(current: string) {
    if (!existsSync(current)) return;

    const stat = statSync(current);

    if (stat.isDirectory()) {
      for (const entry of readdirSync(current)) {
        if (
          entry === 'node_modules' ||
          entry === '.expo' ||
          entry === '.git' ||
          entry === 'android' ||
          entry === 'ios'
        ) {
          continue;
        }

        walk(join(current, entry));
      }

      return;
    }

    if (!hasAllowedExtension(current)) return;

    const content = readTextFile(current);

    files.push({
      path: current.split('\\').join('/'), // ✅ mejor compatibilidad
      content,
      lines: content.split(/\r?\n/)
    });
  }

  for (const root of roots) {
    walk(root);
  }

  return files;
}

export function findLineNumber(content: string, pattern: string): number | undefined {
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex(line => line.includes(pattern));
  return index >= 0 ? index + 1 : undefined;
}

