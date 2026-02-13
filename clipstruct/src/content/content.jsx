/**
 * ClipStruct Content Script 入口
 * 注入 YouTube 页面，渲染结构分析面板
 */
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import './content.css';
import { fetchCaptions, hasCaptions } from './captionFetcher.js';
import { preprocessCaptions, getSegmentText, getPreprocessStats } from './textPreprocessor.js';
import { analyzeStructure, getStructureStats, getVideoDuration } from './structureAnalyzer.js';
import { getVideoId, throttle } from '../common/utils.js';
import { ANALYSIS_PHASES, SEGMENT_TYPE_LABELS, STORAGE_KEYS } from '../common/constants.js';
import { getSegmentColor } from '../common/utils.js';
import Timeline from './Timeline.jsx';
import StructureList from './StructureList.jsx';
import EditModal from './EditModal.jsx';
import { exportToMarkdown, exportToText, downloadFile, generateFilename } from './exporter.js';

/**
 * 主应用组件
 */
function ClipStructApp() {
  const [videoId, setVideoId] = useState(null);
  const [phase, setPhase] = useState(ANALYSIS_PHASES.IDLE);
  const [error, setError] = useState(null);
  const [captions, setCaptions] = useState(null);
  const [segments, setSegments] = useState(null);
  const [preprocessStats, setPreprocessStats] = useState(null);
  const [structureSegments, setStructureSegments] = useState(null);
  const [structureStats, setStructureStats] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [editingSegment, setEditingSegment] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  // 使用 ref 追踪上次的视频 ID（避免闭包问题）
  const lastVideoIdRef = useRef(null);
  const videoRef = useRef(null);

  // 检测视频切换（YouTube SPA 导航）
  useEffect(() => {
    const checkVideoChange = () => {
      const currentVideoId = getVideoId();
      if (currentVideoId && currentVideoId !== lastVideoIdRef.current) {
        console.log(`[ClipStruct] 检测到视频切换: ${lastVideoIdRef.current} → ${currentVideoId}`);
        lastVideoIdRef.current = currentVideoId;
        setVideoId(currentVideoId);
        // 重置状态
        setPhase(ANALYSIS_PHASES.IDLE);
        setError(null);
        setCaptions(null);
        setSegments(null);
        setPreprocessStats(null);
        setStructureSegments(null);
        setStructureStats(null);
      }
    };

    // 初始检测
    checkVideoChange();

    // 监听 YouTube SPA 导航事件
    window.addEventListener('yt-navigate-finish', checkVideoChange);

    // 兜底：定时检测（防止事件未触发）
    const interval = setInterval(checkVideoChange, 2000);

    return () => {
      window.removeEventListener('yt-navigate-finish', checkVideoChange);
      clearInterval(interval);
    };
  }, []);

  // 自动分析
  useEffect(() => {
    if (videoId && phase === ANALYSIS_PHASES.IDLE) {
      analyzeCaptions();
    }
  }, [videoId]);

  // 视频播放同步
  useEffect(() => {
    const video = document.querySelector('video');
    if (!video) return;

    videoRef.current = video;

    // 节流更新当前时间（避免过于频繁更新）
    const handleTimeUpdate = throttle(() => {
      setCurrentTime(video.currentTime);
    }, 500); // 每500ms更新一次

    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, []);

  /**
   * 分析字幕
   */
  const analyzeCaptions = async () => {
    setError(null);
    
    try {
      // 先尝试从本地加载
      const saved = await loadFromStorage(videoId);
      if (saved) {
        console.log('[ClipStruct] 从本地加载已保存的结构');
        setCaptions(saved.captions || null);
        setSegments(saved.segments || null);
        setPreprocessStats(saved.preprocessStats || null);
        setStructureSegments(saved.structureSegments);
        setStructureStats(getStructureStats(saved.structureSegments));
        setPhase(ANALYSIS_PHASES.DONE);
        showSaveMessage('已加载保存的分析结果', 'info');
        return;
      }

      // 阶段1：检查字幕
      setPhase(ANALYSIS_PHASES.CHECKING);
      const hasCaption = hasCaptions();
      if (!hasCaption) {
        throw new Error('该视频未提供字幕，无法分析结构');
      }

      // 阶段2：获取字幕
      setPhase(ANALYSIS_PHASES.FETCHING);
      const rawCaptions = await fetchCaptions(videoId);
      setCaptions(rawCaptions);
      console.log(`[ClipStruct] 获取到 ${rawCaptions.length} 条字幕`);

      // 阶段3：预处理
      setPhase(ANALYSIS_PHASES.ANALYZING);
      const processedSegments = preprocessCaptions(rawCaptions);
      setSegments(processedSegments);

      // 计算预处理统计信息
      const preprocStats = getPreprocessStats(rawCaptions, processedSegments);
      setPreprocessStats(preprocStats);
      console.log('[ClipStruct] 预处理统计:', preprocStats);

      // 阶段4：结构分析
      const videoDuration = getVideoDuration();
      const structure = analyzeStructure(processedSegments, videoDuration);
      setStructureSegments(structure);

      // 计算结构统计信息
      const structStats = getStructureStats(structure);
      setStructureStats(structStats);
      console.log('[ClipStruct] 结构统计:', structStats);

      // 完成
      setPhase(ANALYSIS_PHASES.DONE);
      console.log('[ClipStruct] 结构分析完成');

      // 自动保存到本地
      await saveToStorage(videoId, {
        captions: rawCaptions,
        segments: processedSegments,
        preprocessStats: preprocStats,
        structureSegments: structure,
      });

    } catch (err) {
      console.error('[ClipStruct] 分析失败:', err);
      setError(err.message);
      setPhase(ANALYSIS_PHASES.ERROR);
    }
  };

  // 切换折叠状态
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // 跳转到指定时间
  const seekToTime = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  // 点击段落跳转
  const handleSegmentClick = (segment) => {
    seekToTime(segment.start);
  };

  // 编辑段落
  const handleEditSegment = (segment) => {
    setEditingSegment(segment);
  };

  // 保存编辑
  const handleSaveEdit = async (updatedSegment) => {
    // 更新段落列表
    const updatedSegments = structureSegments.map(seg =>
      seg.start === editingSegment.start && seg.end === editingSegment.end
        ? updatedSegment
        : seg
    );
    
    setStructureSegments(updatedSegments);
    setStructureStats(getStructureStats(updatedSegments));
    setEditingSegment(null);

    // 保存到本地
    await saveToStorage(videoId, {
      captions,
      segments,
      preprocessStats,
      structureSegments: updatedSegments,
    });

    showSaveMessage('修改已保存', 'success');
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingSegment(null);
  };

  // 导出为 Markdown
  const handleExportMarkdown = () => {
    const data = prepareExportData();
    const content = exportToMarkdown(data);
    const filename = generateFilename(data.videoTitle, 'md');
    downloadFile(content, filename, 'text/markdown');
    showSaveMessage('已导出 Markdown 文件', 'success');
  };

  // 导出为纯文本
  const handleExportText = () => {
    const data = prepareExportData();
    const content = exportToText(data);
    const filename = generateFilename(data.videoTitle, 'txt');
    downloadFile(content, filename, 'text/plain');
    showSaveMessage('已导出文本文件', 'success');
  };

  // 准备导出数据
  const prepareExportData = () => {
    return {
      videoId,
      videoTitle: document.querySelector('h1.ytd-watch-metadata')?.textContent || videoId,
      videoUrl: window.location.href,
      segments: structureSegments,
      analysisTime: new Date().toISOString(),
    };
  };

  // 保存到本地存储
  const saveToStorage = async (vid, data) => {
    try {
      setIsSaving(true);
      const videoTitle = document.querySelector('h1.ytd-watch-metadata')?.textContent || vid;
      const storageData = {
        videoId: vid,
        videoTitle,
        videoUrl: window.location.href,
        analysisTime: new Date().toISOString(),
        timestamp: Date.now(),
        ...data,
      };

      // 保存结构数据
      await chrome.runtime.sendMessage({
        action: 'saveStructure',
        data: storageData,
      });

      console.log('[ClipStruct] 结构已保存到本地');
    } catch (err) {
      console.error('[ClipStruct] 保存失败:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // 从本地存储加载
  const loadFromStorage = async (vid) => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'loadStructure',
        videoId: vid,
      });

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('[ClipStruct] 加载失败:', err);
      return null;
    }
  };

  // 显示保存消息
  const showSaveMessage = (message, type = 'success') => {
    setSaveMessage({ message, type });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  return (
    <div className={`clipstruct-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="clipstruct-header">
        <h3>ClipStruct</h3>
        <button 
          className="clipstruct-toggle" 
          onClick={toggleCollapse}
          title={isCollapsed ? '展开' : '折叠'}
        >
          {isCollapsed ? '▲' : '▼'}
        </button>
      </div>

      {!isCollapsed && (
        <div className="clipstruct-content">
          {/* 状态显示 */}
          {phase === ANALYSIS_PHASES.IDLE && (
            <p className="clipstruct-placeholder">等待分析...</p>
          )}

          {phase === ANALYSIS_PHASES.CHECKING && (
            <p className="clipstruct-status">🔍 检查字幕可用性...</p>
          )}

          {phase === ANALYSIS_PHASES.FETCHING && (
            <p className="clipstruct-status">📥 正在获取字幕...</p>
          )}

          {phase === ANALYSIS_PHASES.ANALYZING && (
            <p className="clipstruct-status">⚙️ 正在预处理字幕...</p>
          )}

          {phase === ANALYSIS_PHASES.ERROR && error && (
            <div className="clipstruct-error">
              <p className="error-icon">⚠️</p>
              <p className="error-message">{error}</p>
              <button className="retry-button" onClick={analyzeCaptions}>
                重试
              </button>
            </div>
          )}

          {phase === ANALYSIS_PHASES.DONE && structureSegments && (
            <div className="clipstruct-result">
              <div className="result-header">
                <span className="result-icon">✅</span>
                <span className="result-title">结构分析完成</span>
              </div>

              {/* 工具栏 */}
              <div className="toolbar">
                <button
                  className="toolbar-btn"
                  onClick={handleExportMarkdown}
                  title="导出为 Markdown 格式"
                >
                  📄 导出 MD
                </button>
                <button
                  className="toolbar-btn"
                  onClick={handleExportText}
                  title="导出为纯文本格式"
                >
                  📝 导出 TXT
                </button>
                {isSaving && <span className="toolbar-saving">保存中...</span>}
              </div>

              {/* 保存消息提示 */}
              {saveMessage && (
                <div className={`save-message save-message-${saveMessage.type}`}>
                  {saveMessage.message}
                </div>
              )}

              {/* 时间轴可视化 */}
              <Timeline
                segments={structureSegments}
                currentTime={currentTime}
                onSegmentClick={handleSegmentClick}
              />
              
              {/* 预处理统计信息（可折叠） */}
              <details className="stats-section collapsible">
                <summary className="stats-title">📊 预处理统计</summary>
                {preprocessStats && (
                  <>
                    <div className="stat-item">
                      <span className="stat-label">原始字幕：</span>
                      <span className="stat-value">{preprocessStats.totalOriginalCaptions} 条</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">预处理后：</span>
                      <span className="stat-value">{preprocessStats.totalCaptions} 条</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">自然分段：</span>
                      <span className="stat-value">{preprocessStats.totalSegments} 段</span>
                    </div>
                  </>
                )}
              </details>

              {/* 结构统计信息（可折叠） */}
              <details className="stats-section collapsible">
                <summary className="stats-title">🏗️ 结构统计</summary>
                {structureStats && (
                  <>
                    <div className="stat-item">
                      <span className="stat-label">总段落：</span>
                      <span className="stat-value">{structureStats.total} 段</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">总时长：</span>
                      <span className="stat-value">{formatTime(structureStats.totalDuration)}</span>
                    </div>
                    {Object.keys(structureStats.types).map(type => (
                      <div key={type} className="stat-item stat-item-type">
                        <span className="stat-label">
                          <span 
                            className="type-badge" 
                            style={{ backgroundColor: getSegmentColor(type) }}
                          ></span>
                          {SEGMENT_TYPE_LABELS[type]}：
                        </span>
                        <span className="stat-value">
                          {structureStats.types[type].count} 段 ({structureStats.types[type].percentage}%)
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </details>

              {/* 结构段落列表 */}
              <StructureList
                segments={structureSegments}
                currentTime={currentTime}
                onSegmentClick={handleSegmentClick}
                onEditSegment={handleEditSegment}
              />

              <p className="next-step-hint">
                💡 提示：点击段落右上角的编辑按钮可修改结构类型和意图
              </p>
            </div>
          )}

          {/* 编辑模态框 */}
          {editingSegment && (
            <EditModal
              segment={editingSegment}
              onSave={handleSaveEdit}
              onCancel={handleCancelEdit}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 格式化时间（秒 → mm:ss）
 */
function formatTime(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 挂载 React 根组件
function mount() {
  // 避免重复挂载
  if (document.getElementById('clipstruct-root')) return;

  const root = document.createElement('div');
  root.id = 'clipstruct-root';
  document.body.appendChild(root);

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ClipStructApp />
    </React.StrictMode>
  );
}

mount();
