DONE1：现在我们实现了一个简单的 agent，只依赖 llm 的能力，没有工具选择，有 sub-agent 和 memory 管理，大概是这样一个结构
让我重新仔细理解你的核心需求：

1. 基于 README.md 的思路，但移除所有 tools 部分
2. 纯 LLM 能力范围内工作 - 只做 LLM 能做的事情（分析、理解、生成文本等）
3. 必须有 sub-agent 机制 - 将大任务切割成小任务执行
4. 必须有 context 管理 - 三层记忆系统（短期、中期、长期）
5. 前端项目 - 可运行.mjs 文件
6. 简单接口 - 传入 prompt，返回 JSON

与 README.md 的区别：

- 保留：子代理、context 管理、事件驱动、任务分解
- 移除：所有 tool 选择、tool 执行、外部命令、文件系统操作

注意 1:我们的代码主要是在 next 中使用，不要用 node 专有的包
注意 2:添加新文件的时候先阅读现有文件，是否已经有同样作用的存在，不要无脑新建，除非有必要

DONE2：依据/Users/zack/Desktop/wkagent-llm/claude.md 中的关于上下文管理的内容，增强当前项目的 messages 的管理，并且让过往 messages 参与决策，压缩的时候必要时候也可以借助 llm，并且注意写好 prompt，真正重要的 context 可存在本地

DONE1.1: 如果请求结果里有 json，是否需要更好的处理，需要参考下 utils.js，尝试融入现有代码
DONE1.2: 在测试里加一条返回 json 的测试，prompt 要求返回 json，并定义好返回数据，然后看结果

<!-- TODO1.3: 如果优化输入操作，让 agent 执行的时候如果有多个变量输入的时候更方便 -->

DONE2：任务是否需要拆分，是否需要调用 sub-agent，可以借助 llm 去判断，这样更智能，让它可以从一段 prompt 中自动去提取并行内容

DONE2.1 按照 agent 中 prompt 的原始需求，整合 sub-agent 中的答案，满足最初的需求

TODO2.2: 如果创建了子代理，JSON 解析结果就会报错，这里再写个测试验证下
[AGENT] 上下文分析完成, 识别 0 个关键点
[AGENT] 创建子代理: subagent_1757147199224_h7g5kyt5n
[AGENT] 创建子代理: subagent_1757147199225_vmj9r56ly
[AGENT] 任务完成: task_1
原始响应: {"name": "string", "age": "number", "email": "string", "skills": ["JavaScript", "Python", "React", "Node.js"], "isActive": "boolean"}
解析后的 JSON: {
name: 'string',
age: 'number',
email: 'string',
skills: [ 'JavaScript', 'Python', 'React', 'Node.js' ],
isActive: 'boolean'
}
JSON 结构验证结果: {
valid: false,
errors: [
'Invalid type for age: expected number, got string',
'Invalid type for isActive: expected boolean, got string'
]
}

DONE3: 现在的项目代码能更好的让我串行执行呢？先分析计划，然后实现,完成后测试
DONE3.2: 将核心代码放进一个包里，同步处理一下其他地方的引入路径
DONE3.3: 现在任务通过我们的项目代码可以串行执行，那么他们不同 sub-agent 间信息共享吗？

具体的信息共享方式包括：

1. 共享上下文信息

- 系统提示共享：所有 sub-agent 都使用相同的系统提示（parentMessages[0]）
- 父任务上下文：通过 contextAnalysis 参数传递上下文分析结果
- 任务分解信息：每个 sub-agent 都能获取到完整的任务分解信息

2. 三层记忆系统共享

// 短期记忆：所有 sub-agent 的结果都会汇总到主 agent 的 shortTerm
// 中期记忆：压缩后的历史摘要对所有任务可见
// 长期记忆：持久化的关键信息可被后续任务使用

3. 结果汇总机制

在 synthesizeResults 方法中：

- 收集所有 sub-agent 的执行结果
- 进行智能汇总和整合
- 提取 JSON 数据并尝试合并
- 最终形成统一的回答

4. 串行执行中的信息传递

在串行执行模式下：

- 前面的 sub-agent 结果会影响后续任务的执行
- 通过事件系统实时传递执行状态
- 支持错误处理和恢复机制

5. 上下文相关性选择

系统会基于上下文分析结果：

- 选择相关的长期记忆信息
- 筛选相关的历史摘要
- 过滤相关的近期消息

总结：虽然每个 sub-agent 独立执行具体子任务，但它们通过共享的上下文分析、记忆系统和结果汇总机制实现
了有效的信息共享，确保最终输出的一致性和完整性。
DONE4:将当前项目的技术核心和使用方式放入 README.md
TODO4.1: 将 import dotenv 和加载环境变量 dotenv.config()，都在 src/llm-client.js 中完成可以吗？

TODO4.2: 告诉我如何在 next 中使用该项目，搞一个专门的 md 文档放
先完成 TODO4.1
