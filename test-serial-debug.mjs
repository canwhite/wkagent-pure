/**
 * 调试串行执行配置问题
 */

import dotenv from "dotenv";
import WKAgent from "./src/index.js";

// 加载环境变量
dotenv.config();

async function testSerialDebug() {
  console.log("=== 串行执行配置调试 ===\n");

  const agent = new WKAgent({
    memory: {
      compressThreshold: 15,
      enableLLMCompression: false,
      enablePersistence: false,
    },
    task: {
      maxSubTasks: 3,
      enableConcurrency: false, // 强制串行执行
      enableSmartDecomposition: true,
    },
  });

  console.log("Agent配置:");
  console.log("- enableConcurrency:", agent.config.task.enableConcurrency);
  console.log("- maxSubTasks:", agent.config.task.maxSubTasks);
  console.log(
    "- enableSmartDecomposition:",
    agent.config.task.enableSmartDecomposition
  );

  // 监听事件以确认执行模式
  agent.on("serial:start", (data) => {
    console.log(`\n执行模式确认: ${data.executionMode}`);
    console.log(`总任务数: ${data.totalTasks}`);
  });

  const simplePrompt = `请分析人工智能在医疗和教育两个领域的应用，返回JSON格式:{result:{
    info:"我要的最终结果"
  }}`;

  try {
    console.log("\n开始执行简单测试任务...");
    const result = await agent.execute(simplePrompt);

    console.log("\n任务完成!");
    console.log("result:", JSON.stringify(result));
    console.log("结果类型:", result.result.type);
    console.log("是否使用子代理:", result.metadata.usedSubAgents);
    console.log("子任务数量:", result.metadata.subAgentCount);
  } catch (error) {
    console.log("执行错误:", error.message);
  }
}

// 运行调试测试
testSerialDebug().catch(console.error);
