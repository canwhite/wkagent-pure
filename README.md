## 🌐 Language Options

- **[中文文档](./README.zh-CN.md)** - Chinese Documentation
- **[English](./README.md)** - English Documentation (Current)

---

# WKAgent Pure - Pure LLM-Powered Intelligent Agent System

An intelligent Agent system based purely on LLM capabilities, featuring a three-tier memory management system, sub-agent mechanisms, and intelligent task analysis. Designed specifically for frontend projects with Next.js integration support.

## 🌟 Core Features

### Pure LLM Capability Design

- ✅ **No Tool Dependencies**: Uses only LLM's text understanding and generation capabilities
- ✅ **JSON Output**: Structured responses for easy integration
- ✅ **Intelligent Analysis**: Automatically identifies task complexity and selects appropriate execution strategies

### Three-Tier Memory System

- 🧠 **Short-term Memory**: Recent conversation records with intelligent filtering and relevance calculation
- 📝 **Medium-term Memory**: LLM-driven AU2 algorithm compression with 8-section structured summarization
- 💎 **Long-term Memory**: Persistent storage of key information with cross-session memory support

### Intelligent Task Management

- 🔍 **Context Analysis**: Historical conversations participate in decision-making, providing personalized responses
- 🎯 **Task Decomposition**: Intelligently determines whether sub-agents are needed and automatically estimates optimal sub-task count
- 🚀 **Sub-agent Mechanism**: Concurrent or sequential execution of complex tasks with progress tracking
- 🔄 **Result Integration**: Intelligent aggregation of multiple sub-task results while maintaining JSON format consistency

### Enterprise Features

- ⚡ **High Performance**: Supports concurrent execution with intelligent caching optimization
- 🛡️ **Fault Tolerance**: Multi-layer error handling with automatic fallback strategies
- 📊 **Event-Driven**: Complete lifecycle events with state monitoring support
- 🔧 **Flexible Configuration**: Comprehensive configuration options for different scenarios

## 🚀 Quick Start

### Install Dependencies

```bash
npm install
```

### Environment Configuration

Create `.env` file:

```env
NEXT_PUBLIC_DEEPSEEK_API_KEY=your-api-key-here
NEXT_PUBLIC_LLM_BASE_URL=https://api.deepseek.com
NEXT_PUBLIC_LLM_MODEL=deepseek-chat
NEXT_PUBLIC_LLM_MAX_TOKENS=4000
NEXT_PUBLIC_LLM_TEMPERATURE=0.7
```

### Basic Usage

```javascript
import WKAgent from "./src/index.js";

// Create Agent instance
const agent = new WKAgent({
  llm: {
    apiKey: "your-api-key",
    model: "deepseek-chat",
    maxTokens: 4000,
    temperature: 0.7,
  },
});

// Execute simple task
const result = await agent.execute("What are React Hooks?");
console.log(result);

// Execute complex task (automatic decomposition)
const complexResult = await agent.execute(
  "Comprehensively analyze the differences and similarities between React and Vue"
);
console.log(complexResult);

// Execute with JSON output
const jsonResult = await agent.execute(`
  Analyze user preferences and return in JSON format
  Return format: {"preferences": {"category": "string", "score": number}}
`);
console.log(jsonResult.json); // Access parsed JSON data
```

## 📋 API Reference

### WKAgent Class

#### Constructor

```javascript
const agent = new WKAgent(config);
```

**Configuration Options:**

```javascript
{
  // New configuration options
  isConcurrency: boolean,            // Enable concurrent sub-agent execution
  isHistoryAnalysis: boolean,         // Enable historical conversation analysis
  forceJSON: boolean,                // Force JSON output format
  isDebug: boolean,                  // Enable debug mode for detailed logging
  maxSubTasks: number                // Maximum number of sub-tasks for complex tasks

  // Optional configuration options
  llm: {
    apiKey: string,           // API key
    baseURL: string,          // API base URL
    model: string,            // Model name
    maxTokens: number,        // Maximum token count
    temperature: number       // Temperature parameter
  },
  memory: {
    maxShortTerm: number,     // Maximum short-term memory entries
    compressThreshold: number, // Compression threshold
    tokenThreshold: number,   // Token usage threshold (0.92)
    enableLLMCompression: boolean, // Enable LLM compression
    enablePersistence: boolean,    // Enable persistence
    persistenceKey: string    // Persistence key name
  },
  task: {
    maxSubTasks: number,      // Maximum sub-tasks
    enableConcurrency: boolean, // Enable concurrent execution
    enableSmartDecomposition: boolean, // Enable smart decomposition
    errorHandling: string,    // Error handling strategy
    sequentialDelay: number,  // Sequential delay (ms)
    enableProgressTracking: boolean,  // Enable progress tracking
    enableExecutionControl: boolean   // Enable execution control
  },
  context: {
    enableHistoryAnalysis: boolean,   // Enable history analysis
    enableContextInjection: boolean,  // Enable context injection
    maxContextMessages: number        // Maximum context messages
  },
}
```

#### Main Methods

##### execute(prompt, options)

Main method to execute user requests.

```javascript
const result = await agent.execute("Analyze this task", {
  systemPrompt: "Custom system prompt",
  returnJSON: true,
  context: {},
});
```

**Return Result Structure:**

```javascript
{
  success: boolean,           // Execution success flag
  taskId: string,            // Task ID
  result: {
    type: string,            // Result type (direct/synthesis)
    content: string,         // Result content
    subTaskCount: number,    // Sub-task count
    method: string,          // Execution method
    data: object             // Structured data (optional)
  },
  json: object,              // Parsed JSON data (when forceJSON is enabled)
  metadata: {
    duration: number,        // Execution time (ms)
    usedSubAgents: boolean,  // Whether sub-agents were used
    memoryUsage: object,     // Memory usage
    contextAnalysis: object, // Context analysis
    taskAnalysis: object,    // Task analysis
    subAgentCount: number    // Sub-agent count
  }
}
```

##### Serial Execution Control

```javascript
// Pause serial execution
agent.pauseSerialExecution();

// Resume serial execution
agent.resumeSerialExecution();

// Cancel serial execution
agent.cancelSerialExecution();

// Get execution status
const status = agent.getSerialExecutionStatus();
```

### Event Listening

Agent instances support rich event listeners:

```javascript
agent.on("task:start", (taskId) => {
  console.log(`Task started: ${taskId}`);
});

agent.on("task:complete", (taskId, result) => {
  console.log(`Task completed: ${taskId}`);
});

agent.on("subAgent:create", (agentId) => {
  console.log(`Sub-agent created: ${agentId}`);
});

agent.on("memory:compress", (data) => {
  console.log(`Memory compressed: saved ${data.savedMessages} messages`);
});

agent.on("serial:task:start", (data) => {
  console.log(`Sub-task ${data.taskIndex}/${data.totalTasks} started`);
});

// Serial execution mode events
agent.on("serial:start", (data) => {
  console.log(`Execution mode: ${data.executionMode}`);
  console.log(`Total tasks: ${data.totalTasks}`);
});
```

## 🔧 Advanced Features

### Intelligent Task Analysis

The system automatically analyzes task complexity and determines execution strategies:

```javascript
// Simple task - direct execution
const simple = await agent.execute("What is JavaScript?");

// Complex task - automatic decomposition
const complex = await agent.execute(
  "Comprehensively analyze the frontend framework ecosystem"
);

// JSON output task - maintains format consistency
const jsonTask = await agent.execute("Return user information in JSON format");
```

### Context Awareness

The system analyzes historical conversations to provide personalized responses:

```javascript
// First conversation
await agent.execute("I'm very interested in React");

// Subsequent conversations consider previous context
await agent.execute("Recommend some learning resources"); // Considers user's interest in React
```

### Memory Compression Algorithm

When memory usage reaches the threshold, AU2 algorithm compression is automatically triggered:

- **8-Section Structured Compression**: Background context, key decisions, tool usage records, user intent evolution, execution result summary, errors and solutions, unresolved issues, future plans
- **Intelligent Relevance Calculation**: Based on keyword matching and semantic similarity
- **Configurable Compression Strategy**: Supports LLM-driven compression and basic compression

## 🧪 Test Examples

Usage examples:

```bash
# Novel analysis and generation test
node test-novel.mjs
```

## 📊 Performance Optimization Recommendations

### 1. Memory Management

- Set appropriate `compressThreshold` and `tokenThreshold` values
- Enable `enableLLMCompression` for better compression results
- Regularly clean long-term memory to prevent excessive growth

### 2. Task Execution Optimization

- Adjust `maxSubTasks` limit based on task type
- Enable `enableConcurrency` for independent sub-tasks
- Set appropriate `sequentialDelay` to avoid API rate limits

### 3. Context Optimization

- Enable `enableHistoryAnalysis` to improve personalization
- Adjust `maxContextMessages` to control context length
- Use `contextInjection` to inject key background information

## 🔍 Debugging and Monitoring

### Log Events

The system provides complete event lifecycle:

```javascript
// Task-level events
agent.on("task:start", (taskId) => {});
agent.on("task:complete", (taskId, result) => {});
agent.on("task:error", (taskId, error) => {});

// Sub-agent events
agent.on("subAgent:create", (agentId) => {});

// Memory management events
agent.on("memory:compress", (data) => {});

// Serial execution events
agent.on("serial:start", (data) => {});
agent.on("serial:task:start", (data) => {});
agent.on("serial:complete", (data) => {});
```

### Memory Status Monitoring

```javascript
const memoryUsage = agent.getMemoryUsage();
console.log("Memory usage:", memoryUsage);
// { shortTerm: 10, mediumTerm: 3, longTerm: 15, total: 13 }
```

### Execution Status Monitoring

```javascript
const serialStatus = agent.getSerialExecutionStatus();
console.log("Serial execution status:", serialStatus);
// { isRunning: true, isPaused: false, progress: 60, ... }
```

## 🚨 Important Notes

1. **API Key Security**: Never expose API keys on the client side, always use server-side proxies
2. **Memory Management**: Long-running instances need regular memory compression
3. **Error Handling**: Always handle API call failures and fallback scenarios
4. **Concurrency Control**: Be aware of API provider concurrency limits
5. **Cost Control**: Monitor token usage and set reasonable maxTokens limits

## 🔧 Troubleshooting

### Common Issues

**Q: What to do if API calls fail?**
A: Check API key and network connection, the system will automatically use fallback mode

**Q: How to handle sub-task execution failures?**
A: Configure `errorHandling: "continue_on_error"` to continue executing other sub-tasks

**Q: How to optimize performance for long conversations?**
A: Adjust compression thresholds and enable LLM compression algorithms

**Q: What to do if JSON parsing fails?**
A: Use the `JSONParser.safeParse()` method, which tries multiple repair strategies

**Q: How to enable debug mode?**
A: Set `isDebug: true` in the configuration to enable detailed logging throughout the execution process

**Q: What's the difference between concurrent and serial execution?**
A: Concurrent execution runs sub-agents in parallel for better performance, while serial execution processes them sequentially for better control and debugging

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

## 🤝 Contribution

Issues and Pull Requests are welcome to improve this project.

---

**WKAgent Pure** - Maximizing the value of pure LLM capabilities 🚀
