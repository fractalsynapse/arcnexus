import { useEffect, useState } from 'react';
import { followTimeline, type TimelineFrame } from './timeline-stream.js';

type Snapshot = { frames: TimelineFrame[]; cursor?: string };
const retained = new Map<string, Snapshot>();

/** Keep the applied cursor when a panel closes or its network connection ends. */
export function useTimeline(path?: string, token?: string) {
  const [revision, refresh] = useState(0);
  const [live, setLive] = useState<{ key: string; error: string }>();
  const key = path && token ? JSON.stringify([path, token]) : undefined;
  useEffect(() => {
    if (!path || !token || !key) return;
    return subscribeTimeline(path, token, key, (error) => setLive({ key, error }));
  }, [path, token, revision, key]);
  return {
    frames: (key && retained.get(key)?.frames) || [],
    error: live?.key === key ? live?.error : undefined,
    reconnect: () => {
      setLive(undefined);
      refresh((value) => value + 1);
    },
  };
}

function subscribeTimeline(
  path: string,
  token: string,
  key: string,
  notify: (error: string) => void,
) {
  const controller = new AbortController();
  const snapshot = retained.get(key) ?? { frames: [] };
  retained.set(key, snapshot);
  void followTimeline(path, token, controller.signal, snapshot.cursor, ({ id, frame }) => {
    if (controller.signal.aborted || !nextSequence(snapshot.frames, frame.sequence)) return;
    snapshot.cursor = id;
    snapshot.frames.push(frame);
    notify('');
  }).then(
    () => {
      if (!controller.signal.aborted) notify('The stream disconnected.');
    },
    (error: Error) => {
      if (!controller.signal.aborted) notify(error.message);
    },
  );
  return () => controller.abort();
}

function nextSequence(frames: TimelineFrame[], sequence: string) {
  const last = frames.at(-1)?.sequence;
  return !last || BigInt(sequence) > BigInt(last);
}
