/** Normalize formatting for legacy source contracts while preserving quoted SQL/text. */
export function compactSource(source: string) {
  return source.replace(
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*)|\s+/g,
    (match: string, literal: string | undefined, offset: number) => {
      if (literal)
        return literal.startsWith("//") || literal.startsWith("/*")
          ? ""
          : literal;
      return /[\w$]/.test(source[offset - 1] ?? "") &&
        /[\w$]/.test(source[offset + match.length] ?? "")
        ? " "
        : "";
    },
  );
}
