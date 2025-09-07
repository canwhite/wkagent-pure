import JSONParser from './src/utils.js';

console.log('=== 测试修复后的JSON提取功能 ===\n');

// 测试用例1: 中文文本内容（之前会报错）
const chineseText = "正在执行子任务：世界观构建与核心概念定义\n\n# 梦境与现实映射系统：世界观构建与规则体系";
console.log('测试1: 中文文本内容');
console.log('输入:', chineseText.substring(0, 50) + '...');
const result1 = JSONParser.extractJSON(chineseText);
console.log('结果:', result1);
console.log('预期: null (应该跳过非JSON内容)\n');

// 测试用例2: 英文非JSON内容
const englishText = "I'll generate a complete story outline for you. Based on the three-act structure...";
console.log('测试2: 英文非JSON内容');
console.log('输入:', englishText.substring(0, 50) + '...');
const result2 = JSONParser.extractJSON(englishText);
console.log('结果:', result2);
console.log('预期: null (应该跳过非JSON内容)\n');

// 测试用例3: 有效的JSON对象
const validJSON = '{"title": "测试项目", "sections": [{"name": "部分1", "content": "内容"}]}';
console.log('测试3: 有效的JSON对象');
console.log('输入:', validJSON);
const result3 = JSONParser.extractJSON(validJSON);
console.log('结果:', result3);
console.log('预期: 解析成功的JSON对象\n');

// 测试用例4: 代码块中的JSON
const jsonInCodeBlock = '```json\n{"status": "success", "data": {"count": 5}}\n```';
console.log('测试4: 代码块中的JSON');
console.log('输入:', jsonInCodeBlock);
const result4 = JSONParser.extractJSON(jsonInCodeBlock);
console.log('结果:', result4);
console.log('预期: 解析成功的JSON对象\n');

// 测试用例5: 混合内容（包含JSON和非JSON）
const mixedContent = `我将为您生成一个完整的故事大纲。基于标准的三幕剧结构：

\`\`\`json
{"story": {"title": "测试故事", "acts": ["第一幕", "第二幕", "第三幕"]}}
\`\`\`

这个大纲包含了完整的故事结构。`;
console.log('测试5: 混合内容');
console.log('输入:', mixedContent.substring(0, 100) + '...');
const result5 = JSONParser.extractJSON(mixedContent);
console.log('结果:', result5);
console.log('预期: 成功提取JSON对象\n');

// 测试用例6: Python代码内容（之前会报错）
const pythonCode = 'python\ndef main():\n    print("Hello World")\n    return {"status": "success"}';
console.log('测试6: Python代码内容');
console.log('输入:', pythonCode);
const result6 = JSONParser.extractJSON(pythonCode);
console.log('结果:', result6);
console.log('预期: null (应该跳过代码内容)\n');

// 测试用例7: 提取JSON数组
const jsonArrayText = '这里有一些数据：\n{"item1": "value1"}\n{"item2": "value2"}\n{"item3": "value3"}';
console.log('测试7: 提取JSON数组');
console.log('输入:', jsonArrayText);
const result7 = JSONParser.extractJSONArray(jsonArrayText);
console.log('结果:', result7);
console.log('预期: 包含3个JSON对象的数组\n');

console.log('=== 测试完成 ===');