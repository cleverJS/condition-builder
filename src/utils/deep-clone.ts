export function deepClone<T>(obj: T): T {
  // typeof null === 'object', so the null check is required
  const value: unknown = obj
  if (typeof value !== 'object' || value === null) {
    return obj
  }

  return structuredClone(obj)
}
