/**
 * 简化版JSON响应测试
 */

import dotenv from "dotenv";
import { WKAgent, JSONParser } from "./src/index.js";

// 加载环境变量
dotenv.config();

async function testSimpleJSON() {
  console.log("=== 简化版JSON响应测试 ===\n");

  const agent = new WKAgent({
    memory: {
      compressThreshold: 10,
      enableLLMCompression: false,
      enablePersistence: false,
    },
    task: {
      maxSubTasks: 1,
      enableConcurrency: false,
      enableSmartDecomposition: false,
    },
  });

  try {
    // 简单JSON测试
    console.log("1. 测试简单JSON对象:");

    const simplePrompt = `请返回一个JSON对象，格式如下：
{"name": "测试用户", "age": 25, "active": true}
只返回JSON，不要其他内容。`;

    const result = await agent.execute(simplePrompt);
    console.log("原始响应:", result.result.content);

    const parsedJSON = JSONParser.extractJSON(result.result.content);
    console.log("解析后的JSON:", parsedJSON);

    if (parsedJSON) {
      console.log("✅ JSON解析成功!");
      console.log("姓名:", parsedJSON.name);
      console.log("年龄:", parsedJSON.age);
      console.log("是否活跃:", parsedJSON.active);
    } else {
      console.log("❌ JSON解析失败");
    }

    console.log("\n=== 测试结果 ===");
    console.log(parsedJSON ? "✅ JSON响应测试通过" : "❌ JSON响应测试失败");
  } catch (error) {
    console.error("测试出错:", error.message);
  }
}

// 运行测试
testSimpleJSON().catch(console.error);
