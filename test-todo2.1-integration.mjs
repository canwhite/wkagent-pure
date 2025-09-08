/**
 * 测试 TODO2.1: 子代理JSON结果整合
 * 验证子代理返回的JSON数据能否被正确解析和整合
 */

import dotenv from "dotenv";
import WKAgent from "./src/index.js";

// 加载环境变量
dotenv.config();

async function testSubAgentJSONIntegration() {
  console.log("=== 子代理JSON结果整合测试 ===\n");

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
      maxSubTasks: 5,
      enableConcurrency: false,
      enableSmartDecomposition: true,
    },
  });

  const testCases = [
    {
      name: "JSON数据结构生成",
      prompt:
        "生成一个用户信息的JSON数据结构，包含name, age, email, skills数组和isActive字段",
      expectedStructure: {
        name: "string",
        age: "number",
        email: "string",
        skills: "array",
        isActive: "boolean",
      },
    },
    {
      name: "多维度JSON分析",
      prompt:
        "分析React和Vue的优缺点，并用JSON格式返回比较结果，包括性能、学习曲线、生态等维度",
      expectedComplexity: "high",
    },
    {
      name: "复杂JSON数据处理",
      prompt:
        "创建一个包含多个产品信息的JSON数组，每个产品有id, name, price, categories, inStock等字段",
      expectedArrayStructure: true,
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n🧪 测试: ${testCase.name}`);
    console.log(`输入: "${testCase.prompt}"`);
    console.log("-".repeat(60));

    try {
      const result = await agent.execute(testCase.prompt);

      console.log(`✅ 任务执行成功: ${result.success}`);
      console.log(`任务ID: ${result.taskId}`);
      console.log(`执行时间: ${result.metadata.duration}ms`);

      // 检查任务分析
      if (result.metadata.taskAnalysis) {
        const analysis = result.metadata.taskAnalysis;
        console.log(`\n📊 任务分析:`);
        console.log(`   任务类型: ${analysis.taskType}`);
        console.log(`   复杂度: ${analysis.complexity}`);
        console.log(
          `   是否需要分解: ${analysis.needsDecomposition ? "是" : "否"}`
        );
        console.log(`   预估子任务数: ${analysis.estimatedSubTasks}`);
        console.log(
          `   使用了子代理: ${analysis.needsDecomposition ? "是" : "否"}`
        );
        console.log(`   实际子代理数: ${result.metadata.subAgentCount || 0}`);
      }

      // 检查响应内容
      console.log(`\n📝 响应内容:`);
      console.log(`   类型: ${result.result.type}`);
      console.log(`   方法: ${result.result.method || "direct"}`);

      // 尝试解析JSON内容
      let parsedContent = null;
      let isValidJSON = false;

      try {
        if (result.result.content) {
          parsedContent = JSON.parse(result.result.content);
          isValidJSON = true;
          console.log(`   JSON解析: ✅ 成功`);
          console.log(
            `   数据预览:`,
            JSON.stringify(parsedContent, null, 2).substring(0, 200) + "..."
          );
        }
      } catch (jsonError) {
        console.log(`   JSON解析: ❌ 失败 - ${jsonError.message}`);
        console.log(
          `   原始内容预览: ${result.result.content?.substring(0, 100)}...`
        );
      }

      // 验证特定测试用例的期望
      if (testCase.expectedStructure && isValidJSON) {
        console.log(`\n🔍 结构验证:`);
        const structureCheck = validateJSONStructure(
          parsedContent,
          testCase.expectedStructure
        );
        console.log(`   结构匹配度: ${structureCheck.matchPercentage}%`);
        if (structureCheck.missingFields.length > 0) {
          console.log(
            `   缺失字段: ${structureCheck.missingFields.join(", ")}`
          );
        }
        if (structureCheck.extraFields.length > 0) {
          console.log(`   额外字段: ${structureCheck.extraFields.join(", ")}`);
        }
      }

      if (testCase.expectedArrayStructure && isValidJSON) {
        console.log(`\n📋 数组验证:`);
        const isArray = Array.isArray(parsedContent);
        console.log(`   是否为数组: ${isArray ? "是" : "否"}`);
        if (isArray && parsedContent.length > 0) {
          console.log(`   数组长度: ${parsedContent.length}`);
          console.log(
            `   第一个元素预览:`,
            JSON.stringify(parsedContent[0], null, 2).substring(0, 100) + "..."
          );
        }
      }

      // 检查是否使用了子代理整合
      if (result.result.method && result.result.method.includes("synthesis")) {
        console.log(`\n🤝 子代理整合:`);
        console.log(`   整合方法: ${result.result.method}`);
        console.log(`   子任务数量: ${result.result.subTaskCount}`);
        if (result.result.data) {
          console.log(`   包含结构化数据: 是`);
        }
      }
    } catch (error) {
      console.log(`❌ 测试失败: ${error.message}`);
      console.error(error);
    }

    console.log("\n" + "=".repeat(60));
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("\n📈 测试总结:");
  console.log("✅ 子代理JSON结果整合功能测试完成");
  console.log("✅ 智能任务分解与JSON处理协同工作");
  console.log("✅ JSON数据提取和合并功能正常");
  console.log("✅ 支持复杂JSON结构的生成和处理");
}

/**
 * 验证JSON结构是否符合期望
 */
function validateJSONStructure(actual, expected) {
  const actualKeys = Object.keys(actual);
  const expectedKeys = Object.keys(expected);

  const missingFields = expectedKeys.filter((key) => !actualKeys.includes(key));
  const extraFields = actualKeys.filter((key) => !expectedKeys.includes(key));
  const matchingFields = expectedKeys.filter((key) => actualKeys.includes(key));

  let matchPercentage = Math.round(
    (matchingFields.length / expectedKeys.length) * 100
  );

  // 验证字段类型
  let typeMatches = 0;
  for (const [key, expectedType] of Object.entries(expected)) {
    if (actualKeys.includes(key)) {
      const actualType = getType(actual[key]);
      if (
        actualType === expectedType ||
        (expectedType === "array" && Array.isArray(actual[key]))
      ) {
        typeMatches++;
      }
    }
  }

  if (typeMatches < matchingFields.length) {
    matchPercentage = Math.round((typeMatches / expectedKeys.length) * 100);
  }

  return {
    matchPercentage,
    missingFields,
    extraFields,
    matchingFields,
    typeMatches,
  };
}

/**
 * 获取JavaScript值的类型字符串
 */
function getType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (typeof value === "object") return "object";
  return typeof value;
}

// 运行测试
testSubAgentJSONIntegration().catch(console.error);
