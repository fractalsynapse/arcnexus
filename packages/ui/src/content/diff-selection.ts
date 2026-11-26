/** A single fixed file, or a comparison whose paths are individually selectable. */
export type DiffSelection<File> =
  { file: File; files?: never } | { files: readonly File[]; file?: never };
