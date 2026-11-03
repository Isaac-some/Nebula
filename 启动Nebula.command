#!/bin/zsh
set -e
atlasRoot="${0:A:h}"
cd "$atlasRoot"
if ! command -v node >/dev/null 2>&1; then
  print '需要先安装 Node.js 24 或更新版本：https://nodejs.org/'
  read '?按回车关闭…'
  exit 1
fi
if curl --max-time 2 -fsS http://127.0.0.1:3210/api/vault >/dev/null 2>&1; then
  open http://127.0.0.1:3210
  print 'Nebula已在运行，已为你打开浏览器。'
  exit 0
fi
if [[ ! -d node_modules ]]; then npm install; fi
if [[ ! -f data/models/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/onnx/model_quantized.onnx ]]; then
  print '正在准备本地语义模型…'
  npm run setup:model
fi
if [[ ! -f .next/BUILD_ID ]]; then npm run build; fi
print 'Nebula即将打开。使用期间请保留这个窗口；按 Control+C 可以停止。'
(sleep 3; open http://127.0.0.1:3210) &
npm run preview
