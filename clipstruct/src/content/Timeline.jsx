/**
 * ClipStruct Timeline 组件
 * 水平时间轴，展示视频结构分布
 */
import React from 'react';
import { SEGMENT_TYPE_LABELS } from '../common/constants.js';
import { getSegmentColor, formatTime } from '../common/utils.js';

/**
 * 时间轴组件
 * @param {Array} segments - 结构段落数组
 * @param {number} currentTime - 当前播放时间（秒）
 * @param {Function} onSegmentClick - 点击段落回调
 */
export default function Timeline({ segments, currentTime, onSegmentClick }) {
  if (!segments || segments.length === 0) {
    return null;
  }

  // 计算总时长
  const totalDuration = segments[segments.length - 1].end;

  // 查找当前播放段落
  const currentSegmentIndex = segments.findIndex(
    seg => currentTime >= seg.start && currentTime < seg.end
  );

  return (
    <div className="timeline-container">
      <div className="timeline-title">视频结构时间轴</div>
      
      <div className="timeline-track">
        {segments.map((seg, index) => {
          const widthPercent = ((seg.end - seg.start) / totalDuration) * 100;
          const isActive = index === currentSegmentIndex;
          
          return (
            <div
              key={index}
              className={`timeline-segment ${isActive ? 'active' : ''}`}
              style={{
                width: `${widthPercent}%`,
                backgroundColor: getSegmentColor(seg.type),
              }}
              onClick={() => onSegmentClick(seg)}
              title={`${SEGMENT_TYPE_LABELS[seg.type]}\n${formatTime(seg.start)} - ${formatTime(seg.end)}\n${seg.intent}`}
            >
              {/* 段落标签（仅在宽度足够时显示） */}
              {widthPercent > 8 && (
                <span className="timeline-segment-label">
                  {SEGMENT_TYPE_LABELS[seg.type].split('（')[0]}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 时间刻度 */}
      <div className="timeline-ticks">
        <span className="timeline-tick">0:00</span>
        <span className="timeline-tick">{formatTime(totalDuration / 2)}</span>
        <span className="timeline-tick">{formatTime(totalDuration)}</span>
      </div>
    </div>
  );
}
