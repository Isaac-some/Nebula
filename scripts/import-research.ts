import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { allNotes, dataDir, saveNote } from "../src/lib/store";
import { normalizeTitle, buildVault } from "../src/lib/links";
import type { Note } from "../src/types/knowledge";

const dbFile = path.join(dataDir, "atlas.sqlite");
if (fs.existsSync(dbFile)) {
  const backupDir = path.join(dataDir, "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backup = path.join(
    backupDir,
    `before-research-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`,
  );
  const db = new DatabaseSync(dbFile);
  db.exec("PRAGMA busy_timeout=5000");
  db.prepare("VACUUM INTO ?").run(backup);
  db.close();
  console.log(`导入前备份：${backup}`);
}
const existing = new Set(
  allNotes()
    .flatMap((n) => [n.title, ...n.aliases])
    .map(normalizeTitle),
);
let added = 0,
  skipped = 0;
for (const name of ["research-context.json", "research-notes.json"]) {
  const notes: Note[] = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "seed", name), "utf8"),
  );
  for (const note of notes) {
    if (existing.has(normalizeTitle(note.title))) {
      skipped++;
      continue;
    }
    saveNote(note, false);
    existing.add(normalizeTitle(note.title));
    added++;
  }
}
const vault = buildVault(allNotes());
console.log(
  JSON.stringify(
    {
      added,
      skipped,
      total: vault.notes.length,
      relations: vault.edges.length,
      unresolved: vault.unresolved,
    },
    null,
    2,
  ),
);
