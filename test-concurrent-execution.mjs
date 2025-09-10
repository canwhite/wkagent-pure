#!/usr/bin/env node

import dotenv from "dotenv";
import WKAgent from "./src/index.js";

// 加载环境变量
dotenv.config();

/**
 * 测试并发执行功能
 * 验证多 sub-agent 并发执行的效果和性能
 */
async function testConcurrentExecution() {
  console.log("🚀=== 并发执行测试 ===🚀\n");

  // 配置1: 启用并发，允许多个子任务同时执行
  const concurrentAgent = new WKAgent({
    llm: {
      apiKey: process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY,
      temperature: 0.7,
      maxTokens: 1500,
    },
    task: {
      maxSubTasks: 5, // 最多5个并发子任务
      enableConcurrency: true, // 启用并发
      enableSmartDecomposition: true,
      errorHandling: "continue_on_error",
      sequentialDelay: 0,
      enableProgressTracking: true,
      forceJSON: true,
    },
    memory: {
      maxShortTerm: 20,
      compressThreshold: 0.8,
      enableLLMCompression: false,
      enablePersistence: false,
    },
    context: {
      enableHistoryAnalysis: true,
      enableContextInjection: true,
      maxContextMessages: 10,
    },
  });

  // 配置2: 禁用并发，串行执行对比
  const serialAgent = new WKAgent({
    llm: {
      apiKey: process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY,
      temperature: 0.7,
      maxTokens: 1500,
    },
    task: {
      maxSubTasks: 5,
      enableConcurrency: false, // 禁用并发，串行执行
      enableSmartDecomposition: true,
      errorHandling: "continue_on_error",
      sequentialDelay: 500, // 串行延迟500ms
      enableProgressTracking: true,
      forceJSON: true,
    },
    memory: {
      maxShortTerm: 20,
      compressThreshold: 0.8,
      enableLLMCompression: false,
      enablePersistence: false,
    },
    context: {
      enableHistoryAnalysis: true,
      enableContextInjection: true,
      maxContextMessages: 10,
    },
  });

  // 测试任务：多维度小说分析
  const testPrompt = `
    对以下小说片段进行综合分析和评估，需要从多个维度展开：

    小说片段：
    萧景珩蜷缩在废弃观星台的角落，冷汗浸透了后背的衣衫。空气中弥漫着腐朽木梁的霉味，混合着后颈触须残留的黏液散发出的腥甜气息，令他胃部一阵阵痉挛。远处传来枯枝断裂的脆响，三个侍卫正以诡异姿态前行，他们的膝盖反向弯曲，每走一步都伴随虫鸣般的异响。

    请从以下维度进行分析，每个维度作为一个子任务：
    1. 文学风格分析（修辞手法、语言特色、氛围营造）
    2. 人物心理刻画（情绪变化、心理活动、性格特征）
    3. 世界观设定分析（玄幻元素、规则体系、逻辑一致性）
    4. 情节结构评估（起承转合、悬念设置、节奏控制）
    5. 感官描写效果（视觉、听觉、嗅觉、触觉的多维度体验）

    要求：
    - 每个维度单独分析，提供详细评价
    - 返回JSON格式，包含评分（1-10）和详细分析
    - 分析要深入具体，避免泛泛而谈
  `;

  console.log("📊 测试1: 并发执行模式");
  console.log("配置: maxSubTasks=5, enableConcurrency=true");

  // 监听并发执行事件
  let concurrentEvents = [];
  concurrentAgent.on("subagent:create", (data) => {
    concurrentEvents.push({
      type: "create",
      timestamp: Date.now(),
      subTaskId: data.subTaskId || data.id,
    });
  });

  concurrentAgent.on("subagent:complete", (data) => {
    concurrentEvents.push({
      type: "complete",
      timestamp: Date.now(),
      subTaskId: data.subTaskId || data.id,
      success: data.success,
    });
  });

  const concurrentStartTime = Date.now();
  const concurrentResult = await concurrentAgent.execute(testPrompt);
  const concurrentDuration = Date.now() - concurrentStartTime;

  console.log("并发执行结果:");
  console.log("- total result", concurrentResult);
  console.log("- 执行成功:", concurrentResult.success);
  console.log("- 总耗时:", concurrentDuration, "ms");
  console.log("- 使用子代理:", concurrentResult.metadata?.usedSubAgents);
  console.log("- 子任务数量:", concurrentResult.metadata?.subAgentCount);
  console.log("- 提取到JSON:", !!concurrentResult.json);

  if (concurrentResult.json) {
    console.log("- 分析维度数量:", Object.keys(concurrentResult.json).length);
    console.log("- 各维度评分:");
    for (const [dimension, data] of Object.entries(concurrentResult.json)) {
      console.log(`  ${dimension}: ${data.score || "N/A"}/10`);
    }
  }

  // 分析并发事件
  if (concurrentEvents.length > 0) {
    console.log("\n并发执行事件分析:");
    const createEvents = concurrentEvents.filter((e) => e.type === "create");
    const completeEvents = concurrentEvents.filter(
      (e) => e.type === "complete"
    );
    console.log("- 子代理创建数:", createEvents.length);
    console.log("- 子代理完成数:", completeEvents.length);

    if (createEvents.length > 1) {
      const firstCreate = Math.min(...createEvents.map((e) => e.timestamp));
      const lastCreate = Math.max(...createEvents.map((e) => e.timestamp));
      const createSpread = lastCreate - firstCreate;
      console.log("- 子代理创建时间跨度:", createSpread, "ms");

      if (createSpread < 100) {
        console.log("- ✅ 检测到并发创建：子代理几乎同时创建");
      } else {
        console.log("- ℹ️  串行创建：子代理依次创建");
      }
    }
  }

  console.log("\n" + "=".repeat(50) + "\n");

  console.log("📊 测试2: 串行执行模式");
  console.log(
    "配置: maxSubTasks=5, enableConcurrency=false, sequentialDelay=500ms"
  );

  // 监听串行执行事件
  let serialEvents = [];
  let serialStartTime = null;

  serialAgent.on("serial:start", (data) => {
    serialStartTime = Date.now();
    console.log(
      "串行执行开始:",
      data.executionMode,
      "总任务数:",
      data.totalTasks
    );
  });

  serialAgent.on("serial:task:start", (data) => {
    serialEvents.push({
      type: "task_start",
      timestamp: Date.now(),
      taskIndex: data.taskIndex,
      taskId: data.taskId,
    });
  });

  serialAgent.on("serial:task:complete", (data) => {
    serialEvents.push({
      type: "task_complete",
      timestamp: Date.now(),
      taskIndex: data.taskIndex,
      taskId: data.taskId,
      success: data.success,
    });
  });

  const serialStartTime2 = Date.now();
  const serialResult = await serialAgent.execute(testPrompt);
  const serialDuration = Date.now() - serialStartTime2;

  console.log("串行执行结果:");
  console.log("- 执行成功:", serialResult.success);
  console.log("- 总耗时:", serialDuration, "ms");
  console.log("- 使用子代理:", serialResult.metadata?.usedSubAgents);
  console.log("- 子任务数量:", serialResult.metadata?.subAgentCount);
  console.log("- 提取到JSON:", !!serialResult.json);

  if (serialResult.json) {
    console.log("- 分析维度数量:", Object.keys(serialResult.json).length);
    console.log("- 各维度评分:");
    for (const [dimension, data] of Object.entries(serialResult.json)) {
      console.log(`  ${dimension}: ${data.score || "N/A"}/10`);
    }
  }

  // 分析串行执行事件
  if (serialEvents.length > 0) {
    console.log("\n串行执行事件分析:");
    const startEvents = serialEvents.filter((e) => e.type === "task_start");
    const completeEvents = serialEvents.filter(
      (e) => e.type === "task_complete"
    );
    console.log("- 子任务开始事件:", startEvents.length);
    console.log("- 子任务完成事件:", completeEvents.length);

    if (startEvents.length > 1) {
      for (let i = 1; i < startEvents.length; i++) {
        const interval =
          startEvents[i].timestamp - startEvents[i - 1].timestamp;
        console.log(`- 任务${i}与任务${i + 1}开始间隔: ${interval}ms`);
      }
    }
  }

  console.log("\n" + "=".repeat(60) + "\n");
  console.log("📈 性能对比分析");
  console.log(`并发执行耗时: ${concurrentDuration}ms`);
  console.log(`串行执行耗时: ${serialDuration}ms`);
  console.log(
    `性能提升: ${(
      ((serialDuration - concurrentDuration) / serialDuration) *
      100
    ).toFixed(1)}%`
  );

  if (concurrentResult.json && serialResult.json) {
    const concurrentKeys = Object.keys(concurrentResult.json);
    const serialKeys = Object.keys(serialResult.json);
    console.log(`并发分析维度: ${concurrentKeys.length}`);
    console.log(`串行分析维度: ${serialKeys.length}`);

    // 对比评分一致性
    let scoreDifferences = [];
    for (const key of concurrentKeys) {
      if (serialResult.json[key]) {
        const diff = Math.abs(
          (concurrentResult.json[key].score || 0) -
            (serialResult.json[key].score || 0)
        );
        scoreDifferences.push(diff);
      }
    }

    if (scoreDifferences.length > 0) {
      const avgDifference =
        scoreDifferences.reduce((a, b) => a + b, 0) / scoreDifferences.length;
      console.log(`评分平均差异: ${avgDifference.toFixed(2)}分`);
      console.log(
        `评分一致性: ${
          avgDifference < 1
            ? "✅ 高度一致"
            : avgDifference < 2
            ? "ℹ️ 基本一致"
            : "⚠️ 存在差异"
        }`
      );
    }
  }

  console.log("\n🎯 测试结论:");
  if (concurrentDuration < serialDuration) {
    console.log("✅ 并发执行显著提升性能");
  } else {
    console.log("ℹ️  并发执行性能优势不明显，可能受API限制或任务特性影响");
  }

  console.log("\n💡 关键发现:");
  console.log("- 并发模式适合独立性强、可并行处理的任务");
  console.log("- 串行模式适合有依赖关系、需要顺序执行的任务");
  console.log("- 实际并发效果取决于API响应速度和任务分解质量");
  console.log("- 进度跟踪功能让用户能实时了解执行状态");
}

// 运行并发测试
testConcurrentExecution().catch(console.error);
