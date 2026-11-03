import type { Note, Edge, Vault } from "@/types/knowledge";
export function normalizeTitle(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}
export function wikiTargets(content: string): string[] {
  const plain = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]+`/g, "");
  return [
    ...new Set(
      [...plain.matchAll(/\[\[([^\]\n]+)\]\]/g)]
        .map((m) => m[1].split("|")[0].split("#")[0].trim())
        .filter(Boolean),
    ),
  ];
}
export function buildVault(notes: Note[]): Vault {
  const names = new Map<string, string>();
  // Exact titles take precedence; concept aliases take precedence over research aliases.
  for (const n of notes)
    for (const key of [n.title, n.id]) names.set(normalizeTitle(key), n.id);
  const aliasOrder = [...notes].sort(
    (a, b) =>
      Number((a.noteType || "concept") !== "concept") -
      Number((b.noteType || "concept") !== "concept"),
  );
  for (const n of aliasOrder)
    for (const alias of n.aliases)
      if (!names.has(normalizeTitle(alias)))
        names.set(normalizeTitle(alias), n.id);
  const edges: Edge[] = [],
    unresolved: Vault["unresolved"] = [];
  const keys = new Set<string>();
  for (const n of notes) {
    const add = (title: string, kind: Edge["kind"]) => {
      const target = names.get(normalizeTitle(title));
      if (!target || target === n.id) return;
      const key = `${n.id}:${target}:${kind}`;
      if (!keys.has(key)) {
        keys.add(key);
        edges.push({ source: n.id, target, kind });
      }
    };
    for (const r of n.relations || []) add(r.target, r.kind);
    if (n.noteType === "research")
      for (const org of n.organizations || []) add(org, "publishedBy");
    for (const [kind, targets] of [
      ["link", wikiTargets(n.content)],
      ["prerequisite", n.prerequisites],
    ] as const) {
      for (const title of targets) {
        const target = names.get(normalizeTitle(title));
        if (!target) {
          if (kind === "link") unresolved.push({ source: n.id, title });
          continue;
        }
        if (target === n.id) continue;
        // A typed relation replaces the generic wiki link for that ordered pair.
        if (
          kind === "link" &&
          (n.relations || []).some(
            (r) => names.get(normalizeTitle(r.target)) === target,
          )
        )
          continue;
        add(title, kind);
      }
    }
  }
  return { notes: notes.map(noteCard), edges, unresolved };
}
export function noteCard(note: Note) {
  const card = { ...note };
  Reflect.deleteProperty(card, "content");
  Reflect.deleteProperty(card, "overview");
  return card as Omit<Note, "content" | "overview">;
}
export function chunks(note: Note) {
  const result = [
    { level: "L0", text: `${note.title}\n${note.summary}` },
    { level: "L1", text: `${note.title}\n${note.overview}` },
  ];
  const text = note.content;
  for (let i = 0; i < text.length; i += 650)
    result.push({
      level: "L2",
      text: `${note.title}\n${text.slice(i, i + 850)}`,
    });
  return result;
}
