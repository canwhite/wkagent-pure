# WKAgent Pure - 纯 LLM 能力的智能 Agent 系统

一个基于纯 LLM 能力的智能 Agent 系统，具备三层记忆管理、子代理机制和智能任务分析能力。专为前端项目设计，支持 Next.js 集成。

## 🌟 核心特性

### 纯 LLM 能力设计

- ✅ **无工具依赖**: 仅使用 LLM 的文本理解和生成能力
- ✅ **JSON 输出**: 结构化响应，易于集成
- ✅ **智能分析**: 自动识别任务复杂度并选择合适的执行策略

### 三层记忆系统

- 🧠 **短期记忆**: 最近对话记录，支持智能过滤和相关性计算
- 📝 **中期记忆**: LLM 驱动的 AU2 算法压缩，8 段式结构化摘要
- 💎 **长期记忆**: 关键信息持久化存储，支持跨会话记忆

### 智能任务管理

- 🔍 **上下文分析**: 历史对话参与决策，提供个性化响应
- 🎯 **任务分解**: 智能判断是否需要子代理，自动估算最优子任务数量
- 🚀 **子代理机制**: 并发或串行执行复杂任务，支持进度跟踪
- 🔄 **结果整合**: 多子任务结果智能汇总，保持 JSON 格式一致性

### 企业级特性

- ⚡ **高性能**: 支持并发执行，智能缓存优化
- 🛡️ **容错机制**: 多层错误处理，自动降级策略
- 📊 **事件驱动**: 完整的生命周期事件，支持状态监控
- 🔧 **配置灵活**: 全面的配置选项，适应不同场景

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 环境配置

创建 `.env` 文件：

```env
NEXT_PUBLIC_DEEPSEEK_API_KEY=your-api-key-here
NEXT_PUBLIC_LLM_BASE_URL=https://api.deepseek.com
NEXT_PUBLIC_LLM_MODEL=deepseek-chat
NEXT_PUBLIC_LLM_MAX_TOKENS=4000
NEXT_PUBLIC_LLM_TEMPERATURE=0.7
```

### 基础使用

```javascript
import WKAgent from "./src/index.js";

// 创建Agent实例
const agent = new WKAgent({
  llm: {
    apiKey: "your-api-key",
    model: "deepseek-chat",
    maxTokens: 4000,
    temperature: 0.7,
  },
});

// 执行简单任务
const result = await agent.execute("什么是React Hooks？");
console.log(result);

// 执行复杂任务（自动分解）
const complexResult = await agent.execute("全面分析React和Vue的异同点");
console.log(complexResult);
```

## 📋 API 参考

### WKAgent 类

#### 构造函数

```javascript
const agent = new WKAgent(config);
```

**配置选项：**

```javascript
{
  llm: {
    apiKey: string,           // API密钥
    baseURL: string,          // API基础URL
    model: string,            // 模型名称
    maxTokens: number,        // 最大token数
    temperature: number       // 温度参数
  },
  memory: {
    maxShortTerm: number,     // 短期记忆最大条数
    compressThreshold: number, // 压缩阈值
    tokenThreshold: number,   // token使用率阈值(0.92)
    enableLLMCompression: boolean, // 启用LLM压缩
    enablePersistence: boolean,    // 启用持久化
    persistenceKey: string    // 持久化键名
  },
  task: {
    maxSubTasks: number,      // 最大子任务数
    enableConcurrency: boolean, // 启用并发执行
    enableSmartDecomposition: boolean, // 启用智能分解
    errorHandling: string,    // 错误处理策略
    sequentialDelay: number,  // 串行延迟(ms)
    enableProgressTracking: boolean,  // 启用进度跟踪
    enableExecutionControl: boolean   // 启用执行控制
  },
  context: {
    enableHistoryAnalysis: boolean,   // 启用历史分析
    enableContextInjection: boolean,  // 启用上下文注入
    maxContextMessages: number        // 最大上下文消息数
  }
}
```

#### 主要方法

##### execute(prompt, options)

执行用户请求的主方法。

```javascript
const result = await agent.execute("分析这个任务", {
  systemPrompt: "自定义系统提示",
  returnJSON: true,
  context: {},
});
```

**返回结果结构：**

```javascript
{
  success: boolean,           // 执行成功标志
  taskId: string,            // 任务ID
  result: {
    type: string,            // 结果类型(direct/synthesis)
    content: string,         // 结果内容
    subTaskCount: number,    // 子任务数量
    method: string,          // 执行方法
    data: object             // 结构化数据(可选)
  },
  metadata: {
    duration: number,        // 执行时间(ms)
    usedSubAgents: boolean,  // 是否使用子代理
    memoryUsage: object,     // 内存使用情况
    contextAnalysis: object, // 上下文分析
    taskAnalysis: object,    // 任务分析
    subAgentCount: number    // 子代理数量
  }
}
```

##### 串行执行控制

```javascript
// 暂停串行执行
agent.pauseSerialExecution();

// 恢复串行执行
agent.resumeSerialExecution();

// 取消串行执行
agent.cancelSerialExecution();

// 获取执行状态
const status = agent.getSerialExecutionStatus();
```

### 事件监听

Agent 实例支持丰富的事件监听：

```javascript
agent.on("task:start", (taskId) => {
  console.log(`任务开始: ${taskId}`);
});

agent.on("task:complete", (taskId, result) => {
  console.log(`任务完成: ${taskId}`);
});

agent.on("subAgent:create", (agentId) => {
  console.log(`创建子代理: ${agentId}`);
});

agent.on("memory:compress", (data) => {
  console.log(`记忆压缩: 节省${data.savedMessages}条消息`);
});

agent.on("serial:task:start", (data) => {
  console.log(`子任务 ${data.taskIndex}/${data.totalTasks} 开始`);
});
```

## 🔧 高级功能

### 智能任务分析

系统自动分析任务复杂度并决定执行策略：

```javascript
// 简单任务 - 直接执行
const simple = await agent.execute("什么是JavaScript？");

// 复杂任务 - 自动分解
const complex = await agent.execute("全面分析前端框架生态系统");

// JSON输出任务 - 保持格式一致性
const jsonTask = await agent.execute("返回用户信息的JSON格式");
```

### 上下文感知

系统会分析历史对话，提供个性化响应：

```javascript
// 第一次对话
await agent.execute("我对React很感兴趣");

// 后续对话会考虑之前的上下文
await agent.execute("推荐一些学习资源"); // 会考虑用户对React的兴趣
```

### 记忆压缩算法

当记忆使用量达到阈值时，自动触发 AU2 算法压缩：

- **8 段式结构化压缩**：背景上下文、关键决策、工具使用记录、用户意图演进、执行结果汇总、错误与解决、未解决问题、后续计划
- **智能相关性计算**：基于关键词匹配和语义相似度
- **可配置压缩策略**：支持 LLM 驱动压缩和基础压缩

## 🧪 测试示例

项目包含多个测试文件，展示不同功能：

```bash
# 基础功能测试
node test-json-simple.mjs

# 上下文管理测试
node test-context.mjs

# 串行执行测试
node test-serial-execution.mjs

# 综合测试
node test-serial-comprehensive.mjs
```

## 📊 性能优化建议

### 1. 内存管理

- 合理设置 `compressThreshold` 和 `tokenThreshold`
- 启用 `enableLLMCompression` 获得更好的压缩效果
- 定期清理长期记忆避免过度增长

### 2. 任务执行优化

- 根据任务类型调整 `maxSubTasks` 限制
- 对于独立子任务启用 `enableConcurrency`
- 设置合适的 `sequentialDelay` 避免 API 限流

### 3. 上下文优化

- 启用 `enableHistoryAnalysis` 提升个性化
- 调整 `maxContextMessages` 控制上下文长度
- 使用 `contextInjection` 注入关键背景信息

## 🔍 调试和监控

### 日志事件

系统提供完整的事件生命周期：

```javascript
// 任务级别事件
agent.on("task:start", (taskId) => {});
agent.on("task:complete", (taskId, result) => {});
agent.on("task:error", (taskId, error) => {});

// 子代理事件
agent.on("subAgent:create", (agentId) => {});

// 内存管理事件
agent.on("memory:compress", (data) => {});

// 串行执行事件
agent.on("serial:start", (data) => {});
agent.on("serial:task:start", (data) => {});
agent.on("serial:complete", (data) => {});
```

### 内存状态监控

```javascript
const memoryUsage = agent.getMemoryUsage();
console.log("内存使用:", memoryUsage);
// { shortTerm: 10, mediumTerm: 3, longTerm: 15, total: 13 }
```

### 执行状态监控

```javascript
const serialStatus = agent.getSerialExecutionStatus();
console.log("串行执行状态:", serialStatus);
// { isRunning: true, isPaused: false, progress: 60, ... }
```

## 🚨 注意事项

1. **API 密钥安全**: 不要在客户端暴露 API 密钥，始终通过服务器端代理
2. **内存管理**: 长时间运行的实例需要定期压缩记忆
3. **错误处理**: 始终处理 API 调用失败和回退情况
4. **并发控制**: 注意 API 提供商的并发限制
5. **成本控制**: 监控 token 使用量，合理设置 maxTokens 限制

## 🔧 故障排除

### 常见问题

**Q: API 调用失败怎么办？**
A: 检查 API 密钥和网络连接，系统会自动使用回退模式

**Q: 子任务执行失败如何处理？**
A: 配置 `errorHandling: "continue_on_error"` 继续执行其他子任务

**Q: 如何优化长对话的性能？**
A: 调整压缩阈值和启用 LLM 压缩算法

**Q: JSON 解析失败怎么办？**
A: 使用 `JSONParser.safeParse()` 方法，它会尝试多种修复策略

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目。

---

**WKAgent Pure** - 让纯 LLM 能力发挥最大价值 🚀
