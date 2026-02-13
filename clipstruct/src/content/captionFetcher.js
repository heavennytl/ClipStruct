/**
 * ClipStruct 字幕获取模块
 * 策略：
 *   1. 通过 Background Script 调用 chrome.scripting.executeScript（页面主世界），最可靠
 *   2. DOM 实时抓取兜底（需要用户播放视频且开启字幕）
 */

// ===== 字幕获取主流程 =====

/**
 * 字幕获取主函数
 * @param {string} videoId - YouTube 视频 ID
 * @returns {Promise<Array>} 字幕数组 [{ text, start, duration }, ...]
 */
export async function fetchCaptions(videoId) {
  if (!videoId) throw new Error('缺少视频 ID');

  // 第一层：通过 Background Script + chrome.scripting.executeScript（页面主世界）
  try {
    console.log('[ClipStruct] 通过页面主世界获取字幕...');
    const response = await chrome.runtime.sendMessage({
      action: 'fetchCaptionData',
      videoId,
    });

    if (response?.success && response.data?.text) {
      const { text, format, lang, langName } = response.data;
      console.log(`[ClipStruct] ✅ 字幕获取成功: ${lang} (${langName}), 格式: ${format}, ${text.length} 字符`);

      let captions;
      if (format === 'json3') captions = parseJson3Captions(JSON.parse(text));
      else if (format === 'srv1') captions = parseSrv1Captions(text);
      else if (format === 'vtt') captions = parseVttCaptions(text);

      if (captions?.length > 0) return captions;
      throw new Error('字幕解析后为空');
    }

    throw new Error(response?.error || '获取失败');
  } catch (err) {
    console.warn('[ClipStruct] 主世界获取失败:', err.message);
  }

  // 第二层：DOM 实时抓取（兜底）
  try {
    console.log('[ClipStruct] 尝试 DOM 实时抓取...');
    const captions = await fetchViaDom();
    if (captions?.length > 0) {
      console.log(`[ClipStruct] ✅ DOM 抓取成功，${captions.length} 条字幕`);
      return captions;
    }
  } catch (err) {
    console.warn('[ClipStruct] DOM 抓取失败:', err.message);
  }

  throw new Error('该视频无可用字幕，或所有获取方式均失败');
}

// ===== DOM 实时抓取（兜底方案）=====

/**
 * DOM 空闲超时（毫秒）：连续 30 秒无新字幕视为采集完成
 * 视频中常有音乐、过渡、画面展示等无语音段落，3 秒太短会误判
 */
const DOM_IDLE_TIMEOUT = 30000;

/**
 * DOM 实时抓取字幕
 * 通过 MutationObserver 监听字幕容器变化
 */
async function fetchViaDom() {
  return new Promise((resolve, reject) => {
    const container = document.querySelector('.ytp-caption-window-container');
    if (!container) return reject(new Error('未找到字幕容器，请确保已开启字幕'));

    const video = document.querySelector('video');
    if (!video) return reject(new Error('未找到视频元素'));

    const captions = [];
    const seen = new Map();
    let idleTimer = null;
    let absTimer = null;

    /** 完成采集 */
    const finish = (reason) => {
      observer.disconnect();
      video.removeEventListener('ended', onEnded);
      if (idleTimer) clearTimeout(idleTimer);
      if (absTimer) clearTimeout(absTimer);

      if (captions.length === 0) {
        reject(new Error(`DOM: 未获取到字幕（${reason}）`));
      } else {
        console.log(`[ClipStruct] DOM 完成（${reason}），${captions.length} 条`);
        resolve(captions);
      }
    };

    /** 重置空闲计时器 */
    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(
        () => finish(`${DOM_IDLE_TIMEOUT / 1000}秒无新字幕`),
        DOM_IDLE_TIMEOUT,
      );
    };

    /** 视频播放结束时立即完成 */
    const onEnded = () => finish('视频播放结束');
    video.addEventListener('ended', onEnded);

    /** 监听字幕 DOM 变化 */
    const observer = new MutationObserver(() => {
      const el = container.querySelector('.captions-text .ytp-caption-segment');
      if (el?.textContent) {
        const text = el.textContent.trim();
        if (text && !seen.has(text)) {
          seen.set(text, true);
          captions.push({ text, start: video.currentTime, duration: 0 });
          resetIdle();
        }
      }
    });

    observer.observe(container, { childList: true, subtree: true, characterData: true });

    // 绝对超时：视频时长 + 30 秒（默认 5 分钟）
    const dur = video.duration;
    const absMs = (dur && !isNaN(dur) && dur > 0) ? (dur + 30) * 1000 : 300000;
    absTimer = setTimeout(() => finish('绝对超时'), absMs);

    // 立即启动空闲计时器（若 30 秒内无任何字幕出现则快速失败）
    resetIdle();

    console.log(`[ClipStruct] DOM 模式：采集中（${DOM_IDLE_TIMEOUT / 1000}秒无新字幕后完成）...`);
  });
}

// ===== 多格式解析器 =====

/** 解析 json3 格式 */
function parseJson3Captions(data) {
  return (data?.events || [])
    .filter(e => e.segs?.length > 0)
    .map(e => ({
      text: e.segs.map(s => s.utf8 || '').join('').trim(),
      start: (e.tStartMs || 0) / 1000,
      duration: (e.dDurationMs || 0) / 1000,
    }))
    .filter(c => c.text);
}

/** 解析 srv1 (XML) 格式 */
function parseSrv1Captions(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const captions = [];
  doc.querySelectorAll('text').forEach(n => {
    const text = n.textContent.trim()
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    if (text) {
      captions.push({
        text,
        start: parseFloat(n.getAttribute('start') || '0'),
        duration: parseFloat(n.getAttribute('dur') || '0'),
      });
    }
  });
  return captions;
}

/** 解析 WebVTT 格式 */
function parseVttCaptions(vtt) {
  const captions = [];
  const lines = vtt.split('\n');
  let i = 0;

  // 跳过头部（直到第一个时间戳行）
  while (i < lines.length && !lines[i].includes('-->')) i++;

  while (i < lines.length) {
    const m = lines[i].trim().match(
      /(\d{2}:)?(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}:)?(\d{2}):(\d{2})\.(\d{3})/,
    );
    if (m) {
      const start = vttTime(m[1], m[2], m[3], m[4]);
      const end = vttTime(m[5], m[6], m[7], m[8]);
      i++;
      let text = '';
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
        text += (text ? ' ' : '') + lines[i].trim();
        i++;
      }
      if (text) {
        captions.push({
          text: text.replace(/<[^>]+>/g, ''),
          start,
          duration: end - start,
        });
      }
    }
    i++;
  }
  return captions;
}

/** VTT 时间戳转秒 */
function vttTime(h, m, s, ms) {
  return (h ? parseInt(h) : 0) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
}

/** 快速检测字幕可用性（不阻断流程） */
export function hasCaptions() {
  try {
    const scripts = document.querySelectorAll('script');
    for (const s of scripts) {
      if (s.textContent.includes('"captionTracks"')) return true;
    }
    return false;
  } catch { return false; }
}
