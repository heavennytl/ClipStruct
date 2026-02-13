/**
 * ClipStruct Background Script（Service Worker）
 * 负责消息传递、存储管理、跨域请求代理
 */

import { STORAGE_KEYS, DEFAULT_SETTINGS, MAX_HISTORY_ITEMS } from '../common/constants.js';
import { isExpired } from '../common/utils.js';

// 监听来自 Content Script / Popup 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action } = message;

  switch (action) {
    case 'saveStructure':
      handleSaveStructure(message.data)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, message: err.message }));
      return true; // 异步响应

    case 'loadStructure':
      handleLoadStructure(message.videoId)
        .then((data) => sendResponse({ success: true, data }))
        .catch((err) => sendResponse({ success: false, message: err.message }));
      return true;

    case 'getHistory':
      handleGetHistory()
        .then((history) => sendResponse({ success: true, history }))
        .catch((err) => sendResponse({ success: false, message: err.message }));
      return true;

    case 'clearHistory':
      handleClearHistory()
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, message: err.message }));
      return true;

    case 'getSettings':
      handleGetSettings()
        .then((settings) => sendResponse({ success: true, settings }))
        .catch((err) => sendResponse({ success: false, message: err.message }));
      return true;

    case 'saveSettings':
      handleSaveSettings(message.settings)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, message: err.message }));
      return true;

    default:
      sendResponse({ success: false, message: '未知操作' });
  }
});

/** 保存结构分析结果 */
async function handleSaveStructure(data) {
  const { videoId, segments, videoTitle, videoUrl } = data;
  if (!videoId || !segments) throw new Error('缺少必要数据');

  const key = STORAGE_KEYS.structure(videoId);
  await chrome.storage.local.set({
    [key]: {
      videoId,
      videoTitle: videoTitle || '',
      videoUrl: videoUrl || '',
      analysisTime: new Date().toISOString(),
      segments,
      timestamp: Date.now(),
    }
  });

  // 更新历史记录
  await updateHistory(videoId, videoTitle);
}

/** 加载结构分析结果（自动过期检查） */
async function handleLoadStructure(videoId) {
  if (!videoId) return null;
  const key = STORAGE_KEYS.structure(videoId);
  const result = await chrome.storage.local.get(key);
  const data = result[key];

  // 过期数据自动清理
  if (data && isExpired(data.timestamp)) {
    await chrome.storage.local.remove(key);
    return null;
  }
  return data || null;
}

/** 获取分析历史 */
async function handleGetHistory() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.history);
  return result[STORAGE_KEYS.history] || [];
}

/** 清除分析历史 */
async function handleClearHistory() {
  await chrome.storage.local.set({ [STORAGE_KEYS.history]: [] });
}

/** 获取设置 */
async function handleGetSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.settings] || {}) };
}

/** 保存设置 */
async function handleSaveSettings(settings) {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
}

/** 更新历史记录 */
async function updateHistory(videoId, videoTitle) {
  const result = await chrome.storage.local.get(STORAGE_KEYS.history);
  let history = result[STORAGE_KEYS.history] || [];

  // 去重：移除同一视频的旧记录
  history = history.filter(item => item.videoId !== videoId);

  // 新记录插入头部
  history.unshift({
    videoId,
    videoTitle: videoTitle || videoId,
    timestamp: Date.now(),
  });

  // 限制最大条数
  if (history.length > MAX_HISTORY_ITEMS) {
    history = history.slice(0, MAX_HISTORY_ITEMS);
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.history]: history });
}

// 扩展安装/更新时初始化
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      [STORAGE_KEYS.history]: [],
      [STORAGE_KEYS.settings]: DEFAULT_SETTINGS,
    });
  }
});
