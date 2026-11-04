// Glossary = every src/data/glossary/*.json (one file per chapter, so chapters can be written independently).
export type GlossaryEntry = { id: string; vi: string; en: string; def: { vi: string; en: string } };

const files = import.meta.glob<GlossaryEntry[]>('./glossary/*.json', { eager: true, import: 'default' });
const all = Object.values(files).flat();
const seen = new Set<string>();
for (const g of all) {
  if (seen.has(g.id)) throw new Error(`Duplicate glossary id "${g.id}"`);
  seen.add(g.id);
}
export const glossary: GlossaryEntry[] = all.sort((a, b) => a.vi.localeCompare(b.vi, 'vi'));
