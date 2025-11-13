import type { EntityMetadata } from "typeorm";

export function getSelectFields(
  metadata: EntityMetadata,
  exclude: string[] = []
) {
  return metadata.columns
    .map(col => col.propertyName)
    .filter(col => !exclude.includes(col));
}