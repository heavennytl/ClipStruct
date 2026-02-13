/**
 * ClipStruct 文本预处理模块
 * 功能：合并短句、过滤填充词、自然分段检测
 */

import {
  FILLER_WORDS,
  MERGE_GAP_THRESHOLD,
  MERGE_LENGTH_LIMIT,
  SEGMENT_GAP_THRESHOLD,
} from '../common/constants.js';

/**
 * 预处理字幕数据
 * @param {Array} captions - 原始字幕数组 [{ text, start, duration }, ...]
 * @returns {Array} 预处理后的字幕分段 [{ text, start, end, original_indices }, ...]
 */
export function preprocessCaptions(captions) {
  if (!captions || captions.length === 0) {
    throw new Error('字幕数据为空');
  }

  console.log(`[ClipStruct] 开始预处理 ${captions.length} 条字幕...`);

  // 步骤1：过滤填充词
  const cleaned = removeFillerWords(captions);
  console.log(`[ClipStruct] 填充词过滤完成`);

  // 步骤2：合并短句
  const merged = mergeShortCaptions(cleaned);
  console.log(`[ClipStruct] 短句合并完成，合并为 ${merged.length} 段`);

  // 步骤3：自然分段检测
  const segmented = detectNaturalSegments(merged);
  console.log(`[ClipStruct] 自然分段检测完成，共 ${segmented.length} 个自然段`);

  return segmented;
}

/**
 * 过滤口语填充词
 * 注意：仅过滤填充词，保留结构信号词（如"但是""因为""首先"等）
 */
function removeFillerWords(captions) {
  // 构建填充词正则表达式（忽略大小写）
  const allFillers = [...FILLER_WORDS.en, ...FILLER_WORDS.zh];
  const fillerPattern = new RegExp(
    `\\b(${allFillers.map(escapeRegex).join('|')})\\b`,
    'gi'
  );

  return captions.map(caption => ({
    ...caption,
    text: caption.text.replace(fillerPattern, '').replace(/\s+/g, ' ').trim(),
  })).filter(caption => caption.text.length > 0); // 过滤掉空文本
}

/**
 * 合并短句
 * 规则：
 * - 时间间隔 < 0.5 秒
 * - 合并后总长度 < 200 字符
 */
function mergeShortCaptions(captions) {
  if (captions.length === 0) return [];

  const merged = [];
  let current = {
    text: captions[0].text,
    start: captions[0].start,
    end: captions[0].start + captions[0].duration,
    original_indices: [0],
  };

  for (let i = 1; i < captions.length; i++) {
    const prev = captions[i - 1];
    const curr = captions[i];
    const gap = curr.start - (prev.start + prev.duration);
    const mergedLength = current.text.length + curr.text.length + 1; // +1 for space

    // 判断是否合并
    if (gap < MERGE_GAP_THRESHOLD && mergedLength < MERGE_LENGTH_LIMIT) {
      // 合并到当前段
      current.text += ' ' + curr.text;
      current.end = curr.start + curr.duration;
      current.original_indices.push(i);
    } else {
      // 保存当前段，开始新段
      merged.push(current);
      current = {
        text: curr.text,
        start: curr.start,
        end: curr.start + curr.duration,
        original_indices: [i],
      };
    }
  }

  // 添加最后一段
  merged.push(current);

  return merged;
}

/**
 * 自然分段检测
 * 规则：时间间隔 ≥ 5 秒视为自然分段点，添加段落标记
 */
function detectNaturalSegments(captions) {
  if (captions.length === 0) return [];

  const segments = [];
  let currentSegment = [];

  for (let i = 0; i < captions.length; i++) {
    currentSegment.push(captions[i]);

    // 检查是否到达自然分段点
    if (i < captions.length - 1) {
      const gap = captions[i + 1].start - captions[i].end;
      if (gap >= SEGMENT_GAP_THRESHOLD) {
        // 自然分段点：保存当前段落，开始新段落
        segments.push({
          type: 'segment',
          captions: currentSegment,
          start: currentSegment[0].start,
          end: currentSegment[currentSegment.length - 1].end,
        });
        currentSegment = [];
      }
    }
  }

  // 添加最后一个段落
  if (currentSegment.length > 0) {
    segments.push({
      type: 'segment',
      captions: currentSegment,
      start: currentSegment[0].start,
      end: currentSegment[currentSegment.length - 1].end,
    });
  }

  return segments;
}

/**
 * 正则表达式转义
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 获取分段的完整文本（连接所有字幕）
 * @param {Object} segment - 分段对象
 * @returns {string}
 */
export function getSegmentText(segment) {
  if (!segment || !segment.captions) return '';
  return segment.captions.map(c => c.text).join(' ');
}

/**
 * 统计预处理结果
 * @param {Array} original - 原始字幕数组
 * @param {Array} processed - 预处理后的分段数组
 * @returns {Object} 统计信息
 */
export function getPreprocessStats(original, processed) {
  const totalOriginalCaptions = original.length;
  const totalSegments = processed.length;
  const totalCaptions = processed.reduce((sum, seg) => sum + seg.captions.length, 0);
  const avgCaptionsPerSegment = totalCaptions / totalSegments;

  return {
    totalOriginalCaptions,
    totalSegments,
    totalCaptions,
    avgCaptionsPerSegment: avgCaptionsPerSegment.toFixed(1),
    compressionRatio: ((totalOriginalCaptions - totalCaptions) / totalOriginalCaptions * 100).toFixed(1) + '%',
  };
}
