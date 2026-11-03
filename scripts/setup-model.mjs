import fs from "node:fs";
import path from "node:path";
import { pipeline as stream } from "node:stream/promises";
import { Readable } from "node:stream";
const model = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2";
const root = path.resolve(
  process.env.ATLAS_DATA_DIR || "data",
  "models",
  model,
);
const base = `https://www.modelscope.cn/models/${model}/resolve/master/`;
const files = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "special_tokens_map.json",
  "sentencepiece.bpe.model",
  "onnx/model_qint8_arm64.onnx",
];
await Promise.all(
  files.map(async (file) => {
    const dest = path.join(
      root,
      file.endsWith(".onnx") ? "onnx/model_quantized.onnx" : file,
    );
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      console.log("已存在", file);
      return;
    }
    console.log("下载", file);
    const res = await fetch(base + file, {
      signal: AbortSignal.timeout(300000),
    });
    if (!res.ok) throw Error(`${file}: HTTP ${res.status}`);
    await stream(
      Readable.fromWeb(res.body),
      fs.createWriteStream(dest + ".tmp"),
    );
    fs.renameSync(dest + ".tmp", dest);
    console.log("就绪", file, fs.statSync(dest).size);
  }),
);
console.log("本地语义模型已准备好。");
