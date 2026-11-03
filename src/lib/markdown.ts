import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const parser = new Marked({ breaks: false });
parser.use({
  extensions: [
    {
      name: "wikilink",
      level: "inline",
      start(src) {
        return src.indexOf("[[");
      },
      tokenizer(src) {
        const m = /^\[\[([^\]\n]+)\]\]/.exec(src);
        if (m) {
          const [target, label] = m[1].split("|");
          return {
            type: "wikilink",
            raw: m[0],
            target: target.trim(),
            label: label || target,
          };
        }
      },
      renderer(token) {
        return `<a href="#wiki" data-wiki="${escape(token.target)}" class="wiki-link">${escape(token.label)}</a>`;
      },
    },
  ],
});
export function toHtml(content: string) {
  return sanitizeHtml(parser.parse(content, { async: false }) as string, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img"],
    allowedAttributes: {
      a: ["href", "title", "data-wiki", "class", "target", "rel"],
      img: ["src", "alt", "title"],
      code: ["class"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    transformTags: {
      a: (tag, attrs) => ({
        tagName: tag,
        attribs: {
          ...attrs,
          ...(attrs["data-wiki"]
            ? {}
            : { target: "_blank", rel: "noopener noreferrer" }),
        },
      }),
    },
  });
}
