/** Une clases ignorando falsy; suficiente para no traer clsx. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
