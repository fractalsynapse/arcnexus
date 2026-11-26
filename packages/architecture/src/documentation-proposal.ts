import { isMap, isNode, isScalar, parseDocument, stringify } from 'yaml';
import { projectCatalogPath, type Capture } from './catalog.js';
import { prepareArchitectureProposal } from './decode-proposal.js';
import { documentationDirectories, type DocumentationSettings } from './documentation-settings.js';

const field = 'documentationDirectories';

/** Report invalid folder choices without exposing the host checkout or Git diagnostics. */
export class InvalidDocumentationDirectories extends Error {}

/** Check that each configured directory actually exists at the authorized commit. */
export function validateDocumentationDirectories(capture: Capture, input: unknown) {
  const directories = documentationDirectories.parse(input);
  const paths = capture.source.files ?? capture.source.paths;
  for (const directory of directories) {
    if (!paths.some((path) => path.startsWith(directory + '/')))
      throw new InvalidDocumentationDirectories(
        'Documentation directory is missing at the captured revision: ' + directory,
      );
  }
  return directories;
}

/** Build the exact project-definition edit and preserve every other setting. */
export function documentationProposal(capture: Capture, draft: DocumentationSettings) {
  if (draft.revision !== capture.source.revision)
    throw new Error(
      'Project revision changed. Reopen project settings to review the latest version.',
    );
  const directories = validateDocumentationDirectories(capture, draft.directories);
  if (
    JSON.stringify(directories) === JSON.stringify(capture.project.documentationDirectories ?? [])
  )
    return undefined;
  const content = reviseDirectories(capture.source.read(projectCatalogPath), directories);
  return prepareArchitectureProposal(capture, {
    purpose: 'Update project documentation directories',
    consequences: ['Plan uses these directories by default when discovering objective sources.'],
    implementation: [],
    changes: [{ path: projectCatalogPath, content }],
  });
}

/** Replace only the settings field in the usual block mapping, retaining unrelated bytes. */
function reviseDirectories(source: string, directories: string[]) {
  const document = parseDocument(source);
  const catalog = document.contents;
  if (!isMap(catalog) || !catalog.range || catalog.flow) {
    if (directories.length) document.set(field, directories);
    else document.delete(field);
    return document.toString();
  }
  const entry = catalog.items.find(({ key }) => isScalar(key) && key.value === field);
  const position = entry?.key;
  const span = isNode(entry?.value) ? entry.value.range : undefined;
  const start = isScalar(position) && position.range ? position.range[0] : catalog.range[1];
  const end = span?.[2] ?? start;
  const prefix = source.slice(0, start);
  const suffix = source.slice(end);
  if (!directories.length) return prefix + suffix;
  const lineEnding = source.includes('\r\n') ? '\r\n' : '\n';
  const separator = prefix && !prefix.endsWith('\n') ? lineEnding : '';
  return (
    prefix + separator + stringify({ [field]: directories }).replaceAll('\n', lineEnding) + suffix
  );
}
