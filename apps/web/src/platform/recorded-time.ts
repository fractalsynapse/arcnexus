const dateTime = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** Use the browser's local time for dated run and revision choices. */
export function recordedTime(timestamp: string) {
  return dateTime.format(new Date(timestamp));
}

/** Name an execution consistently in the selector and history details. */
export function planRunLabel(timestamp: string | null, number: number) {
  return timestamp ? recordedTime(timestamp) : 'Run ' + number;
}
