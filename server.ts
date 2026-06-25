import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";

const ENV_KEYS = ["AI_API_KEY", "AI_API_BASE", "AI_MODEL"] as const;

/** 读取 .env.local 中的 AI_* 到 process.env（仅当 process.env 中未设置时） */
function loadEnvLocal() {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (ENV_KEYS.includes(key as any) && val && !process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // .env.local 不存在，忽略
  }
}

/** 读取 .env.local 的当前快照（key→value），用于合并写入 */
function readEnvSnapshot(): Record<string, string> {
  const snap: Record<string, string> = {};
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (ENV_KEYS.includes(key as any)) snap[key] = val;
    }
  } catch {
    // 文件不存在
  }
  return snap;
}

const getApiBase = () => process.env.AI_API_BASE || "https://api.openai.com/v1";
const getModel = () => process.env.AI_MODEL || "gpt-4o-mini";

async function startServer() {
  loadEnvLocal();
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // CORS support for development
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  // API Route for AI features in "Deepread"
  app.post("/api/ai/reflect", async (req, res) => {
    try {
      const { quote, note, action, title, intention, author } = req.body;
      if (!quote) {
        return res.status(400).json({ error: "需要选择划线的文本/名句" });
      }

      const apiKey = process.env.AI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "未检测到 API 密钥。请在书桌右上角【AI 配置】中填写 API Key，或在 .env.local 中配置 AI_API_KEY。"
        });
      }

      let systemInstruction = "";
      let userPrompt = "";

      if (action === "explain") {
        systemInstruction = `你是一位专注、深刻的书籍阅读伴侣与学者。你的任务是帮助读者解析和延伸他们划线提取的名句。
你的分析必须极其精准、隽永、富有文学思辨色彩，具有传统的纸张阅读感。不要用长篇套话，开门见山，直击核心，从哲学、逻辑或其社会人类学背景进行解析。
读者的当前阅读目标是: "${intention || '无特设目标（通读）'}"。请务必巧妙地把该目标作为分析的最终锚点，解决读者的诉求。
字数限制在 120-200 字之间，段落工整雅致，直接输出正文，不要有任何多余的引言、冒号引导、自我介绍或过渡语。`;
        userPrompt = `书籍：《${title}》 (作者：${author})
当前划线名句：
"${quote}"

读者批注：
"${note || '（未写下批注，请仅对划线重点本身深度解析）'}"

请针对这句话进行"解释/深度剖析"。`;
      } else if (action === "challenge") {
        systemInstruction = `你是一位犀利、博学又克制的思想辩论者，作为读者沉浸思考的"魔鬼代言人"。你的任务是对划线名句或观点的盲区进行针锋相对的思辨、反驳或局限性拆解，激发读者形成多维视角的独立判断。
反驳言辞应冷静客观、深刻大方，直捣逻辑脆弱部分，并非情绪化抬杠。
读者的当前阅读目标是: "${intention || '无特设目标（通读）'}"。请结合此目标的实践落地路径，对其局限性或反向视角进行警示和质问。
字数限制在 120-200 字之间，分段简明利落，直接输出正文，绝对不要有废话前言或总结尾缀。`;
        userPrompt = `书籍：《${title}》 (作者：${author})
当前划线名句：
"${quote}"

读者批注：
"${note || '（无）'}"

请针对这句话或观点，提出能刺痛思维、开阔视野的"反驳与思辨"。`;
      } else if (action === "associate") {
        systemInstruction = `你是一位知识积淀极其深厚、富有洞察力的创意跨界学家。你的任务是将这句名句中的关键论义，同其他前沿学科理论（例如心理学、行为遗传、经济模型、设计力学）、历史典故、或者现实生活与现代科技产品的杰出设计实践（例如苹果界面、任天堂叙事等）建立奇妙、高含金量的跨界联想。
强烈的跨界对照感能对心智进行彻底的撞击，提供新奇灵感。
读者的当前阅读目标是: "${intention || '无特设目标（通读）'}"。请以此目标的使用落脚点为线索，寻找对这个目标最有关联启示的意象与逻辑。
字数限制在 120-200 字之间，段落分明，直接输出正文，删除客套话。`;
        userPrompt = `书籍：《${title}》 (作者：${author})
当前划线名句：
"${quote}"

读者批注：
"${note || '（无）'}"

请提供一段有醍醐灌顶感、精彩绝伦的跨领域"联想与对照"。`;
      } else {
        systemInstruction = `你是一位优雅深沉的深读助手。`;
        userPrompt = `请对以下内容写简要分析: "${quote}"`;
      }

      const abortController = new AbortController();
      let upstreamDone = false;
      req.on("aborted", () => abortController.abort());
      res.on("close", () => {
        if (!upstreamDone && !res.writableEnded) abortController.abort();
      });

      const response = await fetch(`${getApiBase()}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: getModel(),
          temperature: 0.8,
          stream: true,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: userPrompt },
          ],
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("AI API Error:", response.status, errorBody);
        return res.status(500).json({ error: `AI 服务请求失败 (${response.status})，请稍后重试。` });
      }

      // Streaming path
      if (response.body) {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Transfer-Encoding", "chunked");
        res.flushHeaders();

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let doneBySse = false;

        try {
          while (!doneBySse) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data:")) continue;
              const payload = trimmed.slice(5).trim();
              if (payload === "[DONE]") {
                doneBySse = true;
                break;
              }

              try {
                const json = JSON.parse(payload);
                const content =
                  json.choices?.[0]?.delta?.content ??
                  json.choices?.[0]?.message?.content ??
                  json.choices?.[0]?.text ??
                  "";
                if (content) res.write(content);
              } catch {
                // skip malformed JSON lines
              }
            }
          }

          // Flush any remaining bytes in the decoder
          const tail = decoder.decode();
          if (tail) {
            const tailLines = (buffer + tail).split("\n");
            for (const line of tailLines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data:")) continue;
              const payload = trimmed.slice(5).trim();
              if (payload === "[DONE]") break;
              try {
                const json = JSON.parse(payload);
                const content =
                  json.choices?.[0]?.delta?.content ??
                  json.choices?.[0]?.message?.content ??
                  json.choices?.[0]?.text ??
                  "";
                if (content) res.write(content);
              } catch {
                // skip malformed
              }
            }
          }
        } catch (err: any) {
          if (err.name !== "AbortError") console.error("Stream read error:", err);
        } finally {
          upstreamDone = true;
          res.end();
        }
      } else {
        // Fallback: no body stream — read full JSON
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "未能生成回应，请在稍后重试。";
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        upstreamDone = true;
        res.end(text);
      }

    } catch (error: any) {
      console.error("AI API Error:", error);
      res.status(500).json({ error: error.message || "请求服务器出错，请稍后重试。" });
    }
  });

  // --- Settings API ---
  app.get("/api/settings", (_req, res) => {
    const key = process.env.AI_API_KEY || "";
    res.json({
      hasApiKey: !!key,
      apiKey: key ? key.slice(0, 3) + "****" + key.slice(-4) : "",
      apiBase: process.env.AI_API_BASE || "https://api.openai.com/v1",
      model: process.env.AI_MODEL || "gpt-4o-mini",
    });
  });

  app.post("/api/settings", (req, res) => {
    try {
      const { apiKey, apiBase, model } = req.body;
      // 合并：未传或空字符串的字段保留旧值
      const snapshot = readEnvSnapshot();
      const merged: Record<string, string> = {};
      for (const k of ENV_KEYS) {
        const incoming = k === "AI_API_KEY" ? apiKey : k === "AI_API_BASE" ? apiBase : model;
        merged[k] = (incoming && incoming.trim()) || snapshot[k] || process.env[k] || "";
      }
      // 写回 .env.local
      const envPath = path.join(process.cwd(), ".env.local");
      const lines = ENV_KEYS.map(k => `${k}=${merged[k]}`);
      fs.writeFileSync(envPath, lines.join("\n") + "\n");
      // 立即生效
      for (const k of ENV_KEYS) {
        if (merged[k]) process.env[k] = merged[k];
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "保存失败" });
    }
  });

  app.post("/api/settings/models", async (req, res) => {
    try {
      const { apiKey, apiBase } = req.body;
      const key = apiKey || process.env.AI_API_KEY;
      const base = (apiBase || process.env.AI_API_BASE || "https://api.openai.com/v1").replace(/\/+$/, "");
      if (!key) return res.status(400).json({ error: "请先填写 API Key" });

      const response = await fetch(`${base}/models`, {
        headers: { "Authorization": `Bearer ${key}` },
      });
      const text = await response.text();
      if (!response.ok) {
        return res.status(response.status).json({ error: `获取模型列表失败 (${response.status}): ${text.slice(0, 200)}` });
      }
      let data: any;
      try { data = JSON.parse(text); } catch {
        return res.status(502).json({ error: "上游 API 返回了非 JSON 响应" });
      }
      const models = (data.data || []).map((m: any) => m.id).sort();
      res.json({ models });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "网络连接失败" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
