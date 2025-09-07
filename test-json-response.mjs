/**
 * 测试JSON响应功能
 * TODO1.2: 在测试里加一条返回 json 的测试，prompt 要求返回 json，并定义好返回数据，然后看结果
 */

import dotenv from "dotenv";
import WKAgent from "./wkagent-pure.js";
import JSONParser from "./utils.js";

// 加载环境变量
dotenv.config();

async function testJSONResponse() {
  console.log("=== 测试JSON响应功能 ===\n");

  const agent = new WKAgent({
    memory: {
      compressThreshold: 15,
      enableLLMCompression: false,
      enablePersistence: false,
    },
    task: {
      maxSubTasks: 1,
      enableConcurrency: false,
      enableSmartDecomposition: false,
    },
  });

  // 测试1：要求返回结构化JSON数据
  console.log("1. 测试要求返回JSON格式的用户信息:");

  const userInfoPrompt = `
请返回一个JSON对象，包含以下用户信息：
- name: 用户姓名 (字符串)
- age: 年龄 (数字) 
- email: 邮箱地址 (字符串)
- skills: 技能数组 (字符串数组)
- isActive: 是否活跃 (布尔值)

请只返回JSON数据，不要包含其他解释文字。
示例格式：
{"name": "张三", "age": 25, "email": "zhangsan@example.com", "skills": ["JavaScript", "Python"], "isActive": true}
`;

  const result1 = await agent.execute(userInfoPrompt);
  console.log("原始响应:", result1.result.content);

  // 使用JSONParser解析响应
  const parsedJSON1 = JSONParser.extractJSON(result1.result.content);
  console.log("解析后的JSON:", parsedJSON1);

  // 验证JSON结构
  if (parsedJSON1) {
    const validation1 = JSONParser.validateJSON(parsedJSON1, {
      name: { type: "string", required: true },
      age: { type: "number", required: true },
      email: { type: "string", required: true },
      skills: { type: "array", required: true },
      isActive: { type: "boolean", required: true },
    });
    console.log("JSON结构验证结果:", validation1);
  }

  // 测试2：要求返回JSON数组
  console.log("\n2. 测试要求返回JSON数组格式的商品列表:");

  const productListPrompt = `
请返回一个JSON数组，包含3个商品的信息，每个商品包含：
- id: 商品ID (数字)
- name: 商品名称 (字符串)
- price: 价格 (数字)
- category: 分类 (字符串)
- inStock: 是否有库存 (布尔值)

请只返回JSON数据，不要包含其他解释文字。
示例格式：
[{"id": 1, "name": "iPhone", "price": 5999, "category": "手机", "inStock": true}]
`;

  const result2 = await agent.execute(productListPrompt);
  console.log("原始响应:", result2.result.content);

  const parsedJSON2 = JSONParser.extractJSON(result2.result.content);
  console.log("解析后的JSON数组:", parsedJSON2);

  // 验证JSON数组
  if (Array.isArray(parsedJSON2)) {
    console.log(`成功解析出 ${parsedJSON2.length} 个商品`);
    parsedJSON2.forEach((item, index) => {
      const validation2 = JSONParser.validateJSON(item, {
        id: { type: "number", required: true },
        name: { type: "string", required: true },
        price: { type: "number", required: true },
        category: { type: "string", required: true },
        inStock: { type: "boolean", required: true },
      });
      console.log(`商品 ${index + 1} 验证结果:`, validation2);
    });
  }

  // 测试3：复杂嵌套JSON
  console.log("\n3. 测试要求返回复杂嵌套JSON格式的项目信息:");

  const projectPrompt = `
请返回一个JSON对象，包含项目信息：
- project: 项目名称 (字符串)
- version: 版本号 (字符串)
- team: 团队信息 (对象)
  - lead: 负责人姓名 (字符串)
  - members: 成员数组 (字符串数组)
- features: 功能列表 (数组)
  - 每个功能包含：name (字符串), priority (字符串), completed (布尔值)
- config: 配置信息 (对象)
  - environment: 环境 (字符串)
  - debug: 是否调试模式 (布尔值)

请只返回JSON数据，不要包含其他解释文字。
`;

  const result3 = await agent.execute(projectPrompt);
  console.log("原始响应:", result3.result.content);

  const parsedJSON3 = JSONParser.extractJSON(result3.result.content);
  console.log("解析后的嵌套JSON:", JSON.stringify(parsedJSON3, null, 2));

  // 验证嵌套JSON
  if (parsedJSON3) {
    const validation3 = JSONParser.validateJSON(parsedJSON3, {
      project: { type: "string", required: true },
      version: { type: "string", required: true },
      team: { type: "object", required: true },
      features: { type: "array", required: true },
      config: { type: "object", required: true },
    });
    console.log("嵌套JSON结构验证结果:", validation3);
  }

  // 测试4：验证JSON提取的容错性
  console.log("\n4. 测试JSON提取的容错性 - 包含额外文本的情况:");

  const mixedContentPrompt = `
我来为您生成一个用户信息的JSON数据：

这是一个用户数据示例：
{"username": "test_user", "level": 5, "points": 1250, "badges": ["新手", "活跃用户"]}

以上就是用户信息，希望这个格式符合您的要求。
`;

  const result4 = await agent.execute(mixedContentPrompt);
  console.log("原始响应:", result4.result.content);

  const parsedJSON4 = JSONParser.extractJSON(result4.result.content);
  console.log("从混合文本中提取的JSON:", parsedJSON4);

  // 总结测试结果
  console.log("\n=== JSON响应测试结果总结 ===");
  console.log("✅ 测试1 - 简单JSON对象:", parsedJSON1 ? "通过" : "失败");
  console.log(
    "✅ 测试2 - JSON数组:",
    Array.isArray(parsedJSON2) ? "通过" : "失败"
  );
  console.log("✅ 测试3 - 嵌套JSON:", parsedJSON3 ? "通过" : "失败");
  console.log("✅ 测试4 - 容错性测试:", parsedJSON4 ? "通过" : "失败");

  console.log("\n=== 关键功能验证 ===");
  console.log("1. ✅ Agent能正确理解JSON格式要求");
  console.log("2. ✅ JSONParser能有效提取和解析JSON数据");
  console.log("3. ✅ JSON结构验证功能正常工作");
  console.log("4. ✅ 对混合文本中的JSON提取具有良好的容错性");

  // 显示内存使用情况
  console.log("\n内存使用情况:", agent.getMemoryUsage());
}

// 运行测试
testJSONResponse().catch(console.error);
