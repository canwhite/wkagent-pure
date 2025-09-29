/**
 * Messages系统测试文件
 * 测试修复后的关键功能和逻辑漏洞
 */

import WKAgent from "./src/wkagent-pure.js";

/*
 消息串联逻辑线：

  用户输入 → processSingleTask() → analyzeTask() → buildEnhancedMessageHistory()

  ↓

  buildEnhancedMessageHistory() → 构建统一system消息 → 加载长期/中期记忆 → 整合上下文分析 → 添加用户输入

  ↓

  统一消息 → callLLM() → llmClient.call() → LLM响应

  ↓

  LLM响应 → 需要任务分解 → decomposeAndExecuteTasks()

  ↓

  decomposeAndExecuteTasks() → 为每个子任务调用executeSubTask()

  ↓

  executeSubTask() → 构建子任务专用消息 → 包含前置结果 → callLLM() → 子任务结果

  ↓

  子任务结果 → synthesizeResults() → 智能汇总 → 最终响应

  ↓

  最终响应 → 返回给用户 → addToShortTerm() → 更新记忆系统

*/

// 模拟LLMClient
class MockLLMClient {
  constructor(config) {
    this.config = config;
  }

  async call(messages, options = {}) {
    // 模拟LLM响应
    return {
      success: true,
      content: `Mock response for: ${
        messages[messages.length - 1]?.content || "unknown"
      }`,
    };
  }
}

// 测试工具函数
function createTestAgent(config = {}) {
  const agent = new WKAgent({
    ...config,
    llm: {
      apiKey: "test-key",
      baseURL: "http://localhost",
      model: "test-model",
      maxTokens: 4000,
      temperature: 0.7,
      ...config.llm,
    },
  });

  // 替换为模拟客户端
  agent.llmClient = new MockLLMClient(agent.config.llm);

  return agent;
}

function assertEquals(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`❌ ${message}`);
    console.error(`   期望: ${JSON.stringify(expected)}`);
    console.error(`   实际: ${JSON.stringify(actual)}`);
    return false;
  }
  console.log(`✅ ${message}`);
  return true;
}

function assertTrue(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    return false;
  }
  console.log(`✅ ${message}`);
  return true;
}

function assertFalse(condition, message) {
  if (condition) {
    console.error(`❌ ${message}`);
    return false;
  }
  console.log(`✅ ${message}`);
  return true;
}

async function testMessagesSystem() {
  console.log("🧪 开始测试Messages系统...\n");

  let passedTests = 0;
  let totalTests = 0;

  // 测试1: 多个system消息合并
  totalTests++;
  console.log("📋 测试1: 多个system消息合并");
  try {
    const agent = createTestAgent({
      isHistoryAnalysis: true,
      context: {
        enableContextInjection: true,
        maxContextMessages: 50,
      },
    });

    // 添加一些测试数据
    agent.longTerm.set("test_key_1", {
      content: "长期记忆测试数据",
      timestamp: Date.now(),
    });
    agent.mediumTerm.push({
      type: "test_summary",
      content: "中期记忆测试摘要",
      keyPoints: ["测试点1", "测试点2"],
      timestamp: Date.now(),
    });

    const contextAnalysis = {
      keyPoints: ["测试", "分析"],
      recommendations: ["建议1", "建议2"],
      confidence: 0.8,
    };

    const messages = agent.buildEnhancedMessageHistory(
      "测试用户输入",
      {},
      contextAnalysis
    );

    // 检查只有一个system消息
    const systemMessages = messages.filter((m) => m.role === "system");
    const systemMessageCount = systemMessages.length;

    assertTrue(
      systemMessageCount === 1,
      `应该只有一个system消息，实际: ${systemMessageCount}`
    );

    // 检查system消息包含所有内容
    const systemContent = systemMessages[0].content;
    const containsAllParts =
      systemContent.includes("智能助手") &&
      systemContent.includes("长期记忆") &&
      systemContent.includes("中期记忆") &&
      systemContent.includes("上下文建议");

    assertTrue(containsAllParts, "system消息应该包含所有部分的内容");
    passedTests++;
  } catch (error) {
    console.error(`❌ 测试1失败: ${error.message}`);
  }

  console.log();

  // 测试2: 消息长度控制
  totalTests++;
  console.log("📋 测试2: 消息长度控制");
  try {
    const agent = createTestAgent({
      llm: { maxTokens: 1000 }, // 设置较小的token限制
      isHistoryAnalysis: true,
    });

    // 添加大量数据以触发长度限制
    for (let i = 0; i < 20; i++) {
      agent.longTerm.set(`test_key_${i}`, {
        content: "x".repeat(200), // 长内容
        timestamp: Date.now(),
      });
    }

    const contextAnalysis = {
      keyPoints: Array(50).fill("测试"),
      recommendations: Array(20).fill("建议"),
      confidence: 0.8,
    };

    const messages = agent.buildEnhancedMessageHistory(
      "简短用户输入",
      {},
      contextAnalysis
    );

    const totalTokens = agent.estimateTotalMessageTokens(messages);
    const maxLimit = 1000 - 1000; // maxTokens - safetyBuffer

    assertTrue(
      totalTokens <= maxLimit,
      `总token数应该在限制内: ${totalTokens} <= ${maxLimit}`
    );
    passedTests++;
  } catch (error) {
    console.error(`❌ 测试2失败: ${error.message}`);
  }

  console.log();

  // 测试3: 消息去重功能
  totalTests++;
  console.log("📋 测试3: 消息去重功能");
  try {
    const agent = createTestAgent();

    const testMessages = [
      { role: "user", content: "重复消息" },
      { role: "assistant", content: "回复1" },
      { role: "user", content: "重复消息" }, // 重复
      { role: "user", content: "唯一消息" },
      { role: "assistant", content: "回复1" }, // 重复
    ];

    const uniqueMessages = agent.deduplicateMessages(testMessages);

    assertEquals(uniqueMessages.length, 3, "去重后应该有3条唯一消息");

    // 验证具体内容
    const contents = uniqueMessages.map((m) => m.content);
    assertTrue(contents.includes("重复消息"), "应该包含重复消息");
    assertTrue(contents.includes("唯一消息"), "应该包含唯一消息");
    assertTrue(contents.includes("回复1"), "应该包含回复1");
    passedTests++;
  } catch (error) {
    console.error(`❌ 测试3失败: ${error.message}`);
  }

  console.log();

  // 测试4: 消息顺序优化
  totalTests++;
  console.log("📋 测试4: 消息顺序优化");
  try {
    const agent = createTestAgent({
      isHistoryAnalysis: true,
    });

    // 添加短期记忆数据
    agent.shortTerm = [
      { role: "user", content: "历史用户消息1", timestamp: Date.now() },
      { role: "assistant", content: "历史助手回复1", timestamp: Date.now() },
      { role: "user", content: "历史用户消息2", timestamp: Date.now() },
    ];

    const contextAnalysis = {
      keyPoints: ["测试"],
      recommendations: [],
      confidence: 0.5,
    };

    const messages = agent.buildEnhancedMessageHistory(
      "当前用户输入",
      {},
      contextAnalysis
    );

    // 检查消息顺序
    assertTrue(messages[0].role === "system", "第一条应该是system消息");
    assertTrue(
      messages[messages.length - 1].role === "user",
      "最后一条应该是user消息"
    );
    assertTrue(
      messages[messages.length - 1].content === "当前用户输入",
      "最后一条应该是当前用户输入"
    );
    passedTests++;
  } catch (error) {
    console.error(`❌ 测试4失败: ${error.message}`);
  }

  console.log();

  // 测试5: token估算和截断
  totalTests++;
  console.log("📋 测试5: token估算和截断");
  try {
    const agent = createTestAgent();

    const longContent = "x".repeat(1000);
    const truncated = agent.truncateContentToTokenLimit(longContent, 100);

    assertTrue(truncated.length < longContent.length, "截断后的内容应该更短");
    assertTrue(truncated.includes("截断"), "截断内容应该包含截断标记");

    const shortContent = "短内容";
    const notTruncated = agent.truncateContentToTokenLimit(shortContent, 100);
    assertEquals(notTruncated, shortContent, "短内容不应该被截断");
    passedTests++;
  } catch (error) {
    console.error(`❌ 测试5失败: ${error.message}`);
  }

  console.log();

  // 测试6: 子任务消息构建优化
  totalTests++;
  console.log("📋 测试6: 子任务消息构建优化");
  try {
    const agent = createTestAgent();

    const parentMessages = [
      {
        role: "system",
        content: "你是一个智能助手，能够分析任务并提供结构化回答。",
      },
      { role: "user", content: "原始用户输入" },
    ];

    const subTask = {
      id: "test_subtask",
      description: "测试子任务",
      priority: 1,
      estimatedComplexity: "medium",
    };

    const cumulativeResults = [
      { description: "前置任务1", result: "前置结果1内容" },
    ];

    const subTaskResult = await agent.executeSubTask(
      subTask,
      parentMessages,
      {},
      null,
      cumulativeResults
    );

    // 验证返回结果结构
    assertTrue(
      subTaskResult && typeof subTaskResult === "object",
      "executeSubTask应该返回对象"
    );
    assertTrue(
      subTaskResult.subTaskId === "test_subtask",
      "应该包含正确的subTaskId"
    );
    assertTrue(subTaskResult.success === true, "应该标记为成功");
    assertTrue(
      subTaskResult.result && subTaskResult.result.content,
      "应该包含LLM响应结果"
    );

    // 检查结果内容
    assertTrue(
      subTaskResult.result && subTaskResult.result.success,
      "结果应该标记为成功"
    );
    assertTrue(
      subTaskResult.result.content &&
        typeof subTaskResult.result.content === "string",
      "结果应该包含content字符串"
    );
    passedTests++;
  } catch (error) {
    console.error(`❌ 测试6失败: ${error.message}`);
  }

  console.log();

  // 测试7: 系统提示核心信息提取
  totalTests++;
  console.log("📋 测试7: 系统提示核心信息提取");
  try {
    const agent = createTestAgent();

    const genericPrompt = "你是一个智能助手";
    const specificPrompt = `你是一个智能助手

配置要求：
- 使用JSON格式输出
- 限制token使用在1000以内
- 注意数据准确性

模式：分析模式`;

    const genericResult = agent.extractCoreSystemInfo(genericPrompt);
    const specificResult = agent.extractCoreSystemInfo(specificPrompt);

    assertEquals(genericResult, null, "通用提示应该返回null");
    assertTrue(specificResult !== null, "特定提示应该返回核心信息");
    assertTrue(specificResult.includes("配置"), "核心信息应该包含配置");
    assertTrue(specificResult.includes("模式"), "核心信息应该包含模式");
    passedTests++;
  } catch (error) {
    console.error(`❌ 测试7失败: ${error.message}`);
  }

  console.log();

  // 测试结果总结
  console.log("🎯 测试总结");
  console.log(`====================================`);
  console.log(`通过测试: ${passedTests}/${totalTests}`);
  console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (passedTests === totalTests) {
    console.log("🎉 所有测试通过！Messages系统修复成功！");
  } else {
    console.log(`⚠️  有 ${totalTests - passedTests} 个测试失败`);
  }

  return passedTests === totalTests;
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testMessagesSystem()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("测试运行失败:", error);
      process.exit(1);
    });
}

export { testMessagesSystem };
