/**
 * ClipStruct Popup 页面
 * 插件设置、分析历史
 */
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './popup.css';
import { DEFAULT_SETTINGS } from '../common/constants.js';

function PopupApp() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('settings');
  const [saveMessage, setSaveMessage] = useState(null);

  // 加载设置和历史
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [settingsRes, historyRes] = await Promise.all([
        chrome.runtime.sendMessage({ action: 'getSettings' }),
        chrome.runtime.sendMessage({ action: 'getHistory' }),
      ]);

      if (settingsRes?.success) {
        setSettings(settingsRes.settings);
      }
      if (historyRes?.success) {
        setHistory(historyRes.history || []);
      }
    } catch (err) {
      console.error('加载数据失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 保存设置
  const handleSaveSettings = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings,
      });

      if (response?.success) {
        showMessage('设置已保存', 'success');
      } else {
        showMessage('保存失败', 'error');
      }
    } catch (err) {
      console.error('保存设置失败:', err);
      showMessage('保存失败', 'error');
    }
  };

  // 更新设置字段
  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // 清除历史
  const handleClearHistory = async () => {
    if (!confirm('确定要清除所有分析历史吗？')) return;

    try {
      const response = await chrome.runtime.sendMessage({ action: 'clearHistory' });
      if (response?.success) {
        setHistory([]);
        showMessage('历史记录已清除', 'success');
      }
    } catch (err) {
      console.error('清除历史失败:', err);
      showMessage('清除失败', 'error');
    }
  };

  // 跳转到视频
  const handleGoToVideo = (item) => {
    chrome.tabs.create({ url: item.videoUrl || `https://www.youtube.com/watch?v=${item.videoId}` });
  };

  // 显示消息
  const showMessage = (message, type) => {
    setSaveMessage({ message, type });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  if (isLoading) {
    return (
      <div className="popup-container">
        <div className="popup-header">
          <h2>ClipStruct</h2>
        </div>
        <div className="popup-loading">⏳ 加载中...</div>
      </div>
    );
  }

  return (
    <div className="popup-container">
      <div className="popup-header">
        <h2>ClipStruct</h2>
        <p className="popup-subtitle">YouTube 视频结构拉片插件</p>
      </div>

      {/* 标签切换 */}
      <div className="popup-tabs">
        <button
          className={`popup-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ 设置
        </button>
        <button
          className={`popup-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📋 历史
        </button>
        <button
          className={`popup-tab ${activeTab === 'about' ? 'active' : ''}`}
          onClick={() => setActiveTab('about')}
        >
          ℹ️ 关于
        </button>
      </div>

      {/* 消息提示 */}
      {saveMessage && (
        <div className={`popup-message popup-message-${saveMessage.type}`}>
          {saveMessage.message}
        </div>
      )}

      <div className="popup-content">
        {/* 设置标签 */}
        {activeTab === 'settings' && (
          <section className="popup-section">
            <h3>基础设置</h3>
            
            <div className="setting-item">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={settings.autoAnalyze}
                  onChange={(e) => updateSetting('autoAnalyze', e.target.checked)}
                />
                <span>自动分析视频</span>
              </label>
              <p className="setting-hint">打开视频页面时自动开始分析</p>
            </div>

            <h3>AI 设置（可选）</h3>

            <div className="setting-item">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={settings.aiEnabled}
                  onChange={(e) => updateSetting('aiEnabled', e.target.checked)}
                />
                <span>启用 AI 辅助分析</span>
              </label>
              <p className="setting-hint">使用 AI 提升结构识别准确度（需配置 API Key）</p>
            </div>

            {settings.aiEnabled && (
              <>
                <div className="setting-item">
                  <label className="setting-label">API Key</label>
                  <input
                    type="password"
                    className="setting-input"
                    value={settings.aiApiKey}
                    onChange={(e) => updateSetting('aiApiKey', e.target.value)}
                    placeholder="请输入 OpenAI API Key"
                  />
                  <p className="setting-hint">您的 API Key 仅保存在本地，不会上传到任何服务器</p>
                </div>

                <div className="setting-item">
                  <label className="setting-label">模型名称</label>
                  <input
                    type="text"
                    className="setting-input"
                    value={settings.aiModel}
                    onChange={(e) => updateSetting('aiModel', e.target.value)}
                    placeholder="gpt-4o-mini"
                  />
                  <p className="setting-hint">推荐使用 gpt-4o-mini（成本低、效果好）</p>
                </div>

                <div className="setting-item">
                  <label className="setting-label">API 端点</label>
                  <input
                    type="text"
                    className="setting-input"
                    value={settings.aiEndpoint}
                    onChange={(e) => updateSetting('aiEndpoint', e.target.value)}
                    placeholder="https://api.openai.com/v1/chat/completions"
                  />
                  <p className="setting-hint">支持兼容 OpenAI 接口的第三方服务</p>
                </div>
              </>
            )}

            <button className="popup-btn popup-btn-primary" onClick={handleSaveSettings}>
              💾 保存设置
            </button>
          </section>
        )}

        {/* 历史标签 */}
        {activeTab === 'history' && (
          <section className="popup-section">
            <div className="section-header">
              <h3>分析历史</h3>
              {history.length > 0 && (
                <button className="popup-btn-small" onClick={handleClearHistory}>
                  🗑️ 清除历史
                </button>
              )}
            </div>

            {history.length > 0 ? (
              <ul className="popup-history">
                {history.slice(0, 10).map((item, i) => (
                  <li
                    key={i}
                    className="popup-history-item"
                    onClick={() => handleGoToVideo(item)}
                  >
                    <div className="history-content">
                      <span className="history-title">{item.videoTitle || item.videoId}</span>
                      <span className="history-time">
                        {new Date(item.timestamp).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <span className="history-arrow">→</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="popup-placeholder">
                📭 暂无分析历史
                <br />
                <small>分析视频后会自动记录</small>
              </p>
            )}
          </section>
        )}

        {/* 关于标签 */}
        {activeTab === 'about' && (
          <section className="popup-section">
            <h3>关于 ClipStruct</h3>
            <div className="about-info">
              <p><strong>版本</strong>：v1.0.0</p>
              <p><strong>说明</strong>：YouTube 视频结构拉片插件</p>
              <p><strong>功能</strong>：
                <ul className="about-features">
                  <li>✅ 自动获取字幕</li>
                  <li>✅ 识别 7 种结构类型</li>
                  <li>✅ 时间轴可视化</li>
                  <li>✅ 手动编辑结构</li>
                  <li>✅ 导出 Markdown/文本</li>
                  <li>✅ 本地持久化</li>
                </ul>
              </p>
            </div>

            <div className="about-links">
              <h4>使用帮助</h4>
              <ul className="help-list">
                <li>1. 打开 YouTube 视频页面</li>
                <li>2. 等待右侧面板自动分析</li>
                <li>3. 查看结构时间轴和详情</li>
                <li>4. 点击段落跳转到对应时间</li>
                <li>5. 点击编辑按钮修改结构</li>
                <li>6. 点击导出按钮下载文档</li>
              </ul>
            </div>

            <div className="about-footer">
              <p className="about-copyright">© 2026 ClipStruct</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('popup-root')).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>
);
