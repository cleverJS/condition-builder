export const AdapterType = {
  MIKROORM: 'mikroorm',
  KNEX: 'knex',
  KENDO: 'kendo',
} as const

export type AdapterType = (typeof AdapterType)[keyof typeof AdapterType]
