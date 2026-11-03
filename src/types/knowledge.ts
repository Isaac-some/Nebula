export const collections = [
  "AI 学习",
  "HAWK 算子",
  "HAWK 工作流",
  "我的笔记",
] as const;
export type LearningStatus = "未开始" | "学习中" | "已掌握";
export type Source = {
  title: string;
  url: string;
  publisher: string;
  publishedAt?: string;
};
export const relationLabels = {
  link: "知识链接",
  prerequisite: "学习前置",
  explains: "研究解释",
  applies: "技术应用",
  evaluates: "效果评测",
  extends: "研究扩展",
  contrasts: "方法对比",
  publishedBy: "研究机构",
} as const;
export type RelationKind = keyof typeof relationLabels;
export type NoteRelation = {
  target: string;
  kind: Exclude<RelationKind, "link" | "prerequisite" | "publishedBy">;
};
export type Note = {
  id: string;
  title: string;
  collection: string;
  summary: string;
  overview: string;
  content: string;
  tags: string[];
  prerequisites: string[];
  aliases: string[];
  status: LearningStatus;
  favorite: boolean;
  source: string;
  sources?: Source[];
  noteType?: "concept" | "research" | "organization";
  organizations?: string[];
  relations?: NoteRelation[];
  updatedAt: string;
  revision: number;
};
export type NoteCard = Omit<Note, "content" | "overview">;
export type Edge = {
  source: string;
  target: string;
  kind: RelationKind;
};
export type Vault = {
  notes: NoteCard[];
  edges: Edge[];
  unresolved: { source: string; title: string }[];
};
export type SearchHit = {
  note: NoteCard;
  score: number;
  vectorScore?: number;
  matchedLevel: string;
  excerpt: string;
};
