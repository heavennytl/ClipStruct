import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import './content.css';

// 主应用组件
function ClipStructApp() {
  const [captions, setCaptions] = useState([]);
  const [structuredSegments, setStructuredSegments] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editingSegmentId, setEditingSegmentId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [videoId, setVideoId] = useState('');
  // 采集阶段：便于在视频页明确展示「正在采集字幕」
  const [phase, setPhase] = useState('checking'); // checking | no_video | fetching | parsing | done

  // 获取视频 ID
  const getVideoId = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  };

  // 通过 YouTube Innertube API 获取字幕（当前页面主流方式，不依赖 ytplayer 全局变量）
  const fetchCaptionsFromInnertube = async (vid) => {
    if (!vid) return null;
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            client: { clientName: 'WEB', clientVersion: '2.20250101.00.00' }
          },
          videoId: vid
        })
      });
      const data = await res.json();
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!tracks?.length) return null;
      const track = tracks.find(t => (t.languageCode || '').startsWith('zh') || (t.languageCode || '').startsWith('en')) || tracks[0];
      const baseUrl = track?.baseUrl;
      if (!baseUrl) return null;
      const url = baseUrl.includes('fmt=') ? baseUrl : `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}fmt=json3`;
      const captionRes = await fetch(url, {
        headers: { 'User-Agent': navigator.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      const text = await captionRes.text();
      if (text.trim().startsWith('{')) return parseCaptionsJSON3(text);
      return parseCaptionsXML(text);
    } catch (err) {
      console.error('Innertube 字幕获取失败:', err);
      return null;
    }
  };

  // 解析 YouTube 字幕 JSON3 格式（fmt=json3）
  const parseCaptionsJSON3 = (jsonText) => {
    try {
      const data = JSON.parse(jsonText);
      const events = data?.events || [];
      const captions = [];
      for (const ev of events) {
        if (!ev.segs) continue;
        const text = (ev.segs || []).map(s => s.utf8 || '').join('').trim();
        if (!text) continue;
        captions.push({
          text,
          start: (ev.tStartMs || 0) / 1000,
          duration: (ev.dDurationMs || 0) / 1000
        });
      }
      return captions;
    } catch (e) {
      console.error('parseCaptionsJSON3 error:', e);
      return [];
    }
  };

  // 旧版：通过 ytplayer.config.captions 获取（部分页面可能仍存在）
  const fetchCaptionsFromAPI = async () => {
    try {
      await new Promise((resolve) => {
        const checkYTPlayer = setInterval(() => {
          if (window.ytplayer?.config?.captions) {
            clearInterval(checkYTPlayer);
            resolve();
          }
        }, 100);
        setTimeout(() => { clearInterval(checkYTPlayer); resolve(); }, 10000);
      });
      const captionsConfig = window.ytplayer?.config?.captions;
      const tracks = captionsConfig?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!tracks?.length) return null;
      const track = tracks.find(t => t.languageCode === 'zh' || t.languageCode === 'en') || tracks[0];
      if (!track?.baseUrl) return null;
      const response = await fetch(track.baseUrl);
      const xmlText = await response.text();
      return parseCaptionsXML(xmlText);
    } catch (err) {
      console.error('Error fetching captions from API:', err);
      return null;
    }
  };

  // 通过 DOM 解析获取字幕（备用方案）
  const fetchCaptionsFromDOM = async () => {
    try {
      // 等待字幕元素加载
      await new Promise((resolve) => {
        const checkCaptions = setInterval(() => {
          const captionElements = document.querySelectorAll('.ytp-caption-segment');
          if (captionElements.length > 0) {
            clearInterval(checkCaptions);
            resolve();
          }
        }, 100);
        
        // 5秒超时
        setTimeout(() => {
          clearInterval(checkCaptions);
          resolve();
        }, 5000);
      });

      // 注意：DOM 解析只能获取当前显示的字幕，不是完整字幕
      // 这里仅作为备用方案的框架
      const captionElements = document.querySelectorAll('.ytp-caption-segment');
      const domCaptions = Array.from(captionElements).map((el, index) => ({
        text: el.textContent.trim(),
        start: index * 5, // 模拟时间戳
        duration: 5
      }));

      return domCaptions.length > 0 ? domCaptions : null;
    } catch (err) {
      console.error('Error fetching captions from DOM:', err);
      return null;
    }
  };

  // 解析字幕 XML
  const parseCaptionsXML = (xmlText) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const textNodes = xmlDoc.getElementsByTagName('text');
    
    const parsedCaptions = [];
    for (let i = 0; i < textNodes.length; i++) {
      const node = textNodes[i];
      const start = parseFloat(node.getAttribute('start'));
      const duration = parseFloat(node.getAttribute('dur'));
      const text = node.textContent.trim();
      
      if (text) {
        parsedCaptions.push({
          text,
          start,
          duration
        });
      }
    }
    
    return parsedCaptions;
  };

  // 文本预处理：短句合并
  const mergeShortSentences = (captions) => {
    const merged = [];
    let currentMerge = null;

    for (const caption of captions) {
      if (caption.text.length < 10) {
        // 短句，尝试合并
        if (currentMerge) {
          // 合并到当前组
          currentMerge.text += ' ' + caption.text;
          currentMerge.duration = caption.start + caption.duration - currentMerge.start;
        } else {
          // 开始新的合并组
          currentMerge = { ...caption };
        }
      } else {
        // 长句，先处理之前的合并组
        if (currentMerge) {
          merged.push(currentMerge);
          currentMerge = null;
        }
        // 添加当前长句
        merged.push(caption);
      }
    }

    // 处理最后一个合并组
    if (currentMerge) {
      merged.push(currentMerge);
    }

    return merged;
  };

  // 文本预处理：停用词过滤
  const filterStopWords = (captions) => {
    const stopWords = new Set([
      '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这',
      'the', 'a', 'an', 'and', 'or', 'but', 'if', 'because', 'as', 'what', 'which', 'this', 'that', 'these', 'those', 'then',
      'just', 'so', 'than', 'such', 'both', 'through', 'about', 'for', 'is', 'of', 'while', 'during', 'to', 'from', 'in', 'on'
    ]);

    return captions.map(caption => {
      const words = caption.text.split(/\s+/);
      const filteredWords = words.filter(word => {
        const cleanWord = word.toLowerCase().replace(/[.,!?;:()]/g, '');
        return cleanWord && !stopWords.has(cleanWord);
      });
      return {
        ...caption,
        text: filteredWords.join(' '),
        originalText: caption.text // 保留原始文本
      };
    }).filter(caption => caption.text.length > 0);
  };

  // 文本预处理主函数
  const preprocessCaptions = (captions) => {
    let processed = [...captions];
    processed = mergeShortSentences(processed);
    processed = filterStopWords(processed);
    return processed;
  };

  // 规则引擎结构分段
  const analyzeStructure = (captions) => {
    const segments = [];
    let currentSegment = null;

    // 结构类型关键词
    const structureKeywords = {
      introduction: ['介绍', '今天', '我们', '要', '讲', '分享', '开始', 'hello', 'hi', 'welcome', 'today', 'we', 'are', 'going', 'to', 'let', 'me', 'start'],
      main: ['主要', '核心', '重点', '首先', '其次', '然后', '接下来', 'first', 'second', 'then', 'next', 'now', 'moving', 'on'],
      conclusion: ['总结', '最后', '总之', '所以', '感谢', '再见', 'summary', 'finally', 'in', 'conclusion', 'thank', 'you', 'goodbye']
    };

    // 识别结构类型
    const identifyStructureType = (text) => {
      const lowerText = text.toLowerCase();
      
      for (const [type, keywords] of Object.entries(structureKeywords)) {
        for (const keyword of keywords) {
          if (lowerText.includes(keyword.toLowerCase())) {
            return type;
          }
        }
      }
      
      return 'main'; // 默认类型
    };

    // 分析字幕，生成结构段
    for (let i = 0; i < captions.length; i++) {
      const caption = captions[i];
      const structureType = identifyStructureType(caption.text);

      if (!currentSegment) {
        // 开始新的结构段
        currentSegment = {
          id: segments.length + 1,
          title: getSegmentTitle(structureType, caption.text),
          type: structureType,
          start: caption.start,
          end: caption.start + caption.duration,
          captions: [caption]
        };
      } else {
        // 检查是否需要开始新的结构段
        const timeGap = caption.start - currentSegment.end;
        const isNewType = structureType !== currentSegment.type;

        if (timeGap > 5 || isNewType) {
          // 时间间隔超过5秒或结构类型变化，开始新段
          segments.push(currentSegment);
          currentSegment = {
            id: segments.length + 1,
            title: getSegmentTitle(structureType, caption.text),
            type: structureType,
            start: caption.start,
            end: caption.start + caption.duration,
            captions: [caption]
          };
        } else {
          // 继续当前结构段
          currentSegment.end = caption.start + caption.duration;
          currentSegment.captions.push(caption);
        }
      }
    }

    // 添加最后一个结构段
    if (currentSegment) {
      segments.push(currentSegment);
    }

    // 确保结构段有合理的时长
    return segments.filter(segment => segment.end - segment.start > 1);
  };

  // 获取结构段标题
  const getSegmentTitle = (type, text) => {
    const typeTitles = {
      introduction: '介绍',
      main: '主体',
      conclusion: '总结'
    };

    // 尝试从文本中提取标题
    const firstSentence = text.split(/[。！？.!?]/)[0];
    if (firstSentence.length > 5 && firstSentence.length < 20) {
      return firstSentence;
    }

    return typeTitles[type] || '内容';
  };

  // 获取字幕主函数：优先 Innertube，再旧 API，最后 DOM 备用；完成后尝试恢复已保存结构
  const fetchCaptions = async () => {
    const vid = getVideoId();
    if (!vid) {
      setError('当前不是有效的 YouTube 视频页');
      setIsLoading(false);
      setPhase('no_video');
      return;
    }
    setIsLoading(true);
    setError(null);
    setPhase('fetching');
    try {
      let captionsData = await fetchCaptionsFromInnertube(vid);
      if (!captionsData?.length) captionsData = await fetchCaptionsFromAPI();
      if (!captionsData?.length) captionsData = await fetchCaptionsFromDOM();
      if (captionsData?.length) {
        setPhase('parsing');
        const processedCaptions = preprocessCaptions(captionsData);
        setCaptions(processedCaptions);
        const segments = analyzeStructure(processedCaptions);
        setStructuredSegments(segments);
        setPhase('done');
        // 若有已保存结构则优先恢复（保留用户编辑）
        loadStructureFromStorage(vid, (savedSegments) => {
          if (savedSegments?.length) setStructuredSegments(savedSegments);
        });
      } else {
        setError('无法获取视频字幕（可能无字幕或仅自动生成）');
        setStructuredSegments([]);
        setPhase('done');
      }
    } catch (err) {
      setError('获取字幕时发生错误');
      setPhase('done');
      console.error('Error fetching captions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 从 storage 加载已保存结构（供 fetchCaptions 完成后恢复用）
  const loadStructureFromStorage = (vid, onLoaded) => {
    if (!vid || !onLoaded) return;
    chrome.runtime.sendMessage({ action: 'loadStructure', videoId: vid }, (response) => {
      if (response?.success && response?.data?.segments?.length) {
        onLoaded(response.data.segments);
      }
    });
  };

  // 监听视频变化：初次加载 + YouTube 站内切视频（SPA）时重新拉取字幕
  useEffect(() => {
    const apply = () => {
      const currentVideoId = getVideoId();
      if (!currentVideoId) {
        setVideoId('');
        setCaptions([]);
        setStructuredSegments([]);
        setIsLoading(false);
        setError(null);
        setPhase('no_video');
        return;
      }
      if (currentVideoId !== videoId) {
        setVideoId(currentVideoId);
        setCaptions([]);
        setStructuredSegments([]);
        setError(null);
        setPhase('fetching');
        fetchCaptions();
      }
    };
    apply();
    const onNav = () => setTimeout(apply, 500);
    window.addEventListener('yt-navigate-finish', onNav);
    return () => window.removeEventListener('yt-navigate-finish', onNav);
  }, []);

  // 监听视频播放状态
  useEffect(() => {
    const videoElement = document.querySelector('video');
    if (videoElement) {
      const updateCurrentTime = () => {
        setCurrentTime(videoElement.currentTime);
      };

      videoElement.addEventListener('timeupdate', updateCurrentTime);
      
      // 初始设置当前时间
      setCurrentTime(videoElement.currentTime);

      // 清理监听器
      return () => {
        videoElement.removeEventListener('timeupdate', updateCurrentTime);
      };
    }
  }, [videoId]);

  // 处理添加新结构段
  const handleAddSegment = () => {
    const videoElement = document.querySelector('video');
    if (!videoElement) return;

    const newSegmentStart = currentTime;
    // 估算结束时间（当前时间 + 30秒）
    const newSegmentEnd = Math.min(currentTime + 30, videoElement.duration || currentTime + 30);

    // 生成新结构段
    const newSegment = {
      id: structuredSegments.length + 1,
      title: '新结构段',
      type: 'main',
      start: newSegmentStart,
      end: newSegmentEnd,
      captions: []
    };

    // 添加到结构段列表
    const updatedSegments = [...structuredSegments, newSegment];
    // 按开始时间排序
    updatedSegments.sort((a, b) => a.start - b.start);
    // 更新 ID
    updatedSegments.forEach((segment, index) => {
      segment.id = index + 1;
    });

    setStructuredSegments(updatedSegments);
    // 自动保存结构
    saveStructure(updatedSegments);
  };

  // 保存结构分析结果
  const saveStructure = (segments) => {
    const currentVideoId = getVideoId();
    if (!currentVideoId || !segments.length) return;

    chrome.runtime.sendMessage(
      { 
        action: 'saveStructure',
        data: {
          videoId: currentVideoId,
          segments
        }
      },
      (response) => {
        if (response && response.success) {
          console.log('Structure saved successfully');
        } else {
          console.error('Failed to save structure:', response?.message);
        }
      }
    );
  };

  return (
    <div className="clipstruct-container">
      <div className="clipstruct-panel">
        <div className="clipstruct-header">
          <h3>ClipStruct</h3>
          <div className="header-buttons">
            <button 
              className={`edit-button ${isEditing ? 'edit-mode' : ''}`}
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? '完成' : '编辑'}
            </button>
            <button className="clipstruct-toggle">▼</button>
          </div>
        </div>
        {/* 采集阶段状态条：在视频页明确展示「正在采集字幕」 */}
        {(phase === 'fetching' || phase === 'parsing') && (
          <div className="clipstruct-status-bar">
            <span className="status-spinner" aria-hidden />
            <span className="status-text">
              {phase === 'fetching' ? '正在采集字幕…' : '正在解析结构…'}
            </span>
          </div>
        )}
        <div className="clipstruct-content">
          {phase === 'checking' ? (
            <div className="loading loading--active">
              <span className="loading-spinner" aria-hidden />
              <span>正在检测视频页…</span>
            </div>
          ) : phase === 'no_video' ? (
            <div className="status-no-video">请打开任意视频播放页以使用 ClipStruct</div>
          ) : isLoading ? (
            <div className="loading loading--active">
              <span className="loading-spinner" aria-hidden />
              <span>{phase === 'parsing' ? '正在解析结构…' : '正在采集字幕…'}</span>
            </div>
          ) : error ? (
            <div className="error-box">
              <div className="error">{error}</div>
              <button type="button" className="retry-button" onClick={() => fetchCaptions()}>
                重新加载字幕
              </button>
            </div>
          ) : captions.length > 0 ? (
            <>
              <div className="structure-analysis">
                <h4>视频结构</h4>
                {structuredSegments.length > 0 ? (
                  <div className="segments-list">
                    {structuredSegments.map((segment, index) => {
                      const isCurrentSegment = currentTime >= segment.start && currentTime <= segment.end;
                      
                      const handleSegmentClick = () => {
                        const videoElement = document.querySelector('video');
                        if (videoElement) {
                          videoElement.currentTime = segment.start;
                        }
                      };
                      
                      // 处理编辑结构段标题
                      const handleEditTitle = () => {
                        setEditingSegmentId(segment.id);
                        setEditingTitle(segment.title);
                      };

                      // 处理保存结构段标题
                      const handleSaveTitle = () => {
                        if (editingTitle.trim()) {
                          const updatedSegments = structuredSegments.map(s => 
                            s.id === segment.id ? { ...s, title: editingTitle.trim() } : s
                          );
                          setStructuredSegments(updatedSegments);
                          // 自动保存结构
                          saveStructure(updatedSegments);
                        }
                        setEditingSegmentId(null);
                        setEditingTitle('');
                      };

                      // 处理删除结构段
                      const handleDeleteSegment = (e) => {
                        e.stopPropagation(); // 防止触发点击跳转
                        const updatedSegments = structuredSegments.filter(s => s.id !== segment.id);
                        // 更新 ID
                        updatedSegments.forEach((s, index) => {
                          s.id = index + 1;
                        });
                        setStructuredSegments(updatedSegments);
                        // 自动保存结构
                        saveStructure(updatedSegments);
                      };

                      return (
                        <div 
                          key={segment.id} 
                          className={`segment-item segment-${segment.type} ${isCurrentSegment ? 'segment-current' : ''}`}
                          onClick={handleSegmentClick}
                        >
                          <div className="segment-header">
                            {editingSegmentId === segment.id ? (
                              <div className="segment-title-edit">
                                <input 
                                  type="text" 
                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  onBlur={handleSaveTitle}
                                  onKeyPress={(e) => e.key === 'Enter' && handleSaveTitle()}
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <span className="segment-title">{segment.title}</span>
                            )}
                            <div className="segment-header-actions">
                              <span className="segment-time">{formatTime(segment.start)} - {formatTime(segment.end)}</span>
                              {isEditing && (
                                <div className="segment-actions">
                                  <button 
                                    className="segment-action-button edit" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditTitle();
                                    }}
                                  >
                                    ✏️
                                  </button>
                                  <button 
                                    className="segment-action-button delete" 
                                    onClick={handleDeleteSegment}
                                  >
                                    🗑️
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="segment-duration">
                            <div className="duration-bar">
                              <div 
                                className="duration-fill" 
                                style={{ 
                                  width: '100%',
                                  backgroundColor: getSegmentColor(segment.type)
                                }}
                              ></div>
                              {isCurrentSegment && (
                                <div 
                                  className="current-time-indicator" 
                                  style={{ 
                                    left: `${((currentTime - segment.start) / (segment.end - segment.start)) * 100}%` 
                                  }}
                                ></div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* 添加新结构段按钮 */}
                    {isEditing && (
                      <div className="add-segment-container">
                        <button 
                          className="add-segment-button"
                          onClick={handleAddSegment}
                        >
                          + 添加新结构段
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="no-structure">正在分析结构...</div>
                )}
              </div>
              <div className="captions-list">
                <h4>视频字幕</h4>
                {captions.slice(0, 5).map((caption, index) => (
                  <div key={index} className="caption-item">
                    <span className="caption-time">{formatTime(caption.start)}</span>
                    <span className="caption-text">{caption.text}</span>
                  </div>
                ))}
                {captions.length > 5 && (
                  <div className="caption-more">... 共 {captions.length} 条字幕</div>
                )}
              </div>
            </>
          ) : (
            <div className="no-captions">无字幕可用</div>
          )}
        </div>
      </div>
    </div>
  );
}

// 格式化时间
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// 获取结构段颜色
function getSegmentColor(type) {
  const colors = {
    introduction: '#4CAF50', // 绿色
    main: '#2196F3', // 蓝色
    conclusion: '#FF9800' // 橙色
  };
  return colors[type] || '#9E9E9E'; // 默认灰色
}

// 渲染应用
if (document.getElementById('clipstruct-root')) {
  ReactDOM.createRoot(document.getElementById('clipstruct-root')).render(
    <React.StrictMode>
      <ClipStructApp />
    </React.StrictMode>
  );
} else {
  // 创建根元素
  const rootElement = document.createElement('div');
  rootElement.id = 'clipstruct-root';
  document.body.appendChild(rootElement);
  
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ClipStructApp />
    </React.StrictMode>
  );
}
