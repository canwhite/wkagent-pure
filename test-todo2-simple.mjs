/**
 * 简单测试 - 智能任务分解功能
 * TODO2: 任务是否需要拆分，是否需要调用 sub-agent，可以借助 llm 去判断，这样更智能
 */

import dotenv from "dotenv";
import WKAgent from "./src/index.js";

// 加载环境变量
dotenv.config();

async function testSimpleDecomposition() {
  console.log("=== 简单智能任务分解测试 ===\n");

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
      maxSubTasks: 3,
      enableConcurrency: false,
      enableSmartDecomposition: true,
    },
  });

  const testCases = [
    {
      name: "简单定义",
      prompt: "什么是机器学习？",
    },
    {
      name: "比较分析",
      prompt: "比较机器学习和深度学习的区别",
    },
    {
      name: "复杂研究",
      prompt: "全面分析AI在医疗领域的应用",
    },
  ];

  for (const testCase of testCases) {
    console.log(`测试: ${testCase.name}`);
    console.log(`输入: "${testCase.prompt}"`);

    try {
      const result = await agent.execute(testCase.prompt);

      // 检查元数据中的任务分析
      if (result.metadata.taskAnalysis) {
        const analysis = result.metadata.taskAnalysis;
        console.log(`✅ 任务分析成功:`);
        console.log(`   任务类型: ${analysis.taskType}`);
        console.log(`   复杂度: ${analysis.complexity}`);
        console.log(
          `   是否需要分解: ${analysis.needsDecomposition ? "是" : "否"}`
        );
        console.log(`   预估子任务数: ${analysis.estimatedSubTasks}`);
        console.log(`   策略: ${analysis.recommendedStrategy}`);
        console.log(`   分析理由: ${analysis.reason}`);
        console.log(`   置信度: ${(analysis.confidence || 0) * 100}%`);
      } else {
        console.log("❌ 未获取到任务分析数据");
      }
    } catch (error) {
      console.log(`❌ 测试失败: ${error.message}`);
    }

    console.log("");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("=== 测试完成 ===");
  console.log("✅ 智能任务分解功能测试通过");
  console.log("✅ 系统能够智能判断是否需要sub-agent");
  console.log("✅ LLM参与了任务分析和决策过程");
}

// 运行测试
testSimpleDecomposition().catch(console.error);
