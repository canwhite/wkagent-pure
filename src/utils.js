/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * JSON解析工具集
 * 专门用于处理LLM响应中的JSON数据
 */

import { jsonrepair } from "jsonrepair";

class JSONParser {
  /**
   * 从文本中提取JSON对象 - 增强版
   * @param {string} text - 包含JSON的文本
   * @returns {Object|null} - 解析后的JSON对象或null
   */
  static extractJSON(text) {
    if (!text || typeof text !== "string") {
      return null;
    }

    // 清理文本
    const cleanedText = text.trim();

    // 快速预检查：避免明显的非JSON内容
    if (this.isLikelyNonJSON(cleanedText)) {
      console.log("[JSONParser] 检测到非JSON内容，跳过解析");
      return null;
    }

    // 检查是否可能是JSON结构
    if (!this.hasJSONStructure(cleanedText)) {
      console.log("[JSONParser] 内容不符合JSON结构特征");
      return null;
    }

    // 尝试直接解析
    try {
      return JSON.parse(cleanedText);
    } catch (e) {
      console.log("[JSONParser] 直接解析失败:", e.message);
      // 继续尝试其他方法
    }

    // 方法1: 查找代码块中的JSON
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
    let match;
    while ((match = codeBlockRegex.exec(cleanedText)) !== null) {
      try {
        const codeBlockContent = match[1].trim();
        // 检查代码块内容是否可能是JSON
        if (this.hasJSONStructure(codeBlockContent)) {
          return JSON.parse(codeBlockContent);
        }
      } catch (e) {
        // 尝试修复
        try {
          const repaired = jsonrepair(match[1].trim());
          if (this.hasJSONStructure(repaired)) {
            return JSON.parse(repaired);
          }
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
        const potentialJSON = jsonMatch[0];
        // 验证结构
        if (this.hasJSONStructure(potentialJSON)) {
          return JSON.parse(jsonrepair(potentialJSON));
        }
      } catch (e) {
        // 继续尝试
        console.log("[JSONParser] 字面量解析失败:", e.message);
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
   * 快速检测是否为非JSON内容
   * @param {string} text - 文本内容
   * @returns {boolean} - 是否可能是非JSON内容
   */
  static isLikelyNonJSON(text) {
    if (!text) return true;

    // 首先检查是否包含JSON结构特征
    const hasJsonStructure = /[{}[\]]/.test(text) || /"[^"]*"\s*:/.test(text);
    if (hasJsonStructure) {
      return false; // 可能包含JSON，不跳过
    }

    // 检查是否以中文或常见非JSON字符开头
    const nonJSONPatterns = [
      /^[\u4e00-\u9fa5]/, // 中文字符
      /^[我将为你让我来]/, // 常见AI回复开头
      /^python\s*\n/i, // Python代码
      /^正在/, // 中文进行时
      /^(note|warning|error):/i, // 日志信息
      /^\*\*.*\*\*$/, // Markdown加粗
      /^#+\s/, // Markdown标题
      /^\s*[A-Za-z\u4e00-\u9fa5]+[：:]\s*/, // 中文标题或英文标题
      /^\s*def\s+\w+\s*\(/, // Python函数定义
      /^\s*import\s+\w+/, // Python导入
      /^\s*class\s+\w+/, // Python类定义
      /^\s*function\s+\w+\s*\(/, // JavaScript函数
      /^\s*const\s+\w+\s*=/, // JavaScript常量
      /^\s*let\s+\w+\s*=/, // JavaScript变量
    ];

    return nonJSONPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * 检查文本是否具有JSON结构特征
   * @param {string} text - 文本内容
   * @returns {boolean} - 是否具有JSON结构
   */
  static hasJSONStructure(text) {
    if (!text || text.length < 2) return false;

    // 检查是否以JSON结构开始和结束
    const trimmed = text.trim();

    // 必须以大括号或中括号开始
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      return false;
    }

    // 必须以大括号或中括号结束
    if (!trimmed.endsWith("}") && !trimmed.endsWith("]")) {
      return false;
    }

    // 检查是否包含基本的JSON结构特征
    const hasQuotes = text.includes('"');
    const hasColon = text.includes(":");
    const hasComma = text.includes(",");

    // 对象结构：必须有引号、冒号，可选逗号
    if (trimmed.startsWith("{")) {
      return hasQuotes && hasColon;
    }

    // 数组结构：必须有方括号，可选逗号
    if (trimmed.startsWith("[")) {
      return true; // 数组可以很简单，如 [1,2,3]
    }

    return false;
  }

  /**
   * 提取JSON候选结构
   * @param {string} text - 文本内容
   * @returns {Array} - JSON字符串候选数组
   */
  static extractJSONCandidates(text) {
    const candidates = [];

    // 方法1: 提取代码块
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      candidates.push({
        content: match[1].trim(),
        confidence: 0.9,
        source: "codeblock",
      });
    }

    // 方法2: 提取大括号结构
    const braceRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
    const braceMatches = text.match(braceRegex) || [];
    for (const match of braceMatches) {
      candidates.push({
        content: match,
        confidence: 0.7,
        source: "braces",
      });
    }

    // 方法3: 提取中括号结构
    const bracketRegex = /\[[^[\]]*(?:\[[^[\]]*\][^[\]]*)*\]/g;
    const bracketMatches = text.match(bracketRegex) || [];
    for (const match of bracketMatches) {
      candidates.push({
        content: match,
        confidence: 0.6,
        source: "brackets",
      });
    }

    // 按置信度排序
    return candidates
      .sort((a, b) => b.confidence - a.confidence)
      .map((item) => item.content);
  }

  /**
   * 验证JSON结构是否有效
   * @param {Object} data - 解析后的数据
   * @returns {boolean} - 是否有效
   */
  static isValidJSONStructure(data) {
    if (!data || typeof data !== "object") {
      return false;
    }

    // 检查是否为空对象或数组
    if (Array.isArray(data) && data.length === 0) {
      return true; // 空数组是有效的
    }

    if (!Array.isArray(data) && Object.keys(data).length === 0) {
      return true; // 空对象是有效的
    }

    // 检查是否包含有效数据
    try {
      JSON.stringify(data);
      return true;
    } catch (e) {
      return false;
    }
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
      // 预检查
      if (this.isLikelyNonJSON(jsonString)) {
        return {
          success: false,
          data: fallback,
          error: "Content appears to be non-JSON",
        };
      }

      const data = JSON.parse(jsonrepair(jsonString.trim()));

      // 验证解析结果
      if (!this.isValidJSONStructure(data)) {
        return {
          success: false,
          data: fallback,
          error: "Invalid JSON structure",
        };
      }

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
   * 从LLM响应中提取JSON数组 - 增强版
   * @param {string} text - LLM响应文本
   * @returns {Array} - JSON对象数组
   */
  static extractJSONArray(text) {
    const results = [];

    if (!text || typeof text !== "string") {
      return results;
    }

    // 首先尝试提取代码块中的JSON数组
    const codeBlockRegex = /```json\s*([\s\S]*?)\s*```/g;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      try {
        const content = match[1].trim();
        // 尝试解析整个代码块内容
        const parsed = JSON.parse(jsonrepair(content));
        if (Array.isArray(parsed)) {
          results.push(...parsed);
        } else if (typeof parsed === "object" && parsed !== null) {
          results.push(parsed);
        }
      } catch (e) {
        // 如果整体解析失败，尝试提取其中的JSON对象
        const objectRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
        const objMatches = match[1].match(objectRegex) || [];
        for (const objMatch of objMatches) {
          try {
            const obj = JSON.parse(jsonrepair(objMatch));
            results.push(obj);
          } catch (objError) {
            continue;
          }
        }
      }
    }

    // 如果在代码块中没有找到，则在全文查找
    if (results.length === 0) {
      // 查找所有可能的JSON对象
      const objectRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
      const matches = text.match(objectRegex) || [];

      for (const match of matches) {
        try {
          const obj = JSON.parse(jsonrepair(match));
          if (this.isValidJSONStructure(obj)) {
            results.push(obj);
          }
        } catch (e) {
          continue;
        }
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
