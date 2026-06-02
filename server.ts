import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const getAI = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn("WARNING: GEMINI_API_KEY is not defined in the environment. AI features will not function correctly.");
  }
  return new GoogleGenAI({
    apiKey: key || "placeholder",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Gemini features in "Deepread"
  app.post("/api/gemini/reflect", async (req, res) => {
    try {
      const { quote, note, action, title, intention, author } = req.body;
      if (!quote) {
        return res.status(400).json({ error: "需要选择划线的文本/名句" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ 
          error: "未检测到 API 密钥。请在侧边菜单栏中的【Settings > Secrets】中配置您的 GEMINI_API_KEY。" 
        });
      }

      const ai = getAI();
      const modelName = "gemini-3.5-flash";

      let systemInstruction = "";
      let prompt = "";

      if (action === "explain") {
        systemInstruction = `你是一位专注、深刻的书籍阅读伴侣与学者。你的任务是帮助读者解析和延伸他们划线提取的名句。
你的分析必须极其精准、隽永、富有文学思辨色彩，具有传统的纸张阅读感。不要用长篇套话，开门见山，直击核心，从哲学、逻辑或其社会人类学背景进行解析。
读者的当前阅读目标是: "${intention || '无特设目标（通读）'}"。请务必巧妙地把该目标作为分析的最终锚点，解决读者的诉求。
字数限制在 120-200 字之间，段落工整雅致，直接输出正文，不要有任何多余的引言、冒号引导、自我介绍或过渡语。`;
        prompt = `书籍：《${title}》 (作者：${author})
当前划线名句：
“${quote}”

读者批注：
“${note || '（未写下批注，请仅对划线重点本身深度解析）'}”

请针对这句话进行“解释/深度剖析”。`;
      } else if (action === "challenge") {
        systemInstruction = `你是一位犀利、博学又克制的思想辩论者，作为读者沉浸思考的“魔鬼代言人”。你的任务是对划线名句或观点的盲区进行针锋相对的思辨、反驳或局限性拆解，激发读者形成多维视角的独立判断。
反驳言辞应冷静客观、深刻大方，直捣逻辑脆弱部分，并非情绪化抬杠。
读者的当前阅读目标是: "${intention || '无特设目标（通读）'}"。请结合此目标的实践落地路径，对其局限性或反向视角进行警示和质问。
字数限制在 120-200 字之间，分段简明利落，直接输出正文，绝对不要有废话前言或总结尾缀。`;
        prompt = `书籍：《${title}》 (作者：${author})
当前划线名句：
“${quote}”

读者批注：
“${note || '（无）'}”

请针对这句话或观点，提出能刺痛思维、开阔视野的“反驳与思辨”。`;
      } else if (action === "associate") {
        systemInstruction = `你是一位知识积淀极其深厚、富有洞察力的创意跨界学家。你的任务是将这句名句中的关键论义，同其他前沿学科理论（例如心理学、行为遗传、经济模型、设计力学）、历史典故、或者现实生活与现代科技产品的杰出设计实践（例如苹果界面、任天堂叙事等）建立奇妙、高含金量的跨界联想。
强烈的跨界对照感能对心智进行彻底的撞击，提供新奇灵感。
读者的当前阅读目标是: "${intention || '无特设目标（通读）'}"。请以此目标的使用落脚点为线索，寻找对这个目标最有关联启示的意象与逻辑。
字数限制在 120-200 字之间，段落分明，直接输出正文，删除客套话。`;
        prompt = `书籍：《${title}》 (作者：${author})
当前划线名句：
“${quote}”

读者批注：
“${note || '（无）'}”

请提供一段有醍醐灌顶感、精彩绝伦的跨领域“联想与对照”。`;
      } else {
        systemInstruction = `你是一位优雅深沉的深读助手。`;
        prompt = `请对以下内容写简要分析: "${quote}"`;
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.8,
        }
      });

      const text = response.text || "未能生成回应，请在稍后重试。";
      res.json({ text });

    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message || "请求服务器出错，请稍后重试。" });
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
