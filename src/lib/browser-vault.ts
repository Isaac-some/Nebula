import Fuse from "fuse.js";
import JSZip from "jszip";
import { parse, stringify } from "yaml";
import concepts from "../../seed/notes.json";
import context from "../../seed/research-context.json";
import research from "../../seed/research-notes.json";
import type { Note } from "@/types/knowledge";
import { buildVault, normalizeTitle, noteCard } from "./links";
import { prepareNote, VaultError } from "./note-model";

let connection: Promise<IDBDatabase> | undefined;
function database() {
  return (connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("nebula-personal-demo", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("vault");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { connection = undefined; reject(new Error("无法打开浏览器存储，请允许此网站保存数据。")); };
  }));
}
function initialNotes(): Note[] {
  const notes: Note[] = [];
  for (const [i, seed] of [...concepts, ...context, ...research].entries()) {
    const note = prepareNote(seed as Partial<Note> & { title: string }, notes, false);
    note.id = `demo-${i + 1}`;
    notes.push(note);
  }
  return notes;
}
// Read and write in one IndexedDB transaction so concurrent tabs cannot silently
// overwrite a newer revision. An empty saved vault stays empty after refresh.
async function transact<T>(operation: (notes: Note[]) => T, write = false): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("vault", "readwrite");
    const store = tx.objectStore("vault");
    const request = store.get("notes");
    let result: T;
    let failure: unknown;
    request.onsuccess = () => {
      try {
        const notes: Note[] = request.result === undefined ? initialNotes() : request.result;
        result = operation(notes);
        if (write || request.result === undefined) store.put(notes, "notes");
      } catch (error) { failure = error; tx.abort(); }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () => reject(failure || new Error("浏览器未能保存数据，请检查可用空间或隐私设置后重试。"));
  });
}
function save(notes: Note[], input: Partial<Note> & { title: string }) {
  const note = prepareNote(input, notes);
  const i = notes.findIndex(n => n.id === note.id);
  if (i < 0) notes.push(note); else notes[i] = note;
  return note;
}
function markdown(note: Note) {
  const { content, ...data } = note;
  return `---\n${stringify({ ...data, abstract: note.summary })}---\n\n${content}`;
}
async function exportNotes(notes: Note[]) {
  const zip = new JSZip();
  const root = zip.folder("Nebula知识库")!;
  root.file(".obsidian/app.json", JSON.stringify({ newLinkFormat: "shortest", readableLineLength: true }));
  root.file("wiki/index.md", "# 知识索引\n\n" + notes.map(n => `- [[${n.title}]] — ${n.summary}`).join("\n"));
  const used = new Set<string>();
  for (const n of notes) {
    let name = n.title.replace(/[/\\:*?"<>|]/g, "_");
    if (used.has(name)) name += `-${n.id}`;
    used.add(name);
    root.file(`wiki/${n.collection.replace(/[/\\]/g, "_")}/${name}.md`, markdown(n));
  }
  return new Response(await zip.generateAsync({type:"blob"}), { headers: {"Content-Type":"application/zip"} });
}
export async function browserRequest(url: string, init?: RequestInit): Promise<Response> {
  try {
    const { pathname, searchParams: params } = new URL(url, location.origin);
    const method = init?.method || "GET";
    if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (pathname === "/api/export") return exportNotes(await transact(notes => notes));
    const result = await transact(notes => {
      if (pathname === "/api/vault") {
        const id = params.get("id");
        if (method === "POST") return save(notes, JSON.parse(String(init?.body)));
        if (method === "DELETE") {
          const i = notes.findIndex(n => n.id === id);
          if (i < 0) throw new VaultError("文档不存在。", 404);
          notes.splice(i, 1);
          return { ok: true };
        }
        if (!id) return buildVault(notes);
        const n = notes.find(n => n.id === id);
        if (!n) throw new VaultError("文档不存在。", 404);
        const level = params.get("level");
        return level === "L0" ? noteCard(n) : level === "L1" ? {...noteCard(n), overview:n.overview} : n;
      }
      if (pathname === "/api/search") {
        const q = (params.get("q") || "").trim().slice(0,300);
        if (!q) return {hits:[], warning:""};
        const matching = notes.filter(n => !params.get("collection") || n.collection === params.get("collection"));
        const fuse = new Fuse(matching, {includeScore:true, ignoreLocation:true, threshold:0.42, keys:[{name:"title",weight:5},{name:"aliases",weight:4},{name:"tags",weight:3},{name:"summary",weight:2},"overview","content"]});
        return {hits:fuse.search(q).slice(0,30).map(({item,score}) => {
          const text = `${item.summary}\n${item.overview}\n${item.content}`;
          const at = Math.max(0, text.toLocaleLowerCase().indexOf(q.toLocaleLowerCase()) - 50);
          return {note:noteCard(item),score:1-(score||0),matchedLevel:"L2",excerpt:text.slice(at,at+180)};
        }),warning:""};
      }
      if (pathname === "/api/import" && method === "POST") {
        const { files } = JSON.parse(String(init?.body)) as {files:{name:string;content:string}[]};
        if (!Array.isArray(files) || files.length > 500 || files.some(f => typeof f.name !== "string" || typeof f.content !== "string")) throw new VaultError("每次最多导入 500 个文本文件。");
        if (files.reduce((s,f)=>s+f.content.length,0)>10000000) throw new VaultError("每次导入内容请控制在 10 MB 内。");
        const imported:string[]=[], skipped:string[]=[], errors:string[]=[];
        for (const file of files) {
          if (!/\.(md|markdown|txt)$/i.test(file.name)) {skipped.push(file.name);continue;}
          try {
            const front = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(file.content);
            const data = front ? (parse(front[1]) || {}) : {};
            const content = front ? file.content.slice(front[0].length).replace(/^\r?\n/,'') : file.content;
            const title = String(data.title || content.match(/^# (.+)/m)?.[1] || file.name.replace(/\.[^.]+$/,'')).trim();
            if (notes.some(n=>normalizeTitle(n.title)===normalizeTitle(title))) {skipped.push(file.name);continue;}
            const arr=(x:unknown)=>Array.isArray(x)?x.map(String):[];
            const note=save(notes,{title,content,collection:String(data.collection||"我的笔记"),summary:String(data.abstract||data.summary||content.replace(/[#*`\[\]]/g,"").slice(0,140)),overview:String(data.overview||""),tags:arr(data.tags),aliases:arr(data.aliases),prerequisites:arr(data.prerequisites),organizations:arr(data.organizations),relations:data.relations,sources:data.sources,noteType:data.noteType,status:data.status||"未开始",favorite:data.favorite===true,source:String(data.source||file.name)});
            imported.push(note.id);
          } catch(error) {errors.push(`${file.name}：${error instanceof Error?error.message:"导入失败"}`);}
        }
        return {imported,skipped,errors};
      }
      throw new VaultError("Demo 不支持此操作。", 404);
    }, method !== "GET");
    return Response.json(result);
  } catch (error) {
    return Response.json({error:error instanceof Error?error.message:"操作失败，请重试。"},{status:error instanceof VaultError?error.status:500});
  }
}
