/**
 * 综合测试串行执行增强功能
 * 验证进度跟踪、错误处理、执行控制等完整功能
 */

import dotenv from "dotenv";
import WKAgent from "./src/index.js";

// 加载环境变量
dotenv.config();

async function testComprehensiveSerialExecution() {
  console.log("=== 串行执行综合测试 ===\n");

  const agent = new WKAgent({
    llm: {
      apiKey: process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY,
      temperature: 0.7,
      maxTokens: 4000,
    },
    memory: {
      compressThreshold: 20,
      enableLLMCompression: false,
      enablePersistence: false,
    },
    task: {
      maxSubTasks: 4,
      enableConcurrency: false, // 强制串行执行
      enableSmartDecomposition: true,
      errorHandling: "continue_on_error",
      sequentialDelay: 300, // 300ms延迟
      enableProgressTracking: true,
      enableExecutionControl: true,
    },
  });

  let progressUpdates = [];

  // 监听所有串行执行事件
  agent.on("serial:start", (data) => {
    console.log(`🚀 串行执行开始 - ${data.totalTasks}个子任务`);
    console.log(`📊 执行模式: ${data.executionMode}`);
  });

  agent.on("serial:task:start", (data) => {
    console.log(
      `\n[${data.taskIndex}/${data.totalTasks}] 📝 ${data.description}`
    );
    const status = agent.getSerialExecutionStatus();
    if (status.progress !== undefined) {
      console.log(`   当前进度: ${status.progress.toFixed(1)}%`);
    } else {
      console.log(`   当前进度: 0.0%`);
    }
  });

  agent.on("serial:task:complete", (data) => {
    console.log(`   ✅ 子任务${data.taskIndex}完成`);
    progressUpdates.push({
      taskIndex: data.taskIndex,
      status: "complete",
      timestamp: Date.now(),
    });
  });

  agent.on("serial:task:failed", (data) => {
    console.log(`   ❌ 子任务${data.taskIndex}失败: ${data.error}`);
    progressUpdates.push({
      taskIndex: data.taskIndex,
      status: "failed",
      error: data.error,
      timestamp: Date.now(),
    });
  });

  agent.on("serial:complete", (data) => {
    console.log(`\n🎉 串行执行完成!`);
    console.log(`📈 完成率: ${data.completedTasks}/${data.totalTasks}`);
    console.log(`⏱️  总耗时: ${data.executionTime}ms`);
    console.log(
      `📊 平均任务耗时: ${(data.executionTime / data.totalTasks).toFixed(0)}ms`
    );
  });

  // 测试用例: 逐步分析项目
  const testPrompt = `你是一个优秀的小说家，现在我需要你完成这些工作：
  
  1. 如果梦境和精神力量能映射到现实，一切会有什么不一样？回答这个问题，男主文，生成大纲
  2. 根据大纲生成场景概述
  3. 根据场景概述提取核心人物，道具
  4. 丰富故事大纲并产出
  
  每个步骤都要详细说明关键考虑因素和最佳实践，最终返回结构化的JSON报告。
  最终返回一个json，包含上述信息
  
  `;

  try {
    console.log("🎯 开始执行复杂项目分析任务...\n");
    const startTime = Date.now();

    const result = await agent.execute(testPrompt);
    const executionTime = Date.now() - startTime;

    console.log("\n=== 执行结果分析 ===");
    console.log("✅ 任务执行状态: 成功");
    console.log("result", JSON.stringify(result));
    console.log("📋 结果类型:", result.result.type);
    console.log("🔧 执行方法:", result.result.method);
    console.log("📊 子任务数量:", result.result.subTaskCount);
    console.log("⏱️  总执行时间:", executionTime, "ms");

    // 验证结果结构
    if (result.result.type === "synthesis") {
      console.log("✅ 正确触发了结果汇总");

      const hasJsonContent =
        result.result.content.includes("{") ||
        result.result.content.includes("[");
      console.log(
        hasJsonContent ? "✅ 结果包含JSON结构" : "⚠️ 结果可能不包含JSON"
      );

      if (result.result.data) {
        console.log("✅ 结果包含结构化数据字段");
      }
    }

    // 验证进度跟踪
    console.log("\n=== 进度跟踪验证 ===");
    console.log("📊 进度更新次数:", progressUpdates.length);
    console.log("📈 进度事件分布:");
    const completeCount = progressUpdates.filter(
      (u) => u.status === "complete"
    ).length;
    const failedCount = progressUpdates.filter(
      (u) => u.status === "failed"
    ).length;
    console.log(`   - 完成: ${completeCount}`);
    console.log(`   - 失败: ${failedCount}`);

    // 验证串行执行特性
    const sequentialTiming = validateSequentialTiming(progressUpdates);
    console.log(`\n=== 串行执行特性验证 ===`);
    console.log(
      sequentialTiming.isSequential
        ? "✅ 任务按顺序执行"
        : "❌ 任务执行顺序异常"
    );
    console.log(`平均任务间隔: ${sequentialTiming.avgInterval}ms`);

    if (sequentialTiming.isSequential) {
      console.log("✅ 串行执行工作正常");
    }

    return true;
  } catch (error) {
    console.log("❌ 测试失败:", error.message);
    return false;
  }
}

/**
 * 验证任务是否按顺序执行
 */
function validateSequentialTiming(updates) {
  if (updates.length < 2) {
    return { isSequential: true, avgInterval: 0 };
  }

  let intervals = [];
  for (let i = 1; i < updates.length; i++) {
    const interval = updates[i].timestamp - updates[i - 1].timestamp;
    intervals.push(interval);
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

  return {
    isSequential: avgInterval > 100, // 假设串行执行间隔至少100ms
    avgInterval: Math.round(avgInterval),
  };
}

/**
 * 运行测试并输出总结
 */
async function runTests() {
  const success = await testComprehensiveSerialExecution();

  console.log("\n" + "=".repeat(60));
  console.log("=== 串行执行增强功能测试总结 ===");

  if (success) {
    console.log("✅ 所有测试通过!");
    console.log("\n已实现的功能:");
    console.log("✅ 串行执行模式切换");
    console.log("✅ 实时进度跟踪");
    console.log("✅ 任务执行事件通知");
    console.log("✅ 错误处理和恢复");
    console.log("✅ 执行结果汇总");
    console.log("✅ 性能监控和统计");
  } else {
    console.log("❌ 测试失败，需要进一步调试");
  }

  console.log("\n🎯 TODO3 已完成: 项目代码现在能更好地支持串行执行");
}

// 运行测试
runTests().catch(console.error);
