// Background Script for ClipStruct Extension

// 监听来自 Content Script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

  switch (message.action) {
    case 'saveStructure':
      // 保存结构分析结果
      saveStructure(message.data).then(() => {
        sendResponse({ success: true, message: '结构已保存' });
      }).catch((error) => {
        console.error('Error saving structure:', error);
        sendResponse({ success: false, message: '保存失败' });
      });
      return true; // 异步响应

    case 'loadStructure':
      // 加载结构分析结果
      loadStructure(message.videoId).then((data) => {
        sendResponse({ success: true, data });
      }).catch((error) => {
        console.error('Error loading structure:', error);
        sendResponse({ success: false, message: '加载失败' });
      });
      return true; // 异步响应

    case 'getHistory':
      // 获取分析历史
      getHistory().then((history) => {
        sendResponse({ success: true, history });
      }).catch((error) => {
        console.error('Error getting history:', error);
        sendResponse({ success: false, message: '获取历史失败' });
      });
      return true; // 异步响应

    case 'clearHistory':
      // 清除分析历史
      clearHistory().then(() => {
        sendResponse({ success: true, message: '历史已清除' });
      }).catch((error) => {
        console.error('Error clearing history:', error);
        sendResponse({ success: false, message: '清除历史失败' });
      });
      return true; // 异步响应

    default:
      console.warn('Unknown message action:', message.action);
      sendResponse({ success: false, message: '未知操作' });
  }
});

// 保存结构分析结果
async function saveStructure(data) {
  try {
    const { videoId, segments } = data;
    if (!videoId || !segments) {
      throw new Error('Missing required data');
    }

    // 保存到本地存储
    await chrome.storage.local.set({
      [`structure_${videoId}`]: {
        segments,
        timestamp: Date.now(),
        videoId
      }
    });

    // 更新历史记录
    await updateHistory(videoId);

    console.log('Structure saved successfully for video:', videoId);
  } catch (error) {
    console.error('Error in saveStructure:', error);
    throw error;
  }
}

// 加载结构分析结果
async function loadStructure(videoId) {
  try {
    const result = await chrome.storage.local.get(`structure_${videoId}`);
    return result[`structure_${videoId}`];
  } catch (error) {
    console.error('Error in loadStructure:', error);
    throw error;
  }
}

// 更新历史记录
async function updateHistory(videoId) {
  try {
    // 获取现有历史
    const result = await chrome.storage.local.get('analysisHistory');
    let history = result.analysisHistory || [];

    // 移除已存在的记录
    history = history.filter(item => item.videoId !== videoId);

    // 添加新记录到开头
    history.unshift({
      videoId,
      timestamp: Date.now()
    });

    // 限制历史记录数量
    if (history.length > 50) {
      history = history.slice(0, 50);
    }

    // 保存更新后的历史
    await chrome.storage.local.set({ analysisHistory: history });
  } catch (error) {
    console.error('Error in updateHistory:', error);
    throw error;
  }
}

// 获取分析历史
async function getHistory() {
  try {
    const result = await chrome.storage.local.get('analysisHistory');
    return result.analysisHistory || [];
  } catch (error) {
    console.error('Error in getHistory:', error);
    throw error;
  }
}

// 清除分析历史
async function clearHistory() {
  try {
    await chrome.storage.local.set({ analysisHistory: [] });
  } catch (error) {
    console.error('Error in clearHistory:', error);
    throw error;
  }
}

// 监听扩展安装或更新
chrome.runtime.onInstalled.addListener((details) => {
  console.log('ClipStruct extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // 首次安装，初始化存储
    chrome.storage.local.set({
      analysisHistory: [],
      settings: {
        autoAnalyze: true,
        showCaptions: true
      }
    });
  }
});

// 监听标签页更新，用于检测视频页面加载
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com/watch')) {
    console.log('YouTube video page loaded:', tab.url);
    // 可以在这里发送消息给 Content Script，触发分析
  }
});
