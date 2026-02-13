/**
 * ClipStruct 导出模块
 * 导出结构分析结果为 Markdown 或纯文本格式
 */

import { SEGMENT_TYPE_SHORT_LABELS } from '../common/constants.js';
import { formatTime } from '../common/utils.js';

/**
 * 导出为 Markdown 格式
 * @param {Object} data - 视频结构数据
 * @returns {string} Markdown 文本
 */
export function exportToMarkdown(data) {
  const { videoTitle, videoUrl, segments, analysisTime } = data;
  
  let markdown = `# 视频结构分析\n\n`;
  markdown += `- **标题**：${videoTitle}\n`;
  markdown += `- **URL**：${videoUrl}\n`;
  markdown += `- **分析时间**：${new Date(analysisTime).toLocaleString('zh-CN')}\n\n`;

  // 结构时间轴
  markdown += `## 结构时间轴\n\n`;
  segments.forEach(seg => {
    const typeLabel = SEGMENT_TYPE_SHORT_LABELS[seg.type] || seg.type;
    markdown += `${formatTime(seg.start)}-${formatTime(seg.end)} | **${typeLabel}** | ${seg.intent}\n`;
  });

  // 结构概览
  markdown += `\n## 结构概览\n\n`;
  const typeStats = getTypeStats(segments);
  Object.keys(typeStats).forEach(type => {
    const typeLabel = SEGMENT_TYPE_SHORT_LABELS[type] || type;
    const stats = typeStats[type];
    markdown += `- **${typeLabel}**：${stats.count} 段，共 ${formatTime(stats.duration)}（${stats.percentage}%）\n`;
  });

  // 详细内容
  markdown += `\n## 详细内容\n\n`;
  segments.forEach((seg, i) => {
    const typeLabel = SEGMENT_TYPE_SHORT_LABELS[seg.type] || seg.type;
    markdown += `### ${i + 1}. ${typeLabel}（${formatTime(seg.start)}-${formatTime(seg.end)}）\n\n`;
    markdown += `**意图**：${seg.intent}\n\n`;
    markdown += `**内容**：${seg.text.substring(0, 200)}${seg.text.length > 200 ? '...' : ''}\n\n`;
  });

  markdown += `---\n\n`;
  markdown += `*本文档由 ClipStruct 自动生成*\n`;

  return markdown;
}

/**
 * 导出为纯文本格式
 * @param {Object} data - 视频结构数据
 * @returns {string} 纯文本
 */
export function exportToText(data) {
  const { videoTitle, videoUrl, segments, analysisTime } = data;
  
  let text = `视频结构分析\n`;
  text += `${'='.repeat(50)}\n\n`;
  text += `标题：${videoTitle}\n`;
  text += `URL：${videoUrl}\n`;
  text += `分析时间：${new Date(analysisTime).toLocaleString('zh-CN')}\n\n`;

  // 结构时间轴
  text += `结构时间轴\n`;
  text += `${'-'.repeat(50)}\n`;
  segments.forEach(seg => {
    const typeLabel = SEGMENT_TYPE_SHORT_LABELS[seg.type] || seg.type;
    text += `${formatTime(seg.start)}-${formatTime(seg.end)} | ${typeLabel} | ${seg.intent}\n`;
  });

  // 结构概览
  text += `\n结构概览\n`;
  text += `${'-'.repeat(50)}\n`;
  const typeStats = getTypeStats(segments);
  Object.keys(typeStats).forEach(type => {
    const typeLabel = SEGMENT_TYPE_SHORT_LABELS[type] || type;
    const stats = typeStats[type];
    text += `${typeLabel}：${stats.count} 段，共 ${formatTime(stats.duration)}（${stats.percentage}%）\n`;
  });

  // 详细内容
  text += `\n详细内容\n`;
  text += `${'-'.repeat(50)}\n`;
  segments.forEach((seg, i) => {
    const typeLabel = SEGMENT_TYPE_SHORT_LABELS[seg.type] || seg.type;
    text += `\n${i + 1}. ${typeLabel}（${formatTime(seg.start)}-${formatTime(seg.end)}）\n`;
    text += `意图：${seg.intent}\n`;
    text += `内容：${seg.text.substring(0, 200)}${seg.text.length > 200 ? '...' : ''}\n`;
  });

  text += `\n${'='.repeat(50)}\n`;
  text += `本文档由 ClipStruct 自动生成\n`;

  return text;
}

/**
 * 触发文件下载
 * @param {string} content - 文件内容
 * @param {string} filename - 文件名
 * @param {string} mimeType - MIME 类型
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 获取类型统计信息
 * @param {Array} segments - 结构段落数组
 * @returns {Object} 类型统计
 */
function getTypeStats(segments) {
  const stats = {};
  let totalDuration = 0;

  segments.forEach(seg => {
    if (!stats[seg.type]) {
      stats[seg.type] = { count: 0, duration: 0 };
    }
    stats[seg.type].count++;
    stats[seg.type].duration += seg.duration;
    totalDuration += seg.duration;
  });

  // 计算占比
  Object.keys(stats).forEach(type => {
    stats[type].percentage = ((stats[type].duration / totalDuration) * 100).toFixed(1);
  });

  return stats;
}

/**
 * 生成导出文件名
 * @param {string} videoTitle - 视频标题
 * @param {string} format - 格式（md 或 txt）
 * @returns {string} 文件名
 */
export function generateFilename(videoTitle, format = 'md') {
  // 清理标题中的非法字符
  const cleanTitle = videoTitle
    .replace(/[<>:"/\\|?*]/g, '_')
    .substring(0, 50);
  
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  return `ClipStruct_${cleanTitle}_${date}.${format}`;
}
