import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './popup.css';

function PopupApp() {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState({
    autoAnalyze: true,
    showCaptions: true
  });

  // 加载分析历史
  const loadHistory = () => {
    setIsLoading(true);
    chrome.runtime.sendMessage(
      { action: 'getHistory' },
      (response) => {
        if (response && response.success) {
          setHistory(response.history);
        }
        setIsLoading(false);
      }
    );
  };

  // 清除分析历史
  const handleClearHistory = () => {
    if (window.confirm('确定要清除所有分析历史吗？')) {
      chrome.runtime.sendMessage(
        { action: 'clearHistory' },
        (response) => {
          if (response && response.success) {
            setHistory([]);
            alert('历史已清除');
          }
        }
      );
    }
  };

  // 处理设置变更
  const handleSettingChange = (key, value) => {
    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);
    // 保存设置到本地存储
    chrome.storage.local.set({ settings: updatedSettings });
  };

  // 加载设置
  const loadSettings = () => {
    chrome.storage.local.get('settings', (result) => {
      if (result.settings) {
        setSettings(result.settings);
      }
    });
  };

  // 格式化时间
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 打开视频页面
  const openVideo = (videoId) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    chrome.tabs.create({ url });
  };

  // 组件挂载时加载数据
  useEffect(() => {
    loadHistory();
    loadSettings();
  }, []);

  return (
    <div className="popup-container">
      <div className="popup-header">
        <h2>ClipStruct</h2>
        <p className="popup-subtitle">YouTube 视频结构拉片插件</p>
      </div>

      <div className="popup-content">
        {/* 设置部分 */}
        <section className="popup-section">
          <h3>设置</h3>
          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={settings.autoAnalyze}
                onChange={(e) => handleSettingChange('autoAnalyze', e.target.checked)}
              />
              自动分析视频结构
            </label>
          </div>
          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={settings.showCaptions}
                onChange={(e) => handleSettingChange('showCaptions', e.target.checked)}
              />
              显示视频字幕
            </label>
          </div>
        </section>

        {/* 分析历史部分 */}
        <section className="popup-section">
          <div className="section-header">
            <h3>分析历史</h3>
            {history.length > 0 && (
              <button className="clear-history-button" onClick={handleClearHistory}>
                清除历史
              </button>
            )}
          </div>
          
          {isLoading ? (
            <div className="loading">加载历史中...</div>
          ) : history.length > 0 ? (
            <div className="history-list">
              {history.slice(0, 10).map((item, index) => (
                <div key={index} className="history-item" onClick={() => openVideo(item.videoId)}>
                  <div className="history-video-id">{item.videoId}</div>
                  <div className="history-time">{formatDate(item.timestamp)}</div>
                </div>
              ))}
              {history.length > 10 && (
                <div className="history-more">... 共 {history.length} 条记录</div>
              )}
            </div>
          ) : (
            <div className="no-history">暂无分析历史</div>
          )}
        </section>

        {/* AI 设置预留部分 */}
        <section className="popup-section">
          <h3>AI 设置</h3>
          <div className="ai-setting-placeholder">
            <p>AI 辅助标注功能即将推出</p>
            <p>敬请期待！</p>
          </div>
        </section>
      </div>

      <div className="popup-footer">
        <p className="popup-version">版本 1.0.0</p>
      </div>
    </div>
  );
}

// 渲染应用
ReactDOM.createRoot(document.getElementById('popup-root')).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>
);
