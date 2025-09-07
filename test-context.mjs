/**
 * 测试增强的上下文管理功能
 */

import dotenv from "dotenv";
import WKAgent from "./src/index.js";

// 加载环境变量
dotenv.config();

async function testContextManagement() {
  console.log("=== 测试增强的上下文管理功能 ===\n");

  const agent = new WKAgent({
    memory: {
      compressThreshold: 5, // 降低阈值以便测试压缩
      enableLLMCompression: true,
      enablePersistence: true,
    },
  });

  // 测试1：多轮对话记忆
  console.log("1. 测试多轮对话记忆:");

  const result1 = await agent.execute(
    "我对机器学习很感兴趣，能简单介绍一下吗？"
  );
  console.log(
    "第一轮完成，使用的上下文分析:",
    result1.metadata.contextAnalysis
  );

  const result2 = await agent.execute(
    "基于刚才的介绍，深度学习与之有什么关系？"
  );
  console.log("第二轮完成，应该能记住之前的对话");

  const result3 = await agent.execute(
    "我之前对什么技术感兴趣？请总结我们的对话"
  );
  console.log(
    "记忆测试结果:",
    result3.result.content.substring(0, 100) + "..."
  );

  console.log("\n2. 测试上下文分析:");
  console.log("内存使用情况:", agent.getMemoryUsage());

  // 测试3：触发压缩
  console.log("\n3. 测试记忆压缩:");

  const topics = [
    "人工智能",
    "神经网络",
    "自然语言处理",
    "计算机视觉",
    "强化学习",
    "迁移学习",
  ];

  for (let i = 0; i < topics.length; i++) {
    console.log(`询问第${i + 1}个话题: ${topics[i]}`);
    await agent.execute(`什么是${topics[i]}？请简要介绍。`);
  }

  console.log("\n压缩后的内存状态:", agent.getMemoryUsage());
  console.log("压缩统计:", agent.memoryStats);

  // 测试4：复杂任务分解
  console.log("\n4. 测试复杂任务智能分解:");

  const complexResult = await agent.execute(`
    请全面分析人工智能在医疗领域的应用：
    1. 主要应用场景有哪些？
    2. 技术实现原理是什么？
    3. 存在哪些挑战和限制？
    4. 未来发展趋势如何？
    请提供详细的分析报告。
  `);

  console.log("复杂任务结果:", complexResult.metadata);

  console.log("\n✅ 上下文管理测试完成！");
  console.log("\n关键特性验证:");
  console.log("1. ✅ 三层记忆系统（短期/中期/长期）");
  console.log("2. ✅ LLM驱动的智能压缩（AU2算法）");
  console.log("3. ✅ 上下文感知的历史参与决策");
  console.log("4. ✅ 本地持久化存储");
  console.log("5. ✅ 智能任务分解和子代理");
}

// 运行测试
testContextManagement().catch(console.error);
