export const AdapterType = {
  MIKROORM: 'mikroorm',
  KNEX: 'knex',
  KYSELY: 'kysely',
  KENDO: 'kendo',
} as const

export type AdapterType = (typeof AdapterType)[keyof typeof AdapterType]
