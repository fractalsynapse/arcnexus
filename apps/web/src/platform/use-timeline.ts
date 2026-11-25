import { useEffect, useState } from 'react';
import { followTimeline, type TimelineFrame } from './timeline-stream.js';

type Snapshot = { frames: TimelineFrame[]; cursor?: string };
const retained = new Map<string, Snapshot>();

/** Keep the applied cursor when a panel closes or its network connection ends. */
export function useTimeline(path?: string) {
  const [revision, refresh] = useState(0);
  const [live, setLive] = useState<{ key: string; error: string }>();
  useEffect(() => {
    if (!path) return;
    return subscribeTimeline(path, (error) => setLive({ key: path, error }));
  }, [path, revision]);
  return {
    frames: (path && retained.get(path)?.frames) || [],
    error: live?.key === path ? live?.error : undefined,
    reconnect: () => {
      setLive(undefined);
      refresh((value) => value + 1);
    },
  };
}

function subscribeTimeline(path: string, notify: (error: string) => void) {
  const controller = new AbortController();
  const snapshot = retained.get(path) ?? { frames: [] };
  retained.set(path, snapshot);
  void followTimeline(path, controller.signal, snapshot.cursor, ({ id, frame }) => {
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
