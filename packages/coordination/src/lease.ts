import { readFileSync } from 'node:fs';

const boot = readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim();

/** Identify a writer by boot, PID and its kernel start time, which survives PID reuse. */
export function identity(pid: number) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = stat
      .slice(stat.lastIndexOf(')') + 2)
      .trim()
      .split(/\s+/);
    return fields[0] === 'Z' ? undefined : `${boot}:${pid}:${fields[19]}`;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

/** Only reclaim a recorded writer that is proven to have exited. */
export function departed(lease: unknown) {
  if (typeof lease !== 'string') return false;
  const pid = Number(lease.split(':')[1]);
  return Number.isSafeInteger(pid) && pid > 0 && identity(pid) !== lease;
}
