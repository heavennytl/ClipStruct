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

    case 'fetchCaptionData':
      handleFetchCaptionData(message.videoId, sender.tab.id)
        .then((data) => sendResponse({ success: true, data }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
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

/**
 * 通过多种方法获取字幕数据
 * 方法1: chrome.scripting.executeScript 在页面主世界（正确的 origin + Innertube API）
 * 方法2: Service Worker 直接获取（独立于页面环境）
 */
async function handleFetchCaptionData(videoId, tabId) {
  let captionTracks = null;

  // === 步骤1: 页面主世界提取轨道并下载 ===
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (vid) => {
        /** 选择最佳字幕语言 */
        function selectTrack(tracks) {
          const zh = tracks.find(t =>
            ['zh', 'zh-Hans', 'zh-CN', 'zh-Hant', 'zh-TW'].includes(t.languageCode)
          );
          if (zh) return zh;
          const en = tracks.find(t =>
            t.languageCode === 'en' || t.languageCode.startsWith('en-')
          );
          return en || tracks[0];
        }

        /** 清理 baseUrl 并尝试下载（带诊断日志） */
        async function tryDownload(track) {
          // 移除 baseUrl 中已有的 fmt 参数，避免冲突
          let base = track.baseUrl.replace(/([?&])fmt=[^&]*/g, '').replace(/[?&]$/, '');
          const sep = base.includes('?') ? '&' : '?';

          for (const fmt of ['srv1', 'json3', 'vtt']) {
            try {
              const url = base + sep + 'fmt=' + fmt;
              const resp = await fetch(url, { cache: 'no-store' });
              const text = await resp.text();
              // 诊断日志（显示在浏览器控制台）
              console.log('[ClipStruct] fetch ' + fmt + ': status=' + resp.status + ', len=' + text.length);
              if (text && text.trim().length > 10) {
                return {
                  text, format: fmt,
                  lang: track.languageCode,
                  langName: track.name?.simpleText || '',
                };
              }
            } catch (e) {
              console.warn('[ClipStruct] fetch ' + fmt + ' error:', e.message);
            }
          }
          return null;
        }

        try {
          // 方法A: 读取当前页面的 ytInitialPlayerResponse
          let tracks = null;
          const pr = window.ytInitialPlayerResponse;
          if (pr && pr.videoDetails?.videoId === vid) {
            tracks = pr.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            if (tracks?.length) console.log('[ClipStruct] ytInitialPlayerResponse: ' + tracks.length + ' 个字幕轨道');
          }

          // 方法B: 通过 Innertube API 获取（更稳定，不依赖页面变量）
          if (!tracks?.length) {
            try {
              const apiKey = window.ytcfg?.data_?.INNERTUBE_API_KEY || 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
              const clientName = window.ytcfg?.data_?.INNERTUBE_CLIENT_NAME || 'WEB';
              const clientVersion = window.ytcfg?.data_?.INNERTUBE_CLIENT_VERSION || '2.20240101';
              console.log('[ClipStruct] 尝试 Innertube API, key=' + apiKey?.substring(0, 10) + '...');

              const resp = await fetch('/youtubei/v1/player?key=' + apiKey, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  videoId: vid,
                  context: {
                    client: { clientName: clientName, clientVersion: clientVersion },
                  },
                }),
                cache: 'no-store',
              });
              const data = await resp.json();
              tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
              if (tracks?.length) {
                console.log('[ClipStruct] Innertube API: ' + tracks.length + ' 个字幕轨道');
              } else {
                console.warn('[ClipStruct] Innertube API: 未返回字幕轨道');
              }
            } catch (e) {
              console.warn('[ClipStruct] Innertube API error:', e.message);
            }
          }

          if (!tracks?.length) return { error: 'noTracks' };

          const track = selectTrack(tracks);
          console.log('[ClipStruct] 选中: ' + track.languageCode + ' (' + (track.name?.simpleText || '') + ')');
          console.log('[ClipStruct] baseUrl: ' + track.baseUrl?.substring(0, 100) + '...');

          const result = await tryDownload(track);
          if (result) return result;

          // 下载失败，返回轨道信息供 Service Worker 使用
          return {
            error: 'downloadFailed',
            tracksInfo: tracks.map(t => ({
              baseUrl: t.baseUrl,
              languageCode: t.languageCode,
              name: t.name?.simpleText || '',
            })),
          };
        } catch (e) {
          return { error: e.message };
        }
      },
      args: [videoId],
    });

    const r = results?.[0]?.result;
    if (r && !r.error) return r;

    // 页面主世界下载失败但提取到了轨道信息 → 用 Service Worker 尝试
    if (r?.tracksInfo?.length) {
      captionTracks = r.tracksInfo;
      console.log('[ClipStruct BG] 页面主世界下载失败，用 SW 尝试，共', captionTracks.length, '个轨道');
    } else {
      console.warn('[ClipStruct BG] 页面主世界:', r?.error);
    }
  } catch (err) {
    console.warn('[ClipStruct BG] executeScript 异常:', err.message);
  }

  // === 步骤2: 如果无轨道信息，SW 自行获取页面 HTML 提取 ===
  if (!captionTracks?.length) {
    try {
      const pageResp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, { cache: 'no-store' });
      const html = await pageResp.text();
      const pr = extractPlayerResponseFromHtml(html);
      const tracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (tracks?.length) {
        captionTracks = tracks.map(t => ({
          baseUrl: t.baseUrl,
          languageCode: t.languageCode,
          name: t.name?.simpleText || '',
        }));
        console.log('[ClipStruct BG] SW 从页面 HTML 提取到', captionTracks.length, '个轨道');
      }
    } catch (err) {
      console.warn('[ClipStruct BG] SW 获取页面失败:', err.message);
    }
  }

  if (!captionTracks?.length) {
    throw new Error('该视频没有可用字幕');
  }

  // === 步骤3: Service Worker 直接下载字幕 ===
  const track = selectBestTrack(captionTracks);
  console.log(`[ClipStruct BG] SW 下载: ${track.languageCode} (${track.name})`);

  let base = track.baseUrl.replace(/([?&])fmt=[^&]*/g, '').replace(/[?&]$/, '');
  const sep = base.includes('?') ? '&' : '?';

  for (const fmt of ['srv1', 'json3', 'vtt']) {
    try {
      const resp = await fetch(base + sep + 'fmt=' + fmt, { cache: 'no-store' });
      const text = await resp.text();
      console.log(`[ClipStruct BG] SW ${fmt}: status=${resp.status}, len=${text.length}`);
      if (text && text.trim().length > 10) {
        return { text, format: fmt, lang: track.languageCode, langName: track.name };
      }
    } catch (e) {
      console.warn(`[ClipStruct BG] SW ${fmt}:`, e.message);
    }
  }

  throw new Error('字幕下载失败（页面主世界和 SW 均返回空）');
}

/** 从 HTML 中提取 ytInitialPlayerResponse（大括号计数法） */
function extractPlayerResponseFromHtml(html) {
  const marker = 'var ytInitialPlayerResponse = ';
  const idx = html.indexOf(marker);
  if (idx === -1) return null;

  const start = idx + marker.length;
  if (html[start] !== '{') return null;

  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (esc) { esc = false; continue; }
    if (c === '\\' && inStr) { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (!inStr) {
      if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        return JSON.parse(html.substring(start, i + 1));
      }
    }
  }
  return null;
}

/** 选择最佳字幕轨道：中文 → 英文 → 第一个 */
function selectBestTrack(tracks) {
  const zh = tracks.find(t =>
    ['zh', 'zh-Hans', 'zh-CN', 'zh-Hant', 'zh-TW'].includes(t.languageCode)
  );
  if (zh) return zh;
  const en = tracks.find(t =>
    t.languageCode === 'en' || t.languageCode.startsWith('en-')
  );
  return en || tracks[0];
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
