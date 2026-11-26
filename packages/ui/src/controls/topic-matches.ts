/** Use one identity for topic filtering, matching and creation. */
export function topicKey(topic: string) {
  return topic.trim().toLowerCase();
}

export function matchTopics(
  options: readonly string[],
  selected: readonly string[],
  query: string,
) {
  const needle = topicKey(query);
  const included = new Set(selected.map(topicKey));
  return {
    alreadySelected: included.has(needle),
    matches: options.filter((topic) => {
      const key = topicKey(topic);
      return !included.has(key) && key.includes(needle);
    }),
  };
}
