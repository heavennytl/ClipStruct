/**
 * ClipStruct 共享工具函数
 */

import { SEGMENT_COLORS, DEFAULT_SEGMENT_COLOR, DATA_EXPIRY_DAYS } from './constants.js';

/**
 * 格式化秒数为 mm:ss 格式
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时间字符串
 */
export function formatTime(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 解析 mm:ss 格式为秒数
 * @param {string} timeStr - 时间字符串，格式 mm:ss
 * @returns {number} 秒数，解析失败返回 0
 */
export function parseTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  const mins = parseInt(parts[0], 10);
  const secs = parseInt(parts[1], 10);
  if (isNaN(mins) || isNaN(secs)) return 0;
  return mins * 60 + secs;
}

/**
 * 获取当前页面的 YouTube 视频 ID
 * @returns {string|null} 视频 ID，非视频页返回 null
 */
export function getVideoId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('v') || null;
}

/**
 * 获取结构段对应的颜色
 * @param {string} type - 结构类型键名
 * @returns {string} 颜色值
 */
export function getSegmentColor(type) {
  return SEGMENT_COLORS[type] || DEFAULT_SEGMENT_COLOR;
}

/**
 * 检查时间戳是否已过期
 * @param {number} timestamp - 毫秒时间戳
 * @returns {boolean} 是否已过期
 */
export function isExpired(timestamp) {
  if (!timestamp) return true;
  const expiryMs = DATA_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - timestamp > expiryMs;
}

/**
 * 节流函数
 * @param {Function} fn - 要节流的函数
 * @param {number} delay - 节流间隔（毫秒）
 * @returns {Function} 节流后的函数
 */
export function throttle(fn, delay) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return fn.apply(this, args);
    }
  };
}
