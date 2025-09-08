/* eslint-disable no-undef */
/**
 * LLM客户端 - 集成DeepSeek API
 * 支持浏览器环境，使用原生fetch API
 */

class LLMClient {
  constructor(config = {}) {
    // 支持浏览器和Node.js环境
    this.apiKey =
      config.apiKey ||
      (typeof process !== "undefined"
        ? process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY
        : null);
    this.baseURL = config.baseURL || "https://api.deepseek.com";

    if (!this.apiKey || this.apiKey === "your-api-key-here") {
      console.warn("⚠️  未设置有效的API密钥，将使用回退模式");
      this.enabled = false;
    } else {
      this.enabled = true;
    }

    this.defaultModel = config.model || "deepseek-chat";
    this.maxTokens = config.maxTokens || 4000;
    this.temperature = config.temperature || 0.7;
  }

  /**
   * 调用LLM API - 使用原生fetch API
   */
  async call(messages, options = {}) {
    if (!this.enabled) {
      return {
        success: false,
        error: "API未启用 - 请配置有效的API密钥",
        fallback: true,
      };
    }

    try {
      const requestBody = {
        messages,
        model: options.model || this.defaultModel,
        max_tokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature || this.temperature,
        stream: false,
      };

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: { message: "Unknown error" } }));
        throw new Error(
          `API请求失败: ${response.status} ${
            errorData.error?.message || response.statusText
          }`
        );
      }

      const completion = await response.json();

      return {
        success: true,
        content: completion.choices[0]?.message?.content,
        usage: completion.usage,
        model: completion.model,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code || "FETCH_ERROR",
      };
    }
  }

  /**
   * 流式调用（可选）- 使用原生fetch API
   */
  async *stream(messages, options = {}) {
    if (!this.enabled) {
      throw new Error("API未启用 - 请配置有效的API密钥");
    }

    try {
      const requestBody = {
        messages,
        model: options.model || this.defaultModel,
        max_tokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature || this.temperature,
        stream: true,
      };

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: { message: "Unknown error" } }));
        throw new Error(
          `API请求失败: ${response.status} ${
            errorData.error?.message || response.statusText
          }`
        );
      }

      // 处理流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") return;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              console.log(e);
              // 忽略解析错误的行
            }
          }
        }
      }
    } catch (error) {
      throw new Error(`流式调用失败: ${error.message}`);
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const testMessages = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello" },
      ];

      const result = await this.call(testMessages, { maxTokens: 10 });
      return {
        healthy: result.success,
        latency: Date.now(),
        error: result.error,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }
}

export default LLMClient;
