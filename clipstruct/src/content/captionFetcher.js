/**
 * ClipStruct 字幕获取模块
 * 三层回退策略：Innertube API → ytplayer API → DOM 实时抓取
 */

/**
 * 字幕获取主函数（三层回退策略）
 * @param {string} videoId - YouTube 视频 ID
 * @returns {Promise<Array>} 字幕数组 [{ text, start, duration }, ...]
 */
export async function fetchCaptions(videoId) {
  if (!videoId) throw new Error('缺少视频 ID');

  try {
    // 第一层：Innertube API（优先）
    console.log('[ClipStruct] 尝试 Innertube API 获取字幕...');
    const captions = await fetchViaInnertube(videoId);
    if (captions && captions.length > 0) {
      console.log(`[ClipStruct] Innertube API 成功，获取 ${captions.length} 条字幕`);
      return captions;
    }
  } catch (err) {
    console.warn('[ClipStruct] Innertube API 失败:', err.message);
  }

  try {
    // 第二层：ytplayer API（备选）
    console.log('[ClipStruct] 尝试 ytplayer API 获取字幕...');
    const captions = await fetchViaYtplayer(videoId);
    if (captions && captions.length > 0) {
      console.log(`[ClipStruct] ytplayer API 成功，获取 ${captions.length} 条字幕`);
      return captions;
    }
  } catch (err) {
    console.warn('[ClipStruct] ytplayer API 失败:', err.message);
  }

  try {
    // 第三层：DOM 实时抓取（兜底）
    console.log('[ClipStruct] 尝试 DOM 实时抓取字幕...');
    const captions = await fetchViaDom();
    if (captions && captions.length > 0) {
      console.log(`[ClipStruct] DOM 抓取成功，获取 ${captions.length} 条字幕`);
      return captions;
    }
  } catch (err) {
    console.warn('[ClipStruct] DOM 抓取失败:', err.message);
  }

  throw new Error('该视频未提供字幕，或所有获取方式均失败');
}

/**
 * 第一层：通过 Innertube API 获取字幕
 * 从 ytInitialPlayerResponse 中解析 captionTracks
 */
async function fetchViaInnertube(videoId) {
  // 从页面脚本中提取 ytInitialPlayerResponse
  const playerResponse = extractYtInitialPlayerResponse();
  if (!playerResponse) throw new Error('未找到 ytInitialPlayerResponse');

  // 解析字幕轨道列表
  const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!captionTracks || captionTracks.length === 0) {
    throw new Error('视频无可用字幕轨道');
  }

  // 语言优先级：中文 → 英文 → 第一个可用
  const track = selectCaptionTrack(captionTracks);
  if (!track || !track.baseUrl) throw new Error('无法选择字幕轨道');

  console.log(`[ClipStruct] 选中字幕语言: ${track.languageCode} (${track.name?.simpleText || ''})`);

  // 请求字幕数据（JSON3 格式）
  const captionUrl = track.baseUrl + '&fmt=json3';
  const response = await fetch(captionUrl);
  if (!response.ok) throw new Error(`字幕请求失败: ${response.status}`);

  const data = await response.json();
  
  // 解析 JSON3 格式字幕
  return parseJson3Captions(data);
}

/**
 * 第二层：通过 ytplayer API 获取字幕
 * 从 ytplayer.config.args 中提取字幕配置
 */
async function fetchViaYtplayer(videoId) {
  // 尝试从全局对象中获取 ytplayer 配置
  const ytplayer = window.ytplayer;
  if (!ytplayer?.config?.args) throw new Error('未找到 ytplayer.config.args');

  const captionTracks = ytplayer.config.args.player_response?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!captionTracks || captionTracks.length === 0) {
    throw new Error('ytplayer 中无可用字幕轨道');
  }

  // 语言优先级选择
  const track = selectCaptionTrack(captionTracks);
  if (!track || !track.baseUrl) throw new Error('无法选择字幕轨道');

  console.log(`[ClipStruct] ytplayer 选中字幕语言: ${track.languageCode}`);

  // 请求字幕数据
  const captionUrl = track.baseUrl + '&fmt=json3';
  const response = await fetch(captionUrl);
  if (!response.ok) throw new Error(`字幕请求失败: ${response.status}`);

  const data = await response.json();
  return parseJson3Captions(data);
}

/**
 * 第三层：DOM 实时抓取字幕
 * 监听页面字幕 DOM 节点变化，实时采集字幕文本与时间戳
 * 注意：此方法需要用户开启字幕，且只能获取播放过的字幕
 */
async function fetchViaDom() {
  return new Promise((resolve, reject) => {
    const captionContainer = document.querySelector('.ytp-caption-window-container');
    if (!captionContainer) {
      return reject(new Error('未找到字幕容器，请确保已开启字幕'));
    }

    const captions = [];
    const captionMap = new Map(); // 用于去重
    let lastCaptionTime = 0;

    // 获取视频元素
    const video = document.querySelector('video');
    if (!video) return reject(new Error('未找到视频元素'));

    // 监听字幕变化
    const observer = new MutationObserver(() => {
      const captionElement = captionContainer.querySelector('.captions-text .ytp-caption-segment');
      if (captionElement && captionElement.textContent) {
        const text = captionElement.textContent.trim();
        const currentTime = video.currentTime;

        // 去重：相同文本且时间接近不重复添加
        if (text && !captionMap.has(text)) {
          captionMap.set(text, true);
          captions.push({
            text,
            start: currentTime,
            duration: 0, // DOM 方法无法精确获取持续时间
          });
          lastCaptionTime = currentTime;
        }
      }
    });

    observer.observe(captionContainer, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // 超时机制：5秒内未获取到字幕则失败
    setTimeout(() => {
      observer.disconnect();
      if (captions.length === 0) {
        reject(new Error('DOM 抓取超时，未获取到字幕'));
      } else {
        resolve(captions);
      }
    }, 5000);

    // 提示用户播放视频
    console.log('[ClipStruct] DOM 模式：请播放视频以采集字幕...');
  });
}

/**
 * 从页面脚本中提取 ytInitialPlayerResponse
 */
function extractYtInitialPlayerResponse() {
  try {
    // 方法1：从 window 对象中直接获取
    if (window.ytInitialPlayerResponse) {
      return window.ytInitialPlayerResponse;
    }

    // 方法2：从页面 <script> 标签中解析
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const content = script.textContent;
      if (content.includes('ytInitialPlayerResponse')) {
        const match = content.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
        if (match && match[1]) {
          return JSON.parse(match[1]);
        }
      }
    }

    return null;
  } catch (err) {
    console.error('[ClipStruct] 提取 ytInitialPlayerResponse 失败:', err);
    return null;
  }
}

/**
 * 语言优先级选择字幕轨道
 * 优先级：中文（zh、zh-Hans、zh-CN）→ 英文（en）→ 第一个可用
 */
function selectCaptionTrack(tracks) {
  if (!tracks || tracks.length === 0) return null;

  // 优先选择中文
  const zhTrack = tracks.find(t => 
    t.languageCode === 'zh' || 
    t.languageCode === 'zh-Hans' || 
    t.languageCode === 'zh-CN' ||
    t.languageCode === 'zh-Hant' ||
    t.languageCode === 'zh-TW'
  );
  if (zhTrack) return zhTrack;

  // 其次选择英文
  const enTrack = tracks.find(t => t.languageCode === 'en' || t.languageCode.startsWith('en-'));
  if (enTrack) return enTrack;

  // 最后返回第一个可用
  return tracks[0];
}

/**
 * 解析 JSON3 格式字幕数据
 * @param {Object} data - YouTube JSON3 字幕数据
 * @returns {Array} 标准化字幕数组
 */
function parseJson3Captions(data) {
  const events = data?.events || [];
  const captions = [];

  for (const event of events) {
    // 过滤掉空事件和无文本事件
    if (!event.segs || event.segs.length === 0) continue;

    const text = event.segs.map(seg => seg.utf8 || '').join('').trim();
    if (!text) continue;

    captions.push({
      text,
      start: (event.tStartMs || 0) / 1000, // 毫秒转秒
      duration: (event.dDurationMs || 0) / 1000,
    });
  }

  return captions;
}

/**
 * 检测视频是否有字幕（快速检测，不实际获取）
 * @returns {boolean}
 */
export function hasCaptions() {
  try {
    const playerResponse = extractYtInitialPlayerResponse();
    const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    return captionTracks && captionTracks.length > 0;
  } catch {
    return false;
  }
}
