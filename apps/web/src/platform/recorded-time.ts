const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' });

/** Use the browser's local time for dated run and revision choices. */
export function recordedTime(timestamp: string) {
  return dateTime.format(new Date(timestamp));
}
