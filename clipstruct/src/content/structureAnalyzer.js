/**
 * ClipStruct 结构分析模块 - 规则引擎
 * 基于规则将预处理后的字幕分段识别为7种结构类型
 */

import { SEGMENT_TYPES, STRUCTURE_KEYWORDS } from '../common/constants.js';
import { getSegmentText } from './textPreprocessor.js';

/**
 * 分析视频结构
 * @param {Array} segments - 预处理后的分段数组
 * @param {number} videoDuration - 视频总时长（秒），用于识别 callToAction
 * @returns {Array} 结构分析结果 [{ type, start, end, intent, text }, ...]
 */
export function analyzeStructure(segments, videoDuration = null) {
  if (!segments || segments.length === 0) {
    throw new Error('分段数据为空');
  }

  console.log(`[ClipStruct] 开始结构分析，共 ${segments.length} 个分段...`);

  const structureSegments = [];

  // 遍历每个分段，识别结构类型
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const text = getSegmentText(segment);
    const start = segment.start;
    const end = segment.end;
    const duration = end - start;

    // 识别结构类型
    const type = identifySegmentType(text, start, end, duration, i, segments.length, videoDuration);
    
    // 生成意图描述
    const intent = generateIntent(type, text);

    structureSegments.push({
      type,
      start,
      end,
      duration,
      text,
      intent,
      userModified: false, // 标记是否用户手动修改过
    });

    console.log(`[ClipStruct] 段落 ${i + 1}: ${type} (${start.toFixed(1)}s-${end.toFixed(1)}s)`);
  }

  // 后处理：优化结构类型（避免同类型连续出现、确保必要类型存在等）
  const optimized = postProcessStructure(structureSegments);

  console.log('[ClipStruct] 结构分析完成');
  return optimized;
}

/**
 * 识别分段的结构类型
 * @param {string} text - 分段文本
 * @param {number} start - 开始时间
 * @param {number} end - 结束时间
 * @param {number} duration - 持续时长
 * @param {number} index - 当前分段索引
 * @param {number} totalSegments - 总分段数
 * @param {number} videoDuration - 视频总时长
 * @returns {string} 结构类型
 */
function identifySegmentType(text, start, end, duration, index, totalSegments, videoDuration) {
  const lowerText = text.toLowerCase();

  // 规则1: callToAction - 视频最后30-60秒 + 关键词
  if (videoDuration && end >= videoDuration - 60) {
    if (hasKeywords(lowerText, SEGMENT_TYPES.CALL_TO_ACTION)) {
      return SEGMENT_TYPES.CALL_TO_ACTION;
    }
  }

  // 规则2: hook - 前15-30秒 + 关键词
  if (start < 30) {
    if (hasKeywords(lowerText, SEGMENT_TYPES.HOOK)) {
      return SEGMENT_TYPES.HOOK;
    }
    // 即使没有关键词，前15秒也大概率是 hook
    if (start < 15) {
      return SEGMENT_TYPES.HOOK;
    }
  }

  // 规则3: transition - 长度 < 20秒 + 关键词
  if (duration < 20 && hasKeywords(lowerText, SEGMENT_TYPES.TRANSITION)) {
    return SEGMENT_TYPES.TRANSITION;
  }

  // 规则4: emotional - 关键词 + 感叹号/问号
  if (hasKeywords(lowerText, SEGMENT_TYPES.EMOTIONAL) && hasEmotionalPunctuation(text)) {
    return SEGMENT_TYPES.EMOTIONAL;
  }

  // 规则5: example - 关键词 + 不在开头
  if (index > 0 && hasKeywords(lowerText, SEGMENT_TYPES.EXAMPLE)) {
    return SEGMENT_TYPES.EXAMPLE;
  }

  // 规则6: background - Hook之后 + 关键词
  if (index > 0 && start < 120 && hasKeywords(lowerText, SEGMENT_TYPES.BACKGROUND)) {
    return SEGMENT_TYPES.BACKGROUND;
  }

  // 规则7: corePoint - 长度 > 45秒 + 关键词
  if (duration > 45 && hasKeywords(lowerText, SEGMENT_TYPES.CORE_POINT)) {
    return SEGMENT_TYPES.CORE_POINT;
  }

  // 默认判断：根据位置和长度
  if (index === 0) {
    return SEGMENT_TYPES.HOOK; // 第一段默认为 hook
  } else if (index === totalSegments - 1) {
    return SEGMENT_TYPES.CALL_TO_ACTION; // 最后一段默认为 callToAction
  } else if (duration > 45) {
    return SEGMENT_TYPES.CORE_POINT; // 长段落默认为核心观点
  } else if (duration < 20) {
    return SEGMENT_TYPES.TRANSITION; // 短段落默认为转折
  } else {
    return SEGMENT_TYPES.BACKGROUND; // 其他默认为背景
  }
}

/**
 * 检查文本是否包含指定类型的关键词
 * @param {string} text - 文本（小写）
 * @param {string} type - 结构类型
 * @returns {boolean}
 */
function hasKeywords(text, type) {
  const keywords = STRUCTURE_KEYWORDS[type];
  if (!keywords || keywords.length === 0) return false;

  return keywords.some(keyword => {
    const lowerKeyword = keyword.toLowerCase();
    // 使用词边界匹配，避免误匹配（如 "the" 匹配到 "there"）
    const regex = new RegExp(`\\b${escapeRegex(lowerKeyword)}\\b`, 'i');
    return regex.test(text);
  });
}

/**
 * 检查文本是否包含情绪化标点（感叹号、问号）
 * @param {string} text - 文本
 * @returns {boolean}
 */
function hasEmotionalPunctuation(text) {
  return /[!?！？]/.test(text);
}

/**
 * 生成段落意图描述
 * @param {string} type - 结构类型
 * @param {string} text - 段落文本
 * @returns {string} 意图描述
 */
function generateIntent(type, text) {
  // 根据类型生成通用意图描述
  const intentTemplates = {
    [SEGMENT_TYPES.HOOK]: '吸引观众注意，激发好奇心',
    [SEGMENT_TYPES.BACKGROUND]: '提供背景信息或铺垫上下文',
    [SEGMENT_TYPES.CORE_POINT]: '阐述核心观点或主要内容',
    [SEGMENT_TYPES.EXAMPLE]: '通过案例或示例说明观点',
    [SEGMENT_TYPES.TRANSITION]: '承上启下，连接不同段落',
    [SEGMENT_TYPES.EMOTIONAL]: '强化情绪，增强感染力',
    [SEGMENT_TYPES.CALL_TO_ACTION]: '引导观众采取行动（订阅/点赞/评论等）',
  };

  let intent = intentTemplates[type] || '段落意图待分析';

  // 增强意图描述：根据文本内容提取关键信息
  const enhancedIntent = enhanceIntent(type, text);
  if (enhancedIntent) {
    intent = enhancedIntent;
  }

  return intent;
}

/**
 * 增强意图描述（根据文本内容提取关键信息）
 * @param {string} type - 结构类型
 * @param {string} text - 段落文本
 * @returns {string|null} 增强后的意图描述，无法提取则返回 null
 */
function enhanceIntent(type, text) {
  const lowerText = text.toLowerCase();

  switch (type) {
    case SEGMENT_TYPES.HOOK:
      if (lowerText.includes('imagine') || lowerText.includes('想象')) {
        return '通过想象场景吸引观众注意';
      }
      if (lowerText.includes('what if') || lowerText.includes('如果')) {
        return '通过假设性问题激发好奇心';
      }
      if (lowerText.includes('secret') || lowerText.includes('秘密')) {
        return '揭示秘密或未知信息吸引观众';
      }
      break;

    case SEGMENT_TYPES.BACKGROUND:
      if (lowerText.includes('story') || lowerText.includes('故事')) {
        return '讲述背景故事，建立情感连接';
      }
      if (lowerText.includes('experience') || lowerText.includes('经历')) {
        return '分享个人经历，建立可信度';
      }
      if (lowerText.includes('problem') || lowerText.includes('问题')) {
        return '阐述问题背景，引出解决方案';
      }
      break;

    case SEGMENT_TYPES.CORE_POINT:
      if (lowerText.includes('key') || lowerText.includes('关键')) {
        return '强调关键要点';
      }
      if (lowerText.includes('reason') || lowerText.includes('原因')) {
        return '解释核心原因或逻辑';
      }
      if (lowerText.includes('truth') || lowerText.includes('真相')) {
        return '揭示事实真相';
      }
      break;

    case SEGMENT_TYPES.EXAMPLE:
      if (lowerText.includes('case') || lowerText.includes('案例')) {
        return '通过真实案例说明观点';
      }
      if (lowerText.includes('instance') || lowerText.includes('例子')) {
        return '举例说明核心概念';
      }
      break;

    case SEGMENT_TYPES.TRANSITION:
      if (lowerText.includes('but') || lowerText.includes('however') || lowerText.includes('但是')) {
        return '转折，引出不同观点或角度';
      }
      if (lowerText.includes('next') || lowerText.includes('moving on') || lowerText.includes('接下来')) {
        return '承上启下，推进到下一话题';
      }
      break;

    case SEGMENT_TYPES.EMOTIONAL:
      if (lowerText.includes('amazing') || lowerText.includes('惊人')) {
        return '表达惊叹，强化情绪冲击';
      }
      if (lowerText.includes('important') || lowerText.includes('重要')) {
        return '强调重要性，引起重视';
      }
      break;

    case SEGMENT_TYPES.CALL_TO_ACTION:
      if (lowerText.includes('subscribe') || lowerText.includes('订阅')) {
        return '引导观众订阅频道';
      }
      if (lowerText.includes('like') || lowerText.includes('点赞')) {
        return '引导观众点赞支持';
      }
      if (lowerText.includes('comment') || lowerText.includes('评论')) {
        return '引导观众留言互动';
      }
      break;
  }

  return null;
}

/**
 * 后处理：优化结构类型识别结果
 * @param {Array} segments - 初步识别的结构段落
 * @returns {Array} 优化后的结构段落
 */
function postProcessStructure(segments) {
  if (!segments || segments.length === 0) return segments;

  const optimized = [...segments];

  // 规则1: 避免连续出现过多相同类型（特别是 background 和 corePoint）
  for (let i = 1; i < optimized.length - 1; i++) {
    const prev = optimized[i - 1];
    const curr = optimized[i];
    const next = optimized[i + 1];

    // 如果前后都是 background，当前也是 background，且当前段较长，升级为 corePoint
    if (
      prev.type === SEGMENT_TYPES.BACKGROUND &&
      curr.type === SEGMENT_TYPES.BACKGROUND &&
      next.type === SEGMENT_TYPES.BACKGROUND &&
      curr.duration > 40
    ) {
      curr.type = SEGMENT_TYPES.CORE_POINT;
      curr.intent = generateIntent(SEGMENT_TYPES.CORE_POINT, curr.text);
    }
  }

  // 规则2: 确保第一段是 hook
  if (optimized.length > 0 && optimized[0].start < 30) {
    if (optimized[0].type !== SEGMENT_TYPES.HOOK) {
      optimized[0].type = SEGMENT_TYPES.HOOK;
      optimized[0].intent = generateIntent(SEGMENT_TYPES.HOOK, optimized[0].text);
    }
  }

  // 规则3: 确保最后一段是 callToAction（如果有明显关键词）
  if (optimized.length > 0) {
    const last = optimized[optimized.length - 1];
    const lowerText = last.text.toLowerCase();
    if (
      hasKeywords(lowerText, SEGMENT_TYPES.CALL_TO_ACTION) &&
      last.type !== SEGMENT_TYPES.CALL_TO_ACTION
    ) {
      last.type = SEGMENT_TYPES.CALL_TO_ACTION;
      last.intent = generateIntent(SEGMENT_TYPES.CALL_TO_ACTION, last.text);
    }
  }

  return optimized;
}

/**
 * 正则表达式转义
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 统计结构类型分布
 * @param {Array} segments - 结构段落数组
 * @returns {Object} 统计信息
 */
export function getStructureStats(segments) {
  if (!segments || segments.length === 0) return {};

  const stats = {
    total: segments.length,
    types: {},
    totalDuration: 0,
  };

  // 统计每种类型的数量和时长
  segments.forEach(seg => {
    if (!stats.types[seg.type]) {
      stats.types[seg.type] = { count: 0, duration: 0 };
    }
    stats.types[seg.type].count++;
    stats.types[seg.type].duration += seg.duration;
    stats.totalDuration += seg.duration;
  });

  // 计算占比
  Object.keys(stats.types).forEach(type => {
    stats.types[type].percentage = (
      (stats.types[type].duration / stats.totalDuration) * 100
    ).toFixed(1);
  });

  return stats;
}

/**
 * 获取视频总时长（从视频元素）
 * @returns {number|null} 视频时长（秒），获取失败返回 null
 */
export function getVideoDuration() {
  try {
    const video = document.querySelector('video');
    if (video && video.duration && !isNaN(video.duration)) {
      return video.duration;
    }
    return null;
  } catch (err) {
    console.warn('[ClipStruct] 获取视频时长失败:', err);
    return null;
  }
}
