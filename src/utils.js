/**
 * JSON解析工具集
 * 专门用于处理LLM响应中的JSON数据
 */

import { jsonrepair } from "jsonrepair";

class JSONParser {
  /**
   * 从文本中提取JSON对象
   * @param {string} text - 包含JSON的文本
   * @returns {Object|null} - 解析后的JSON对象或null
   */
  static extractJSON(text) {
    if (!text || typeof text !== "string") {
      return null;
    }

    // 清理文本
    const cleanedText = text.trim();

    // 尝试直接解析
    try {
      return JSON.parse(cleanedText);
    } catch (e) {
      // 继续尝试其他方法
    }

    // 方法1: 查找代码块中的JSON
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
    let match;
    while ((match = codeBlockRegex.exec(cleanedText)) !== null) {
      try {
        return JSON.parse(match[1].trim());
      } catch (e) {
        // 尝试修复
        try {
          return JSON.parse(jsonrepair(match[1].trim()));
        } catch (repairError) {
          continue;
        }
      }
    }

    // 方法2: 查找对象或数组字面量
    const objectRegex = /\{[\s\S]*\}/;
    const arrayRegex = /\[[\s\S]*\]/;

    let jsonMatch =
      cleanedText.match(objectRegex) || cleanedText.match(arrayRegex);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonrepair(jsonMatch[0]));
      } catch (e) {
        // 继续尝试
      }
    }

    // 方法3: 查找键值对模式
    const keyValueRegex =
      /"[^"]*"\s*:\s*("[^"]*"|\d+|true|false|null|\{[^}]*\}|\[[^\]]*\])/g;
    const hasKeyValue = keyValueRegex.test(cleanedText);
    if (hasKeyValue) {
      try {
        return JSON.parse(jsonrepair(cleanedText));
      } catch (e) {
        // 最终尝试提取最可能的JSON部分
        return this.extractBestJSON(cleanedText);
      }
    }

    return null;
  }

  /**
   * 提取最佳可能的JSON字符串
   * @param {string} text - 文本内容
   * @returns {Object|null} - JSON对象
   */
  static extractBestJSON(text) {
    // 查找最内层的完整JSON对象
    const stack = [];
    let start = -1;
    let bestJson = null;
    let maxDepth = 0;

    for (let i = 0; i < text.length; i++) {
      if (text[i] === "{" || text[i] === "[") {
        if (stack.length === 0) {
          start = i;
        }
        stack.push(text[i]);
      } else if ((text[i] === "}" || text[i] === "]") && stack.length > 0) {
        const open = stack.pop();
        if (
          (open === "{" && text[i] === "}") ||
          (open === "[" && text[i] === "]")
        ) {
          if (stack.length === 0 && start !== -1) {
            const jsonStr = text.substring(start, i + 1);
            try {
              const parsed = JSON.parse(jsonrepair(jsonStr));
              if (stack.length + 1 > maxDepth) {
                bestJson = parsed;
                maxDepth = stack.length + 1;
              }
            } catch (e) {
              continue;
            }
          }
        }
      }
    }

    return bestJson;
  }

  /**
   * 安全解析JSON
   * @param {string} jsonString - JSON字符串
   * @param {Object} options - 选项
   * @returns {Object} - 解析结果
   */
  static safeParse(jsonString, options = {}) {
    const { fallback = {}, strict = false } = options;

    if (!jsonString || typeof jsonString !== "string") {
      return { success: false, data: fallback, error: "Invalid input" };
    }

    try {
      const data = JSON.parse(jsonrepair(jsonString.trim()));
      return { success: true, data, error: null };
    } catch (error) {
      if (strict) {
        return { success: false, data: fallback, error: error.message };
      }

      // 尝试提取JSON
      const extracted = this.extractJSON(jsonString);
      if (extracted) {
        return { success: true, data: extracted, error: null };
      }

      return {
        success: false,
        data: fallback,
        error: "Failed to extract valid JSON",
      };
    }
  }

  /**
   * 验证JSON结构
   * @param {Object} data - 要验证的数据
   * @param {Object} schema - 验证模式
   * @returns {Object} - 验证结果
   */
  static validateJSON(data, schema) {
    if (!data || typeof data !== "object") {
      return { valid: false, error: "Invalid data type" };
    }

    const errors = [];

    for (const [key, config] of Object.entries(schema)) {
      if (config.required && !(key in data)) {
        errors.push(`Missing required field: ${key}`);
        continue;
      }

      if (key in data) {
        const value = data[key];
        const type = config.type;

        if (
          type &&
          typeof value !== type &&
          !(type === "array" && Array.isArray(value))
        ) {
          errors.push(
            `Invalid type for ${key}: expected ${type}, got ${typeof value}`
          );
        }

        if (config.validate && !config.validate(value)) {
          errors.push(`Invalid value for ${key}: ${value}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : null,
    };
  }

  /**
   * 从LLM响应中提取JSON数组
   * @param {string} text - LLM响应文本
   * @returns {Array} - JSON对象数组
   */
  static extractJSONArray(text) {
    const results = [];

    // 查找所有可能的JSON对象
    const objectRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
    const matches = text.match(objectRegex) || [];

    for (const match of matches) {
      try {
        const obj = JSON.parse(jsonrepair(match));
        results.push(obj);
      } catch (e) {
        continue;
      }
    }

    return results;
  }

  /**
   * 清理和标准化JSON字符串
   * @param {string} text - 原始文本
   * @returns {string} - 清理后的文本
   */
  static cleanJSONString(text) {
    if (!text || typeof text !== "string") {
      return "";
    }

    return text
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t")
      .replace(/"/g, '\\"')
      .trim();
  }
}

export default JSONParser;
