/**
 * LLM客户端 - 集成DeepSeek API
 * 支持OpenAI SDK格式
 */

// 请安装OpenAI SDK: npm install openai
import OpenAI from 'openai';

class LLMClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.DEEPSEEK_API_KEY;
    this.baseURL = config.baseURL || 'https://api.deepseek.com';
    
    if (!this.apiKey || this.apiKey === 'your-api-key-here') {
      console.warn('⚠️  未设置有效的API密钥，将使用回退模式');
      this.enabled = false;
      this.client = null;
    } else {
      this.enabled = true;
      this.client = new OpenAI({
        baseURL: this.baseURL,
        apiKey: this.apiKey,
      });
    }
    
    this.defaultModel = config.model || 'deepseek-chat';
    this.maxTokens = config.maxTokens || 4000;
    this.temperature = config.temperature || 0.7;
  }

  /**
   * 调用LLM API
   */
  async call(messages, options = {}) {
    if (!this.enabled) {
      return {
        success: false,
        error: 'API未启用 - 请配置有效的API密钥',
        fallback: true
      };
    }

    try {
      const completion = await this.client.chat.completions.create({
        messages,
        model: options.model || this.defaultModel,
        max_tokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature || this.temperature,
        response_format: options.responseFormat || { type: 'text' }
      });

      return {
        success: true,
        content: completion.choices[0].message.content,
        usage: completion.usage,
        model: completion.model
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * 流式调用（可选）
   */
  async *stream(messages, options = {}) {
    try {
      const stream = await this.client.chat.completions.create({
        messages,
        model: options.model || this.defaultModel,
        max_tokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature || this.temperature,
        stream: true
      });

      for await (const chunk of stream) {
        yield chunk.choices[0]?.delta?.content || '';
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const testMessages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' }
      ];

      const result = await this.call(testMessages, { maxTokens: 10 });
      return {
        healthy: result.success,
        latency: Date.now(),
        error: result.error
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }
}

export default LLMClient;