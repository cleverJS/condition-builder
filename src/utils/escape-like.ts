export function escapeLikeValue(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&')
}
