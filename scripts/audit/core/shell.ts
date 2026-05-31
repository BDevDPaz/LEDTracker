import { execSync } from 'node:child_process';

export interface ShellResult {
  ok: boolean;
  output: string;
}

export function runCommand(command: string): ShellResult {
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });

    return { ok: true, output };
  } catch (error) {
    const err = error as { stdout?: Buffer; stderr?: Buffer; message?: string };

    return {
      ok: false,
      output: [
        err.stdout?.toString(),
        err.stderr?.toString(),
        err.message
      ]
        .filter(Boolean)
        .join('\n')
    };
  }
}
