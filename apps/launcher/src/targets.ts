export const launcherTargets = {
  'linux-x64': 'Linux · x64',
  'linux-arm64': 'Linux · ARM64',
} as const;

export type LauncherTarget = keyof typeof launcherTargets;

export interface LauncherBuild {
  target: LauncherTarget;
  sha256: string;
}

export function isLauncherTarget(value: string): value is LauncherTarget {
  return Object.hasOwn(launcherTargets, value);
}

export function launcherName(target: LauncherTarget) {
  return 'arcnexus-launcher-' + target;
}
