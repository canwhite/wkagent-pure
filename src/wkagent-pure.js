/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-undef */
/**
 * 极简LLM Agent - 保留三层记忆，移除context栈
 * 核心：messages[] + system prompt → LLM → 结果整合
 */

import { EventEmitter } from "events";
import LLMClient from "./llm-client.js";
import JSONParser from "./utils.js";

class WKAgent extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      llm: {
        apiKey: config.llm?.apiKey || process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY,
        baseURL:
          config.llm?.baseURL ||
          process.env.NEXT_PUBLIC_LLM_BASE_URL ||
          "https://api.deepseek.com",
        model:
          config.llm?.model ||
          process.env.NEXT_PUBLIC_LLM_MODEL ||
          "deepseek-chat",
        maxTokens:
          config.llm?.maxTokens ||
          parseInt(process.env.NEXT_PUBLIC_LLM_MAX_TOKENS) ||
          4000,
        temperature:
          config.llm?.temperature ||
          parseFloat(process.env.NEXT_PUBLIC_LLM_TEMPERATURE) ||
          0.7,
      },
      memory: {
        maxShortTerm:
          config.memory?.maxShortTerm ||
          parseInt(process.env.NEXT_PUBLIC_AGENT_MAX_SHORT_TERM) ||
          20,
        compressThreshold:
          config.memory?.compressThreshold ||
          parseInt(process.env.NEXT_PUBLIC_AGENT_COMPRESS_THRESHOLD) ||
          15,
        maxMediumTerm: config.memory?.maxMediumTerm || 30,
        tokenThreshold: 0.92, // 92% token使用率触发压缩
        enableLLMCompression: config.memory?.enableLLMCompression !== false, // 默认启用
        enablePersistence: config.memory?.enablePersistence !== false, // 默认启用
        persistenceKey:
          config.memory?.persistenceKey || "wkagent-longterm-memory",
      },
      task: {
        maxSubTasks:
          config.task?.maxSubTasks ||
          parseInt(process.env.NEXT_PUBLIC_AGENT_MAX_SUB_TASKS) ||
          5,
        enableConcurrency: config.task?.enableConcurrency !== false,
        enableSmartDecomposition: true, // 启用智能任务分解
        errorHandling: config.task?.errorHandling || "stop_on_error", // 错误处理策略: stop_on_error, continue_on_error
        sequentialDelay: config.task?.sequentialDelay || 0, // 串行执行时任务间延迟(毫秒)
        enableProgressTracking: true, // 启用进度跟踪
        enableExecutionControl: true, // 启用执行控制(暂停/恢复/取消)
      },
      context: {
        enableHistoryAnalysis: config.context?.enableHistoryAnalysis !== false, // 默认启用
        enableContextInjection:
          config.context?.enableContextInjection !== false, // 默认启用
        maxContextMessages: config.context?.maxContextMessages || 50, // 最大上下文消息数
      },
    };

    // 三层记忆系统 - 基于Claude.md模式增强
    this.shortTerm = []; // 短期记忆: 原始消息流 [{role, content, timestamp, metadata}]
    this.mediumTerm = []; // 中期记忆: LLM压缩的结构化摘要
    this.longTerm = new Map(); // 长期记忆: 持久化关键信息和用户偏好

    // 记忆统计和监控
    this.memoryStats = {
      totalMessages: 0,
      compressionsCount: 0,
      lastCompressionTime: 0,
      tokenUsage: 0,
    };

    // 子代理管理
    this.subAgents = new Map();
    this.taskCounter = 0;

    // 串行执行控制
    this.serialExecution = null;

    // LLM客户端初始化
    this.llmClient = new LLMClient(this.config.llm);

    // 初始化本地存储
    this.initializePersistence();

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.on("task:start", (taskId) => {
      console.log(`[AGENT] 任务开始: ${taskId}`);
    });

    this.on("task:complete", (taskId, result) => {
      console.log(`[AGENT] 任务完成: ${taskId},result:${result}`);
    });

    this.on("memory:compress", (data) => {
      console.log(
        `[AGENT] 记忆压缩: 节省${data.savedMessages}条消息, 压缩率${data.compressionRatio}%`
      );
    });

    this.on("subAgent:create", (agentId) => {
      console.log(`[AGENT] 创建子代理: ${agentId}`);
    });

    this.on("context:analyze", (data) => {
      console.log(`[AGENT] 上下文分析完成, 识别${data.keyPoints}个关键点`);
    });

    // 串行执行事件处理
    this.on("serial:start", (data) => {
      console.log(
        `[AGENT] 串行执行开始: ${data.totalTasks}个子任务, 模式: ${data.executionMode}`
      );
    });

    this.on("serial:task:start", (data) => {
      console.log(
        `[AGENT] 子任务 ${data.taskIndex}/${data.totalTasks} 开始: ${data.description}`
      );
    });

    this.on("serial:task:complete", (data) => {
      console.log(`[AGENT] 子任务 ${data.taskIndex} 完成`);
    });

    this.on("serial:task:failed", (data) => {
      console.log(`[AGENT] 子任务 ${data.taskIndex} 失败: ${data.error}`);
    });

    this.on("serial:complete", (data) => {
      console.log(
        `[AGENT] 串行执行完成: ${data.completedTasks}/${data.totalTasks} 成功, 耗时: ${data.executionTime}ms`
      );
    });
  }

  /**
   * 初始化本地持久化存储
   */
  initializePersistence() {
    if (!this.config.memory.enablePersistence) return;

    try {
      // 浏览器环境使用localStorage, Node.js环境使用模拟存储
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem(this.config.memory.persistenceKey);
        if (stored) {
          const data = JSON.parse(stored);
          this.longTerm = new Map(data.longTerm || []);
          this.memoryStats = { ...this.memoryStats, ...data.memoryStats };
        }
      } else {
        // Node.js环境 - 使用内存模拟（实际项目中可使用文件存储）
        // TODO，node env
        console.log("[AGENT] 运行在Node.js环境，使用内存模拟持久化");
      }
    } catch (error) {
      console.warn("[AGENT] 持久化初始化失败:", error.message);
    }
  }

  /**
   * 保存长期记忆到本地存储
   */
  saveToPersistence() {
    if (!this.config.memory.enablePersistence) return;

    try {
      const data = {
        longTerm: Array.from(this.longTerm.entries()),
        memoryStats: this.memoryStats,
        timestamp: Date.now(),
      };

      if (typeof localStorage !== "undefined") {
        localStorage.setItem(
          this.config.memory.persistenceKey,
          JSON.stringify(data)
        );
      }
    } catch (error) {
      console.warn("[AGENT] 持久化保存失败:", error.message);
    }
  }

  /**
   * 串行执行控制方法
   */
  pauseSerialExecution() {
    if (this.serialExecution) {
      this.serialExecution.isPaused = true;
      this.emit("serial:paused");
      console.log("[AGENT] 串行执行已暂停");
    }
  }

  resumeSerialExecution() {
    if (this.serialExecution) {
      this.serialExecution.isPaused = false;
      this.emit("serial:resumed");
      console.log("[AGENT] 串行执行已恢复");
    }
  }

  cancelSerialExecution() {
    if (this.serialExecution) {
      this.serialExecution.isCancelled = true;
      this.emit("serial:cancelled");
      console.log("[AGENT] 串行执行已取消");
    }
  }

  getSerialExecutionStatus() {
    if (!this.serialExecution) {
      return { isRunning: false };
    }

    return {
      isRunning: true,
      isPaused: this.serialExecution.isPaused,
      isCancelled: this.serialExecution.isCancelled,
      currentTaskIndex: this.serialExecution.currentTaskIndex,
      totalTasks: this.serialExecution.totalTasks,
      completedTasks: this.serialExecution.completedTasks,
      failedTasks: this.serialExecution.failedTasks,
      progress:
        this.serialExecution.totalTasks > 0
          ? (this.serialExecution.completedTasks /
              this.serialExecution.totalTasks) *
            100
          : 0,
    };
  }

  /**
   * 主入口：执行prompt
   */
  async execute(prompt, options = {}) {
    const taskId = `task_${++this.taskCounter}`;
    const startTime = Date.now();

    try {
      this.emit("task:start", taskId);

      // 1. 上下文分析和历史参与决策
      const contextAnalysis = await this.analyzeContext(prompt, options);

      // 2. 构建增强的消息历史（包含上下文分析结果）
      const messages = this.buildEnhancedMessageHistory(
        prompt,
        options,
        contextAnalysis
      );

      // 3. 智能任务分析（结合上下文）
      const taskAnalysis = await this.analyzeTaskWithContext(
        messages,
        contextAnalysis
      );

      // 4. 执行策略选择
      let result;
      if (taskAnalysis.needsDecomposition) {
        result = await this.executeWithSubAgents(
          taskAnalysis,
          messages,
          contextAnalysis
        );
      } else {
        result = await this.executeDirectly(
          messages,
          taskAnalysis,
          contextAnalysis
        );
      }

      // 5. 记录到记忆系统
      await this.recordExecution(taskId, prompt, result, contextAnalysis);

      this.emit("task:complete", taskId, result);

      return {
        success: true,
        taskId,
        result,
        metadata: {
          duration: Date.now() - startTime,
          usedSubAgents: taskAnalysis.needsDecomposition,
          memoryUsage: this.getMemoryUsage(),
          contextAnalysis: contextAnalysis.summary,
          taskAnalysis: {
            taskType: taskAnalysis.taskType,
            complexity: taskAnalysis.complexity,
            needsDecomposition: taskAnalysis.needsDecomposition,
            estimatedSubTasks: taskAnalysis.estimatedSubTasks,
            recommendedStrategy: taskAnalysis.recommendedStrategy,
            confidence: taskAnalysis.confidence,
            reason: taskAnalysis.reason,
            contextRelevance: taskAnalysis.contextRelevance,
          },
          subAgentCount: taskAnalysis.needsDecomposition
            ? taskAnalysis.estimatedSubTasks
            : 0,
        },
      };
    } catch (error) {
      this.emit("task:error", taskId, error);
      return {
        success: false,
        taskId,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * 上下文分析 - 让历史消息参与决策
   */
  async analyzeContext(prompt, options = {}) {
    if (!this.config.context.enableHistoryAnalysis) {
      return {
        summary: "上下文分析已禁用",
        keyPoints: [],
        recommendations: [],
      };
    }

    // 分析历史对话模式
    const recentHistory = this.shortTerm.slice(-10);
    const topicFrequency = this.analyzeTopicFrequency(recentHistory);
    const userIntent = this.extractUserIntent(recentHistory);

    // 构建上下文分析提示
    const analysisMessages = [
      {
        role: "system",
        content: `你是一个上下文分析专家。请基于对话历史分析当前用户的意图和需求。

分析维度：
1. 用户的核心关注点是什么？
2. 之前讨论过哪些相关主题？
3. 用户的知识水平如何？
4. 当前请求与历史对话的关联性？
5. 需要提供什么类型的回答？（详细/简洁/技术/概念）`,
      },
      {
        role: "user",
        content: `历史对话摘要：${JSON.stringify(
          this.generateQuickSummary(),
          null,
          2
        )}
当前请求：${prompt}

请提供上下文分析结果，JSON格式。`,
      },
    ];

    try {
      const response = await this.callLLM(analysisMessages, {
        temperature: 0.3,
      });
      const parseResult = JSONParser.safeParse(response, { fallback: {} });

      if (!parseResult.success) {
        throw new Error(`JSON解析失败: ${parseResult.error}`);
      }

      const analysis = parseResult.data;

      this.emit("context:analyze", {
        keyPoints: analysis.keyPoints?.length || 0,
        userIntent: analysis.userIntent,
        recommendedStyle: analysis.recommendedStyle,
      });

      return analysis;
    } catch (error) {
      console.warn("[AGENT] 上下文分析失败，使用基础分析:", error.message);
      return this.basicContextAnalysis(prompt, recentHistory);
    }
  }

  /**
   * 基础上下文分析（降级方案）
   */
  basicContextAnalysis(prompt, history) {
    const keywords = [
      "分析",
      "解释",
      "比较",
      "总结",
      "建议",
      "如何",
      "什么",
      "为什么",
    ];
    const promptType = keywords.find((kw) => prompt.includes(kw)) || "general";

    const topics = history.map((h) => h.content).join(" ");
    const relevantHistory = history.filter(
      (h) => this.calculateRelevance(h.content, prompt) > 0.3
    );

    return {
      summary: `基础分析: 请求类型=${promptType}, 相关历史=${relevantHistory.length}条`,
      keyPoints: relevantHistory
        .slice(-3)
        .map((h) => h.content.substring(0, 50)),
      recommendations: [`基于${promptType}类型提供响应`, "参考历史对话模式"],
      userIntent: promptType,
      confidence: 0.6,
    };
  }

  /**
   * 构建增强的消息历史（包含上下文分析）
   */
  buildEnhancedMessageHistory(currentPrompt, options, contextAnalysis) {
    const messages = [];

    // 系统提示 - 增强版
    messages.push({
      role: "system",
      content: this.buildEnhancedSystemPrompt(options, contextAnalysis),
    });

    // 长期记忆（关键信息）- 基于上下文分析筛选
    if (this.longTerm.size > 0 && contextAnalysis.keyPoints?.length > 0) {
      const relevantLongTerm = this.selectRelevantLongTerm(
        contextAnalysis.keyPoints
      );
      if (relevantLongTerm.length > 0) {
        messages.push({
          role: "system",
          content: `关键背景信息:\n${relevantLongTerm.join("\n")}`,
        });
      }
    }

    // 中期记忆（历史摘要）- 智能选择相关摘要
    if (this.mediumTerm.length > 0) {
      const relevantSummaries = this.selectRelevantSummaries(contextAnalysis);
      if (relevantSummaries.length > 0) {
        messages.push({
          role: "system",
          content: `相关历史摘要:\n${relevantSummaries.join("\n")}`,
        });
      }
    }

    // 短期记忆（最近对话）- 基于相关性过滤
    const relevantRecentMessages = this.selectRelevantRecentMessages(
      currentPrompt,
      contextAnalysis
    );
    messages.push(...relevantRecentMessages);

    // 上下文分析结果注入
    if (contextAnalysis.recommendations?.length > 0) {
      messages.push({
        role: "system",
        content: `上下文建议: ${contextAnalysis.recommendations.join(", ")}`,
      });
    }

    // 当前用户输入
    messages.push({
      role: "user",
      content: currentPrompt,
    });

    return messages;
  }

  /**
   * 智能任务分析（结合上下文）增强版
   * 更智能地判断是否需要拆分任务和调用sub-agent
   */
  async analyzeTaskWithContext(messages, contextAnalysis) {
    const currentPrompt = messages[messages.length - 1].content;

    // 预分析：快速判断是否需要复杂分析
    const quickAnalysis = this.quickTaskPreAnalysis(
      currentPrompt,
      contextAnalysis
    );

    // 如果预分析确定为简单任务，直接返回结果
    if (quickAnalysis.confidence > 0.8) {
      console.log("[AGENT] 使用快速任务分析结果:", quickAnalysis.reason);
      return quickAnalysis;
    }

    // 复杂任务进行深度分析
    const analysisMessages = [
      ...messages.slice(0, -1), // 排除当前用户消息
      {
        role: "system",
        content: `你是一个高级任务分析专家。请基于深度理解分析当前任务，并智能判断是否需要分解。

上下文信息：
${JSON.stringify(contextAnalysis, null, 2)}

深度分析框架：
1. 任务本质理解（不仅仅是表面关键词）
2. 认知负荷评估（人类处理此任务的思维复杂度）
3. 多维度复杂度分析：
   - 知识广度：需要多少不同领域的知识
   - 逻辑深度：需要多少层推理
   - 结构化程度：是否需要系统化处理
   - 时间跨度：是否需要考虑时间因素
4. 子任务协同必要性评估
5. 质量vs效率权衡

决策标准：
- 简单问答：直接回答（1个子任务）
- 单一分析：直接处理（1个子任务）
- 多维度分析：分解为2-3个子任务
- 复杂系统分析：分解为3-5个子任务
- 全面研究：分解为5+个子任务

请返回结构化JSON，包含详细的分析理由。`,
      },
      {
        role: "user",
        content: `请深度分析这个任务："${currentPrompt}"

要求：
1. 识别任务的真实复杂度（不只是表面长度）
2. 判断是否真正需要子任务协同
3. 预估最优的子任务数量
4. 提供详细的分析理由

返回JSON格式：{
  "taskType": "任务类型",
  "complexity": "low/medium/high/complex",
  "needsDecomposition": boolean,
  "estimatedSubTasks": number,
  "reason": "详细分析理由",
  "recommendedStrategy": "direct/decompose/research",
  "confidence": 0.95
}`,
      },
    ];

    try {
      const response = await this.callLLM(analysisMessages, {
        temperature: 0.2,
      });
      const parseResult = JSONParser.safeParse(response, { fallback: {} });

      if (!parseResult.success) {
        throw new Error(`JSON解析失败: ${parseResult.error}`);
      }

      const analysis = parseResult.data;

      // 增强分析结果的可信度检查
      const enhancedAnalysis = this.enhanceTaskAnalysis(
        analysis,
        currentPrompt,
        contextAnalysis
      );

      console.log("[AGENT] 深度任务分析结果:", {
        complexity: enhancedAnalysis.complexity,
        needsDecomposition: enhancedAnalysis.needsDecomposition,
        estimatedSubTasks: enhancedAnalysis.estimatedSubTasks,
        reason: enhancedAnalysis.reason,
        confidence: enhancedAnalysis.confidence,
      });

      return enhancedAnalysis;
    } catch (error) {
      console.warn("[AGENT] 智能任务分析失败，使用基础分析:", error.message);
      return this.basicTaskAnalysis(currentPrompt, contextAnalysis);
    }
  }

  /**
   * 快速任务预分析
   * 用于快速识别明显不需要分解的简单任务
   */
  quickTaskPreAnalysis(prompt, contextAnalysis) {
    const simplePatterns = [
      {
        pattern: /^什么是\s+\S+\??$/i,
        type: "definition",
        complexity: "low",
        confidence: 0.95,
      },
      {
        pattern: /^\S+\s+是什么\??$/i,
        type: "definition",
        complexity: "low",
        confidence: 0.95,
      },
      {
        pattern: /^如何\s+\S+\??$/i,
        type: "howto",
        complexity: "low",
        confidence: 0.9,
      },
      {
        pattern: /^\S+\s+怎么做\??$/i,
        type: "howto",
        complexity: "low",
        confidence: 0.9,
      },
      {
        pattern: /^解释\s+\S+\??$/i,
        type: "explanation",
        complexity: "low",
        confidence: 0.9,
      },
      {
        pattern: /^翻译[:：]/i,
        type: "translation",
        complexity: "low",
        confidence: 0.95,
      },
      {
        pattern: /^计算[:：]/i,
        type: "calculation",
        complexity: "low",
        confidence: 0.95,
      },
      {
        pattern: /^\d+\s*[*+\-/]\s*\d+\s*=\s*\?*$/i,
        type: "calculation",
        complexity: "low",
        confidence: 0.98,
      },
    ];

    const complexPatterns = [
      {
        pattern: /分析.*和.*的不同/i,
        type: "comparison",
        complexity: "medium",
        confidence: 0.8,
      },
      {
        pattern: /比较.*和.*的/i,
        type: "comparison",
        complexity: "medium",
        confidence: 0.8,
      },
      {
        pattern: /全面分析/i,
        type: "comprehensive_analysis",
        complexity: "high",
        confidence: 0.85,
      },
      {
        pattern: /详细研究/i,
        type: "detailed_research",
        complexity: "high",
        confidence: 0.85,
      },
      {
        pattern: /系统性地/i,
        type: "systematic_analysis",
        complexity: "high",
        confidence: 0.85,
      },
      {
        pattern: /多个方面/i,
        type: "multi_aspect",
        complexity: "medium",
        confidence: 0.8,
      },
      {
        pattern: /从.*角度.*分析/i,
        type: "multi_perspective",
        complexity: "medium",
        confidence: 0.8,
      },
    ];

    // 检查简单模式
    for (const { pattern, type, complexity, confidence } of simplePatterns) {
      if (pattern.test(prompt.trim())) {
        return {
          taskType: type,
          complexity: complexity,
          needsDecomposition: false,
          estimatedSubTasks: 1,
          originalPrompt: prompt,
          recommendedStrategy: "direct",
          contextRelevance: contextAnalysis.confidence || 0.5,
          confidence: confidence,
          reason: `快速识别为简单${type}任务，无需分解`,
        };
      }
    }

    // 检查复杂模式
    for (const { pattern, type, complexity, confidence } of complexPatterns) {
      if (pattern.test(prompt)) {
        const subTaskCount = complexity === "high" ? 3 : 2;
        return {
          taskType: type,
          complexity: complexity,
          needsDecomposition: true,
          estimatedSubTasks: subTaskCount,
          originalPrompt: prompt,
          recommendedStrategy: "decompose",
          contextRelevance: contextAnalysis.confidence || 0.5,
          confidence: confidence,
          reason: `快速识别为${complexity}复杂度${type}任务，建议分解为${subTaskCount}个子任务`,
        };
      }
    }

    // 默认返回不确定结果，需要深度分析
    return {
      taskType: "unknown",
      complexity: "unknown",
      needsDecomposition: false,
      estimatedSubTasks: 1,
      originalPrompt: prompt,
      recommendedStrategy: "direct",
      contextRelevance: contextAnalysis.confidence || 0.5,
      confidence: 0.3,
      reason: "无法快速识别任务类型，需要深度分析",
    };
  }

  /**
   * 提取关键词
   */
  extractKeywords(text) {
    const stopWords = [
      "的",
      "了",
      "是",
      "在",
      "我",
      "有",
      "和",
      "就",
      "不",
      "人",
      "都",
      "一",
      "一个",
      "上",
      "也",
      "很",
      "到",
      "说",
      "要",
      "去",
      "你",
      "会",
      "着",
      "没有",
      "看",
      "好",
      "自己",
      "这",
    ];
    const words = text
      .replace(/[^\u4e00-\u9fa5a-zA-Z]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1);
    const keywords = words.filter(
      (word) => !stopWords.includes(word) && word.length > 1
    );
    return [...new Set(keywords)].slice(0, 10);
  }

  /**
   * 计算复杂度指标
   */
  calculateComplexityIndicators(prompt) {
    const indicators = [];

    if (prompt.length > 200) indicators.push("长文本");
    if (prompt.split("。").length > 3) indicators.push("多句子");
    if (prompt.includes("和") || prompt.includes("以及"))
      indicators.push("并列结构");
    if (/\d+/.test(prompt)) indicators.push("包含数字");
    if (prompt.includes("？")) indicators.push("疑问句");
    if (prompt.includes("分析") || prompt.includes("研究"))
      indicators.push("分析性");
    if (prompt.includes("比较") || prompt.includes("对比"))
      indicators.push("比较性");

    return indicators.length > 0 ? indicators.join(", ") : "基础文本";
  }

  /**
   * 智能分解决策
   */
  smartDecompositionDecision(prompt, analysis) {
    const { complexity, taskType } = analysis;

    // 明确需要分解的情况
    if (complexity === "high") return true;
    if (taskType === "comparison") return true;
    if (taskType === "research") return true;
    if (taskType === "multi_step") return true;

    // 基于特征判断
    if (
      prompt.includes("多个") ||
      prompt.includes("全面") ||
      prompt.includes("系统")
    )
      return true;
    if (prompt.split("。").filter((s) => s.trim().length > 5).length > 3)
      return true;
    if (prompt.length > 300) return true;

    // 基于关键词判断
    const decompositionKeywords = [
      "分别",
      "依次",
      "逐步",
      "分步骤",
      "分阶段",
      "多角度",
      "多方面",
    ];
    if (decompositionKeywords.some((kw) => prompt.includes(kw))) return true;

    return false;
  }

  /**
   * 智能估算子任务数量
   */
  smartEstimateSubTasks(prompt, analysis) {
    const { complexity, taskType } = analysis;

    if (complexity === "low") return 1;

    let count = 1;

    // 基于任务类型
    if (taskType === "comparison") count = 2;
    if (taskType === "research") count = 3;
    if (taskType === "multi_step")
      count = Math.max(
        2,
        prompt.split("。").filter((s) => s.trim().length > 5).length
      );

    // 基于关键词
    if (prompt.includes("多个")) count = Math.max(count, 3);
    if (prompt.includes("全面") || prompt.includes("系统"))
      count = Math.max(count, 4);

    // 基于句子数量
    const sentenceCount = prompt
      .split("。")
      .filter((s) => s.trim().length > 5).length;
    if (sentenceCount > 3) count = Math.max(count, Math.min(5, sentenceCount));

    // 基于长度
    if (prompt.length > 400) count = Math.max(count, 4);
    if (prompt.length > 600) count = Math.max(count, 5);

    return Math.min(8, Math.max(1, count)); // 限制在1-8之间
  }

  /**
   * 任务类型分类
   */
  classifyTaskType(prompt) {
    const typePatterns = {
      definition: ["什么是", "定义", "概念", "意思", "含义"],
      howto: ["如何", "怎么", "怎么做", "方法", "步骤"],
      comparison: ["比较", "对比", "vs", "versus", "哪个更好", "区别", "不同"],
      analysis: ["分析", "研究", "探讨", "评估", "诊断"],
      generation: ["生成", "创建", "制作", "编写", "开发", "设计"],
      summary: ["总结", "概括", "归纳", "提炼"],
      extraction: ["提取", "找出", "识别", "获取", "收集"],
      planning: ["计划", "规划", "方案", "策略"],
      research: ["调研", "调查", "探索", "发现"],
      question: ["?", "？", "吗", "呢", "吧"],
    };

    for (const [type, keywords] of Object.entries(typePatterns)) {
      if (keywords.some((kw) => prompt.includes(kw))) {
        return type;
      }
    }

    return "general";
  }

  /**
   * 复杂度评估
   */
  assessComplexity(prompt) {
    if (prompt.length < 20) return "low";
    if (prompt.length > 300) return "high";

    const complexKeywords = [
      "详细",
      "全面",
      "系统",
      "深入",
      "综合",
      "多角度",
      "多方面",
      "复杂",
      "高级",
    ];
    const simpleKeywords = ["简单", "基础", "概述", "简介", "什么是"];

    const complexMatches = complexKeywords.filter((kw) =>
      prompt.includes(kw)
    ).length;
    const simpleMatches = simpleKeywords.filter((kw) =>
      prompt.includes(kw)
    ).length;

    if (complexMatches > simpleMatches) return "high";
    if (simpleMatches > complexMatches) return "low";

    return "medium";
  }

  /**
   * 推荐策略
   */
  recommendStrategy(analysis) {
    const { complexity, needsDecomposition } = analysis;

    if (complexity === "low") return "direct";
    if (complexity === "high" || needsDecomposition) return "decompose";

    return "direct";
  }

  /**
   * 基础风险评估
   */
  assessBasicRisks(prompt, analysis) {
    const risks = [];

    if (prompt.length > 500) risks.push("长文本处理可能导致信息丢失");
    if (prompt.includes("敏感") || prompt.includes("隐私"))
      risks.push("可能涉及敏感内容");
    if (analysis.complexity === "high") risks.push("高复杂度可能导致理解偏差");
    if (prompt.split("。").length > 5) risks.push("多句子结构可能导致逻辑混乱");

    return risks.length > 0 ? risks : ["低风险任务"];
  }
  enhanceTaskAnalysis(analysis, prompt, contextAnalysis) {
    // 基础验证和默认值填充
    const enhanced = {
      taskType: analysis.taskType || "general",
      complexity: analysis.complexity || "medium",
      needsDecomposition: Boolean(analysis.needsDecomposition),
      estimatedSubTasks: Math.max(
        1,
        Math.min(8, parseInt(analysis.estimatedSubTasks) || 1)
      ),
      originalPrompt: prompt,
      recommendedStrategy: analysis.recommendedStrategy || "direct",
      contextRelevance: contextAnalysis.confidence || 0.5,
      confidence: Math.max(
        0.5,
        Math.min(1, parseFloat(analysis.confidence) || 0.7)
      ),
      reason: analysis.reason || "基于LLM分析结果",
    };

    // 智能校验和调整
    if (enhanced.complexity === "low" && enhanced.estimatedSubTasks > 2) {
      console.log("[AGENT] 校正：低复杂度任务子任务数量过多，调整为1");
      enhanced.estimatedSubTasks = 1;
      enhanced.needsDecomposition = false;
      enhanced.reason += " (校正：低复杂度任务不需要分解)";
    }

    if (enhanced.complexity === "high" && enhanced.estimatedSubTasks < 3) {
      console.log("[AGENT] 校正：高复杂度任务子任务数量不足，调整为最少3个");
      enhanced.estimatedSubTasks = 3;
      enhanced.needsDecomposition = true;
      enhanced.reason += " (校正：高复杂度任务需要充分分解)";
    }

    // 基于prompt长度进行二次验证
    const promptLength = prompt.length;
    if (promptLength < 20 && enhanced.estimatedSubTasks > 1) {
      console.log("[AGENT] 校正：超短prompt不需要分解");
      enhanced.estimatedSubTasks = 1;
      enhanced.needsDecomposition = false;
    }

    if (promptLength > 500 && enhanced.estimatedSubTasks < 2) {
      console.log("[AGENT] 校正：长prompt建议分解处理");
      enhanced.estimatedSubTasks = Math.max(2, enhanced.estimatedSubTasks);
      enhanced.needsDecomposition = true;
    }

    return enhanced;
  }
  basicTaskAnalysis(prompt, contextAnalysis) {
    const complexityIndicators = {
      high: ["详细分析", "全面", "多个", "复杂", "深入研究", "系统性地"],
      medium: ["分析", "比较", "总结", "建议", "如何"],
      low: ["什么", "简单", "基础", "介绍", "概述"],
    };

    let complexity = "medium";
    for (const [level, keywords] of Object.entries(complexityIndicators)) {
      if (keywords.some((kw) => prompt.includes(kw))) {
        complexity = level;
        break;
      }
    }

    const needsDecomposition = prompt.length > 100 || complexity === "high";
    const estimatedSubTasks =
      complexity === "high" ? 4 : complexity === "medium" ? 2 : 1;

    return {
      taskType: "general",
      complexity,
      needsDecomposition,
      estimatedSubTasks,
      originalPrompt: prompt,
      recommendedStrategy: needsDecomposition ? "decompose" : "direct",
      contextRelevance: contextAnalysis.confidence || 0.5,
    };
  }

  /**
   * 默认任务分解判断
   */
  shouldDecomposeByDefault(prompt) {
    return (
      prompt.length > 80 ||
      prompt.includes("和") ||
      prompt.includes("以及") ||
      prompt.includes("多个") ||
      prompt.split("。").length > 2
    );
  }

  /**
   * 估算子任务数量
   */
  estimateSubTasks(prompt) {
    const sentenceCount = prompt
      .split("。")
      .filter((s) => s.trim().length > 5).length;
    const keywordCount = ["分析", "比较", "总结", "建议", "解释"].filter((kw) =>
      prompt.includes(kw)
    ).length;

    return Math.min(Math.max(sentenceCount, keywordCount, 1), 5);
  }

  /**
   * 直接执行（简单任务）
   */
  async executeDirectly(messages, taskAnalysis, contextAnalysis) {
    const enhancedMessages = [
      ...messages.slice(0, -1),
      {
        role: "system",
        content: this.buildExecutionPrompt(taskAnalysis, contextAnalysis),
      },
      messages[messages.length - 1], // 用户原始请求
    ];

    const response = await this.callLLM(enhancedMessages);
    return {
      type: "direct",
      content: response,
      method: "enhanced_single_llm_call",
      contextUsed: true,
    };
  }

  /**
   * 构建执行提示
   */
  buildExecutionPrompt(taskAnalysis, contextAnalysis) {
    const prompts = [];

    if (contextAnalysis.recommendedStyle) {
      prompts.push(`回答风格: ${contextAnalysis.recommendedStyle}`);
    }

    if (taskAnalysis.complexity) {
      prompts.push(`任务复杂度: ${taskAnalysis.complexity}`);
    }

    if (contextAnalysis.keyPoints?.length > 0) {
      prompts.push(`关注要点: ${contextAnalysis.keyPoints.join(", ")}`);
    }

    return prompts.length > 0 ? `执行指导: ${prompts.join("; ")}` : "";
  }

  /**
   * 子代理执行（复杂任务）
   */
  async executeWithSubAgents(taskAnalysis, originalMessages, contextAnalysis) {
    // 分解子任务
    const subTasks = await this.decomposeTask(
      taskAnalysis,
      originalMessages,
      contextAnalysis
    );

    // 初始化串行执行状态
    const serialExecution = {
      totalTasks: subTasks.length,
      completedTasks: 0,
      failedTasks: 0,
      startTime: Date.now(),
      isPaused: false,
      isCancelled: false,
      currentTaskIndex: 0,
    };

    this.emit("serial:start", {
      totalTasks: serialExecution.totalTasks,
      executionMode: this.config.task.enableConcurrency
        ? "concurrent"
        : "sequential",
    });

    // 执行子任务
    const subResults = [];

    if (this.config.task.enableConcurrency && subTasks.length > 1) {
      // 并发执行
      const promises = subTasks.map((subTask) =>
        this.executeSubTask(subTask, originalMessages, contextAnalysis)
      );
      const results = await Promise.all(promises);
      subResults.push(...results);
    } else {
      // 增强的顺序执行
      for (let i = 0; i < subTasks.length; i++) {
        const subTask = subTasks[i];
        serialExecution.currentTaskIndex = i;

        // 检查是否被取消
        if (serialExecution.isCancelled) {
          this.emit("serial:cancelled", {
            completedTasks: serialExecution.completedTasks,
            failedTasks: serialExecution.failedTasks,
          });
          break;
        }

        // 检查暂停状态
        while (serialExecution.isPaused) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        try {
          this.emit("serial:task:start", {
            taskIndex: i + 1,
            totalTasks: subTasks.length,
            taskId: subTask.id,
            description: subTask.description,
          });

          const result = await this.executeSubTask(
            subTask,
            originalMessages,
            contextAnalysis
          );

          if (result.success) {
            serialExecution.completedTasks++;
            this.emit("serial:task:complete", {
              taskIndex: i + 1,
              taskId: subTask.id,
              success: true,
            });
          } else {
            serialExecution.failedTasks++;
            this.emit("serial:task:failed", {
              taskIndex: i + 1,
              taskId: subTask.id,
              error: result.error,
            });

            // 错误处理策略
            if (this.config.task.errorHandling === "stop_on_error") {
              throw new Error(`子任务执行失败: ${result.error}`);
            }
          }

          subResults.push(result);
        } catch (error) {
          console.log(
            "[DEBUG] Caught error in task",
            i + 1,
            ":",
            error.message
          );
          console.log("[DEBUG] Error stack:", error.stack);

          serialExecution.failedTasks++;
          this.emit("serial:task:error", {
            taskIndex: i + 1,
            taskId: subTask.id,
            error: error.message,
          });

          // 根据配置决定是否继续执行
          if (this.config.task.errorHandling === "continue_on_error") {
            // 创建失败结果但继续执行
            subResults.push({
              subTaskId: subTask.id,
              error: error.message,
              success: false,
              agentId: "error_recovery",
            });
          } else {
            throw error; // 默认行为：停止执行
          }
        }

        // 任务间延迟（可选）
        if (i < subTasks.length - 1 && this.config.task.sequentialDelay > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.task.sequentialDelay)
          );
        }
      }
    }

    const executionTime = Date.now() - serialExecution.startTime;

    this.emit("serial:complete", {
      totalTasks: serialExecution.totalTasks,
      completedTasks: serialExecution.completedTasks,
      failedTasks: serialExecution.failedTasks,
      executionTime,
    });

    // 汇总结果
    return await this.synthesizeResults(
      subResults,
      taskAnalysis,
      contextAnalysis
    );
  }

  /**
   * 任务分解（增强版）
   */
  async decomposeTask(taskAnalysis, messages, contextAnalysis) {
    const decompositionMessages = [
      ...messages.slice(0, -1),
      {
        role: "system",
        content: `你是一个任务分解专家。请结合上下文信息智能分解任务。

上下文分析：
${JSON.stringify(contextAnalysis, null, 2)}

分解要求：
1. 子任务应该相互独立且可执行
2. 考虑上下文相关性优化分解策略
3. 基于任务复杂度确定分解粒度
4. 为每个子任务分配合理的优先级
5. 考虑子任务间的依赖关系

返回结构化的JSON数组，每个元素包含：id, description, priority, estimatedComplexity`,
      },
      {
        role: "user",
        content: `请将以下任务智能分解为${taskAnalysis.estimatedSubTasks}个子任务：
${taskAnalysis.originalPrompt}`,
      },
    ];

    try {
      const response = await this.callLLM(decompositionMessages, {
        temperature: 0.4,
      });
      const parseResult = JSONParser.safeParse(response, { fallback: [] });

      if (!parseResult.success || !Array.isArray(parseResult.data)) {
        throw new Error("任务分解结果不是有效的JSON数组");
      }

      const subTasks = parseResult.data;

      // 验证子任务结构
      const validSubTasks = subTasks.filter(
        (task) =>
          task && typeof task === "object" && task.id && task.description
      );

      return validSubTasks.length > 0
        ? validSubTasks
        : this.basicDecomposeTask(taskAnalysis);
    } catch (error) {
      console.warn("[AGENT] 智能任务分解失败，使用基础分解:", error.message);
      return this.basicDecomposeTask(taskAnalysis);
    }
  }

  /**
   * 基础任务分解
   */
  basicDecomposeTask(taskAnalysis) {
    const subTasks = [];
    const count = taskAnalysis.estimatedSubTasks || 2;

    for (let i = 1; i <= count; i++) {
      subTasks.push({
        id: `subtask_${i}`,
        description: `${taskAnalysis.originalPrompt} - 部分${i}`,
        priority: i,
        estimatedComplexity: taskAnalysis.complexity || "medium",
      });
    }

    return subTasks;
  }

  /**
   * 执行单个子任务（增强版）
   */
  async executeSubTask(subTask, parentMessages, contextAnalysis) {
    const agentId = `subagent_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    this.emit("subAgent:create", agentId);

    const subMessages = [
      parentMessages[0], // 系统提示
      {
        role: "system",
        content: `你是一个专业的子任务执行代理。请专注完成分配的具体子任务。

子任务信息：
- 任务ID: ${subTask.id}
- 优先级: ${subTask.priority}
- 预估复杂度: ${subTask.estimatedComplexity}

执行要求：
1. 专注完成指定的具体子任务
2. 提供详细且准确的结果
3. 保持与主任务目标的一致性
4. 如有需要，可以请求额外信息`,
      },
      {
        role: "user",
        content: `执行子任务：${subTask.description}\n\n这是主任务的一部分，请专注完成这个具体子任务。`,
      },
    ];

    try {
      const response = await this.callLLM(subMessages);

      return {
        subTaskId: subTask.id,
        result: response,
        success: true,
        agentId,
        priority: subTask.priority,
      };
    } catch (error) {
      return {
        subTaskId: subTask.id,
        error: error.message,
        success: false,
        agentId,
      };
    }
  }

  /**
   * 结果汇总（增强版）
   */
  async synthesizeResults(subResults, taskAnalysis, contextAnalysis) {
    console.log("[DEBUG] synthesizeResults called with:", {
      subResultsCount: subResults.length,
      subResults: subResults.map((r) => ({
        success: r.success,
        subTaskId: r.subTaskId,
        hasResult: !!r.result,
      })),
      taskAnalysis: taskAnalysis.taskType,
      contextAnalysis: contextAnalysis.summary,
    });

    const successfulResults = subResults.filter((r) => r.success);

    console.log("[DEBUG] successfulResults:", {
      count: successfulResults.length,
      results: successfulResults.map((r) => ({
        subTaskId: r.subTaskId,
        resultPreview: r.result?.substring(0, 100),
      })),
    });

    if (successfulResults.length === 0) {
      return {
        type: "synthesis",
        content: "所有子任务执行失败",
        error: "No successful sub-tasks",
        contextAnalysis: contextAnalysis.summary,
      };
    }

    // 智能汇总：使用LLM进行结果整合
    if (successfulResults.length > 1) {
      try {
        return await this.intelligentSynthesis(
          successfulResults,
          taskAnalysis,
          contextAnalysis
        );
      } catch (error) {
        console.warn("[AGENT] 智能汇总失败，使用基础汇总:", error.message);
        // 回退到基础文本汇总
        return this.basicTextSynthesis(
          successfulResults,
          taskAnalysis,
          contextAnalysis
        );
      }
    }

    // 单结果直接返回
    return {
      type: "synthesis",
      content: successfulResults[0].result,
      subTaskCount: 1,
      method: "single_result",
      contextAnalysis: contextAnalysis.summary,
      success: true,
    };
  }

  /**
   * JSON结果汇总
   */
  async synthesizeJSONResults(extractedResults, taskAnalysis, contextAnalysis) {
    const jsonResults = extractedResults.filter((r) => r.resultType === "json");

    try {
      // 尝试智能合并JSON结果
      const mergeMessages = [
        {
          role: "system",
          content: `你是一个JSON数据合并专家。请合并多个相关的JSON结果。

合并要求：
1. 保持数据结构的完整性
2. 合并相关的字段，避免重复
3. 如果数据结构不同，创建合适的容器结构
4. 保持数据类型的正确性
5. 返回有效的JSON格式`,
        },
        {
          role: "user",
          content: `请合并以下JSON结果：\n\n${jsonResults
            .map(
              (r) =>
                `子任务${r.subTaskId}结果: ${JSON.stringify(
                  r.extractedJSON,
                  null,
                  2
                )}`
            )
            .join("\n\n---\n\n")}\n\n原始任务: ${taskAnalysis.originalPrompt}`,
        },
      ];

      const mergedJSONResponse = await this.callLLM(mergeMessages, {
        temperature: 0.2,
      });
      const mergedJSON = JSONParser.extractJSON(mergedJSONResponse);

      if (mergedJSON) {
        return {
          type: "synthesis",
          content: JSON.stringify(mergedJSON, null, 2),
          subTaskCount: extractedResults.length,
          method: "json_merge",
          contextAnalysis: contextAnalysis.summary,
          data: mergedJSON,
        };
      }
    } catch (error) {
      console.warn("[AGENT] JSON智能合并失败，使用基础合并:", error.message);
    }

    // 基础JSON合并：简单组合所有JSON结果
    const combinedData = {
      subTaskResults: jsonResults.map((r) => ({
        subTaskId: r.subTaskId,
        data: r.extractedJSON,
      })),
      metadata: {
        totalSubTasks: extractedResults.length,
        jsonSubTasks: jsonResults.length,
        taskType: taskAnalysis.taskType,
        timestamp: Date.now(),
      },
    };

    return {
      type: "synthesis",
      content: JSON.stringify(combinedData, null, 2),
      subTaskCount: extractedResults.length,
      method: "json_combination",
      contextAnalysis: contextAnalysis.summary,
      data: combinedData,
    };
  }

  /**
   * 智能结果汇总
   */
  async intelligentSynthesis(successfulResults, taskAnalysis, contextAnalysis) {
    // 首先尝试从子任务结果中提取JSON数据
    const extractedResults = successfulResults.map((result) => {
      try {
        // 尝试提取JSON数据
        const jsonData = JSONParser.extractJSON(result.result);
        if (jsonData) {
          return {
            ...result,
            extractedJSON: jsonData,
            resultType: "json",
          };
        }
      } catch (error) {
        // JSON提取失败，标记为文本类型
        console.warn("[AGENT] JSON提取失败，使用文本模式:", error.message);
      }

      return {
        ...result,
        resultType: "text",
      };
    });

    // 检查是否所有结果都是JSON格式
    const allJSON = extractedResults.every((r) => r.resultType === "json");
    const hasJSON = extractedResults.some((r) => r.resultType === "json");

    // 如果原始请求期望JSON响应，或者所有结果都是JSON，则尝试保持JSON格式
    const shouldPreserveJSON =
      taskAnalysis.originalPrompt?.toLowerCase().includes("json") ||
      taskAnalysis.originalPrompt?.toLowerCase().includes("返回json") ||
      taskAnalysis.originalPrompt?.toLowerCase().includes("JSON") ||
      taskAnalysis.originalPrompt?.toLowerCase().includes("返回JSON") ||
      allJSON;

    if (shouldPreserveJSON && hasJSON) {
      return await this.synthesizeJSONResults(
        extractedResults,
        taskAnalysis,
        contextAnalysis
      );
    }

    // 否则使用文本汇总
    const synthesisMessages = [
      {
        role: "system",
        content: `你是一个专业的结果汇总专家。请整合多个子任务的执行结果。

任务背景：
- 原任务：${taskAnalysis.originalPrompt}
- 复杂度：${taskAnalysis.complexity}
- 上下文相关性：${contextAnalysis.confidence || 0.5}

汇总要求：
1. 整合所有子任务结果形成完整回答
2. 保持逻辑连贯性和结构清晰
3. 消除重复内容
4. 补充必要的过渡和连接
5. 基于任务类型调整汇总风格`,
      },
      {
        role: "user",
        content: `请汇总以下子任务结果：\n\n${extractedResults
          .map((r) => `子任务${r.subTaskId}: ${r.result}`)
          .join("\n\n---\n\n")}`,
      },
    ];

    try {
      const synthesizedContent = await this.callLLM(synthesisMessages, {
        temperature: 0.4,
      });

      return {
        type: "synthesis",
        content: synthesizedContent,
        subTaskCount: successfulResults.length,
        method: "intelligent_synthesis",
        contextAnalysis: contextAnalysis.summary,
      };
    } catch (error) {
      console.warn("[AGENT] 智能汇总失败，使用基础汇总:", error.message);

      // 基础汇总：连接所有成功结果
      const combinedContent = extractedResults
        .sort((a, b) => (a.priority || 0) - (b.priority || 0))
        .map((r) => r.result)
        .join("\n\n---\n\n");

      return {
        type: "synthesis",
        content: combinedContent,
        subTaskCount: successfulResults.length,
        method: "basic_combination",
        contextAnalysis: contextAnalysis.summary,
      };
    }
  }

  /**
   * 智能记忆管理 - 基于Claude.md的AU2算法
   */
  addToShortTerm(message) {
    const enhancedMessage = {
      ...message,
      timestamp: Date.now(),
      metadata: {
        taskId: message.taskId,
        tokenUsage: this.estimateTokenUsage(message.content),
        importance: this.calculateMessageImportance(message),
        ...message.metadata,
      },
    };

    this.shortTerm.push(enhancedMessage);
    this.memoryStats.totalMessages++;

    // 智能压缩判断
    if (this.shouldCompressMemory()) {
      this.compressMemoryIntelligently();
    }
  }

  /**
   * 智能压缩判断
   */
  shouldCompressMemory() {
    const currentCount = this.shortTerm.length;
    const tokenUsage = this.calculateCurrentTokenUsage();

    // 基于消息数量或token使用率
    return (
      currentCount > this.config.memory.compressThreshold ||
      tokenUsage > this.config.memory.tokenThreshold
    );
  }

  /**
   * 智能内存压缩（LLM驱动的AU2算法）
   */
  async compressMemoryIntelligently() {
    if (!this.config.memory.enableLLMCompression) {
      return this.basicCompressMemory();
    }

    try {
      const messagesToCompress = this.shortTerm.slice(0, -5); // 保留最近5条

      // AU2算法：8段式结构化压缩
      const compressionPrompt =
        this.generateAU2CompressionPrompt(messagesToCompress);

      const compressionMessages = [
        {
          role: "system",
          content: `你是一个专业的对话历史压缩专家。请按照8段式结构化格式压缩以下对话历史，保持技术准确性和上下文连续性。`,
        },
        {
          role: "user",
          content: compressionPrompt,
        },
      ];

      const compressedContent = await this.callLLM(compressionMessages, {
        temperature: 0.2,
      });

      // 验证压缩结果
      if (!compressedContent || compressedContent.trim().length === 0) {
        throw new Error("LLM压缩返回空内容");
      }

      // 创建结构化摘要
      const summary = {
        type: "llm_compressed",
        content: compressedContent,
        structuredData: this.parseStructuredCompression(compressedContent),
        timestamp: Date.now(),
        originalCount: messagesToCompress.length,
        compressionRatio: this.calculateCompressionRatio(
          messagesToCompress,
          compressedContent
        ),
        keyPoints: this.extractKeyPoints(compressedContent),
        metadata: {
          algorithm: "AU2",
          version: "1.0",
          validated: true,
        },
      };

      this.mediumTerm.push(summary);

      // 更新短期记忆
      this.shortTerm = this.shortTerm.slice(-5);

      this.memoryStats.compressionsCount++;
      this.memoryStats.lastCompressionTime = Date.now();

      this.emit("memory:compress", {
        savedMessages: messagesToCompress.length,
        compressionRatio: summary.compressionRatio,
        algorithm: "AU2",
      });
    } catch (error) {
      console.warn("[AGENT] LLM压缩失败，使用基础压缩:", error.message);
      this.basicCompressMemory();
    }
  }

  /**
   * AU2算法压缩提示生成器
   */
  generateAU2CompressionPrompt(messages) {
    const conversationText = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    return `请按照以下8个结构化段落压缩以下对话历史：

对话历史：
${conversationText}

请按以下格式压缩：

## 1. 背景上下文 (Background Context)
- 项目类型和技术栈
- 当前工作目录和环境  
- 用户的总体目标

## 2. 关键决策 (Key Decisions)
- 重要的技术选择和原因
- 架构决策和设计考虑
- 问题解决方案的选择

## 3. 工具使用记录 (Tool Usage Log)
- 主要使用的工具类型
- 文件操作历史
- 命令执行结果

## 4. 用户意图演进 (User Intent Evolution)
- 需求的变化过程
- 优先级调整
- 新增功能需求

## 5. 执行结果汇总 (Execution Results)
- 成功完成的任务
- 生成的代码和文件
- 验证和测试结果

## 6. 错误与解决 (Errors and Solutions)
- 遇到的问题类型
- 错误处理方法
- 经验教训

## 7. 未解决问题 (Open Issues)
- 当前待解决的问题
- 已知的限制和约束
- 需要后续处理的事项

## 8. 后续计划 (Future Plans)
- 下一步行动计划
- 长期目标规划
- 用户期望的功能

要求：
1. 保持技术准确性
2. 维持上下文连续性
3. 提取关键信息
4. 忽略冗余内容
5. 使用简洁的专业语言`;
  }

  /**
   * 基础压缩（降级方案）
   */
  basicCompressMemory() {
    const messagesToCompress = this.shortTerm.slice(0, -5);

    const summary = {
      userMessages: messagesToCompress.filter((m) => m.role === "user").length,
      assistantMessages: messagesToCompress.filter(
        (m) => m.role === "assistant"
      ).length,
      keyPoints: messagesToCompress
        .filter((m) => m.role === "user")
        .slice(-3)
        .map((m) => m.content.substring(0, 100)),
      timestamp: Date.now(),
      originalCount: messagesToCompress.length,
      type: "basic_compression",
    };

    this.mediumTerm.push({
      type: "basic_summary",
      summary,
      timestamp: Date.now(),
      originalCount: messagesToCompress.length,
    });

    this.shortTerm = this.shortTerm.slice(-5);

    this.emit("memory:compress", {
      savedMessages: messagesToCompress.length,
      type: "basic",
    });
  }

  /**
   * 增强的系统提示构建
   */
  buildEnhancedSystemPrompt(options, contextAnalysis) {
    const basePrompt =
      options.systemPrompt ||
      "你是一个智能助手，能够分析任务并提供结构化回答。";

    const contextInfo = [];

    if (contextAnalysis.userIntent) {
      contextInfo.push(`用户意图: ${contextAnalysis.userIntent}`);
    }

    if (contextAnalysis.recommendedStyle) {
      contextInfo.push(`建议回答风格: ${contextAnalysis.recommendedStyle}`);
    }

    if (this.memoryStats.compressionsCount > 0) {
      contextInfo.push(`历史压缩次数: ${this.memoryStats.compressionsCount}`);
    }

    return `${basePrompt}

${contextInfo.length > 0 ? "上下文信息:\n" + contextInfo.join("\n") : ""}

请基于上下文信息提供最适合的回答。`;
  }

  /**
   * 选择相关的长期记忆
   */
  selectRelevantLongTerm(keyPoints) {
    const relevant = [];

    for (const [key, value] of this.longTerm.entries()) {
      const relevance =
        keyPoints.reduce((score, point) => {
          return score + this.calculateRelevance(point, key + " " + value);
        }, 0) / keyPoints.length;

      if (relevance > 0.4) {
        relevant.push(`${key}: ${value}`);
      }
    }

    return relevant.slice(0, 3); // 最多3条
  }

  /**
   * 选择相关的历史摘要
   */
  selectRelevantSummaries(contextAnalysis) {
    const relevant = [];

    for (const summary of this.mediumTerm.slice(-5)) {
      if (summary.keyPoints) {
        const relevance =
          contextAnalysis.keyPoints?.reduce((score, point) => {
            return (
              score +
              summary.keyPoints.reduce(
                (kpScore, kp) => kpScore + this.calculateRelevance(point, kp),
                0
              ) /
                summary.keyPoints.length
            );
          }, 0) / (contextAnalysis.keyPoints?.length || 1);

        if (relevance > 0.3) {
          relevant.push(summary.content || JSON.stringify(summary.summary));
        }
      }
    }

    return relevant;
  }

  /**
   * 选择相关的最近消息
   */
  selectRelevantRecentMessages(currentPrompt, contextAnalysis) {
    const recentMessages = this.shortTerm.slice(-15);
    const relevant = [];

    for (const message of recentMessages) {
      const relevance = this.calculateRelevance(message.content, currentPrompt);
      if (relevance > 0.2 || message.role === "user") {
        relevant.push({
          role: message.role,
          content: message.content,
        });
      }
    }

    // 确保至少有最近的几条消息
    const guaranteedRecent = recentMessages.slice(-5).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    return [...new Set([...relevant, ...guaranteedRecent])];
  }

  /**
   * 计算文本相关性
   */
  calculateRelevance(text1, text2) {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);

    const intersection = words1.filter((word) => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];

    return intersection.length / union.length;
  }

  /**
   * 记录执行结果到记忆系统
   */
  async recordExecution(taskId, prompt, result, contextAnalysis) {
    // 用户消息记录
    this.addToShortTerm({
      role: "user",
      content: prompt,
      taskId,
      timestamp: Date.now(),
      metadata: {
        contextAnalysis: contextAnalysis.summary,
      },
    });

    // 助手消息记录
    this.addToShortTerm({
      role: "assistant",
      content: result.content || JSON.stringify(result),
      taskId,
      timestamp: Date.now(),
      metadata: {
        executionType: result.type || "direct",
        subTaskCount: result.subTaskCount || 0,
      },
    });

    // 更新长期记忆（重要信息）
    if (result.type === "synthesis" || result.subTaskCount > 0) {
      this.updateLongTermMemory(prompt, result, contextAnalysis);
    }

    // 保存持久化
    this.saveToPersistence();
  }

  /**
   * 更新长期记忆
   */
  updateLongTermMemory(prompt, result, contextAnalysis) {
    // 提取关键信息存入长期记忆
    const keyPatterns = [
      { key: "user_preference", pattern: /偏好|喜欢|习惯/g },
      { key: "project_context", pattern: /项目|工程|代码|文件/g },
      { key: "technical_stack", pattern: /技术|框架|语言|工具/g },
    ];

    for (const { key, pattern } of keyPatterns) {
      if (pattern.test(prompt) || pattern.test(result.content)) {
        this.longTerm.set(`${key}_${Date.now()}`, {
          content: result.content.substring(0, 200),
          context: contextAnalysis.summary,
          timestamp: Date.now(),
        });
      }
    }

    // 限制长期记忆大小
    if (this.longTerm.size > 50) {
      const entries = Array.from(this.longTerm.entries());
      const toKeep = entries.slice(-30); // 保留最新的30条
      this.longTerm.clear();
      toKeep.forEach(([k, v]) => this.longTerm.set(k, v));
    }
  }

  /**
   * 辅助方法：估算token使用量
   */
  estimateTokenUsage(text) {
    return Math.ceil(text.length / 4); // 粗略估算：1个token ≈ 4个字符
  }

  /**
   * 辅助方法：计算消息重要性
   */
  calculateMessageImportance(message) {
    let importance = 1.0;

    // 基于内容长度
    if (message.content.length > 200) importance += 0.2;

    // 基于关键词
    const importantKeywords = ["重要", "关键", "核心", "主要", "必须"];
    if (importantKeywords.some((kw) => message.content.includes(kw))) {
      importance += 0.3;
    }

    // 基于角色
    if (message.role === "assistant" && message.metadata?.subTaskCount > 0) {
      importance += 0.4; // 子任务结果更重要
    }

    return Math.min(importance, 2.0);
  }

  /**
   * 辅助方法：提取用户意图
   */
  extractUserIntent(history) {
    if (history.length === 0) return "unknown";

    const recentUserMessages = history
      .filter((m) => m.role === "user")
      .slice(-3);
    const content = recentUserMessages.map((m) => m.content).join(" ");

    const intentPatterns = [
      { intent: "analysis", keywords: ["分析", "比较", "评估", "研究"] },
      { intent: "generation", keywords: ["生成", "创建", "制作", "编写"] },
      { intent: "explanation", keywords: ["解释", "说明", "什么是", "为什么"] },
      { intent: "summary", keywords: ["总结", "概括", "归纳"] },
      { intent: "recommendation", keywords: ["建议", "推荐", "应该"] },
    ];

    for (const { intent, keywords } of intentPatterns) {
      if (keywords.some((kw) => content.includes(kw))) {
        return intent;
      }
    }

    return "general";
  }

  /**
   * 辅助方法：计算当前token使用率
   */
  calculateCurrentTokenUsage() {
    const totalTokens = this.shortTerm.reduce(
      (sum, m) =>
        sum + (m.metadata?.tokenUsage || this.estimateTokenUsage(m.content)),
      0
    );

    return totalTokens / this.config.llm.maxTokens;
  }

  /**
   * 辅助方法：生成快速摘要
   */
  generateQuickSummary() {
    return {
      totalMessages: this.memoryStats.totalMessages,
      recentTopics: this.analyzeTopicFrequency(this.shortTerm.slice(-10)),
      compressionCount: this.memoryStats.compressionsCount,
      longTermSize: this.longTerm.size,
    };
  }

  /**
   * 辅助方法：分析主题频率
   */
  analyzeTopicFrequency(messages) {
    const topics = {};
    const keywords = ["技术", "代码", "项目", "分析", "建议", "问题", "解决"];

    messages.forEach((m) => {
      keywords.forEach((kw) => {
        if (m.content.includes(kw)) {
          topics[kw] = (topics[kw] || 0) + 1;
        }
      });
    });

    return Object.entries(topics)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([topic, count]) => ({ topic, count }));
  }

  /**
   * 解析结构化压缩结果
   */
  parseStructuredCompression(content) {
    const sections = {};
    const sectionMatches = content.match(
      /## \d+\.\s*([^\n]+)\n([^#]*)(?=##|$)/g
    );

    if (sectionMatches) {
      sectionMatches.forEach((match) => {
        const title = match.match(/## \d+\.\s*([^\n]+)/)?.[1]?.trim();
        const body = match.replace(/## \d+\.\s*[^\n]+\n/, "").trim();
        if (title) {
          sections[title] = body;
        }
      });
    }

    return sections;
  }

  /**
   * 提取关键点
   */
  extractKeyPoints(content) {
    const sentences = content
      .split(/[。！？\n]/)
      .filter((s) => s.trim().length > 10);
    return sentences.slice(0, 5); // 取前5个较长句子作为关键点
  }

  /**
   * 计算压缩率
   */
  calculateCompressionRatio(originalMessages, compressedContent) {
    const originalSize = originalMessages.reduce(
      (sum, m) => sum + m.content.length,
      0
    );
    const compressedSize = compressedContent.length;
    return Math.round((1 - compressedSize / originalSize) * 100);
  }

  /**
   * 获取内存使用情况
   */
  getMemoryUsage() {
    return {
      shortTerm: this.shortTerm.length,
      mediumTerm: this.mediumTerm.length,
      longTerm: this.longTerm.size,
      total: this.shortTerm.length + this.mediumTerm.length,
    };
  }

  /**
   * LLM API调用（集成真实API）
   */
  async callLLM(messages, options = {}) {
    try {
      const result = await this.llmClient.call(messages, {
        ...options,
        temperature: options.temperature || this.config.llm.temperature,
      });

      if (!result.success) {
        if (result.fallback) {
          console.log("[AGENT] 使用回退模式处理");
          return this.fallbackResponse(messages);
        }
        throw new Error(`LLM API调用失败: ${result.error}`);
      }

      return result.content;
    } catch (error) {
      console.warn("[AGENT] LLM调用失败，使用回退:", error.message);
      return this.fallbackResponse(messages);
    }
  }

  /**
   * 回退响应（当LLM不可用时）
   */
  fallbackResponse(messages) {
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage.content;

    if (content.includes("分析这个任务")) {
      return JSON.stringify({
        taskType: "analysis",
        complexity: "medium",
        needsDecomposition: true,
        estimatedSubTasks: 3,
      });
    }

    if (content.includes("分解为")) {
      return JSON.stringify([
        { id: "subtask_1", description: "理解任务需求", priority: 1 },
        { id: "subtask_2", description: "分析关键要素", priority: 2 },
        { id: "subtask_3", description: "生成综合结果", priority: 3 },
      ]);
    }

    return "我理解您的请求，但由于API限制，我提供了这个回退响应。";
  }

  parseJSON(str) {
    try {
      return JSONParser.extractJSON(str) || { content: str };
    } catch {
      return { content: str };
    }
  }
}

export default WKAgent;
