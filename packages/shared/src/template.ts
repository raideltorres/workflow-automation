export type TemplateData = Readonly<Record<string, string | number | null | undefined>>;

const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function extractTemplateTokens(template: string): string[] {
  const tokens = new Set<string>();
  for (const match of template.matchAll(TOKEN_PATTERN)) {
    if (match[1]) tokens.add(match[1]);
  }
  return [...tokens];
}

export function findUnknownTemplateTokens(template: string, allowedKeys: readonly string[]): string[] {
  const allowed = new Set(allowedKeys);
  return extractTemplateTokens(template).filter((token) => !allowed.has(token));
}

export function renderTemplate(template: string, data: TemplateData): string {
  return template.replace(TOKEN_PATTERN, (_match, key: string) => {
    const value = Object.hasOwn(data, key) ? data[key] : undefined;
    return value === null || value === undefined ? '' : String(value);
  });
}

export function toTemplateToken(key: string): string {
  return `{{${key}}}`;
}
