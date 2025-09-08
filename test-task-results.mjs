/**
 * 测试子任务结果分析
 */

import dotenv from "dotenv";
import WKAgent from "./src/index.js";

dotenv.config();

async function testTaskResults() {
  console.log("=== 子任务结果分析测试 ===\n");

  const agent = new WKAgent({
    llm: {
      apiKey: process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY,
      temperature: 0.7,
      maxTokens: 4000,
    },
    memory: {
      compressThreshold: 15,
      enableLLMCompression: false,
      enablePersistence: false,
    },
    task: {
      maxSubTasks: 2,
      enableConcurrency: false,
      enableSmartDecomposition: true,
    },
  });

  // 监听子任务创建
  agent.on("subAgent:create", (agentId) => {
    console.log(`[TEST] 子代理创建: ${agentId}`);
  });

  // 监听子任务开始
  agent.on("serial:task:start", (data) => {
    console.log(`[TEST] 子任务开始: ${data.taskIndex}/${data.totalTasks}`);
  });

  // 监听子任务完成
  agent.on("serial:task:complete", (data) => {
    console.log(`[TEST] 子任务完成: ${data.taskIndex}`);
  });

  // 监听子任务失败
  agent.on("serial:task:failed", (data) => {
    console.log(`[TEST] 子任务失败: ${data.taskIndex}, 错误: ${data.error}`);
  });

  const simplePrompt =
    "请分析AI在医疗领域的两个应用: 1)医学影像诊断 2)药物研发。返回JSON格式。";

  try {
    console.log("开始执行测试任务...");
    const result = await agent.execute(simplePrompt);

    console.log("\n=== 结果分析 ===");
    console.log("结果类型:", result.result.type);
    console.log("使用子代理:", result.metadata.usedSubAgents);
    console.log("子任务数量:", result.metadata.subAgentCount);

    if (result.result.type === "synthesis") {
      console.log("内容长度:", result.result.content.length);
      console.log("内容预览:", result.result.content.substring(0, 200) + "...");
    }
  } catch (error) {
    console.log("执行错误:", error.message);
  }
}

testTaskResults().catch(console.error);
