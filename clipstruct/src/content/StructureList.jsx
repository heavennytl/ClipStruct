/**
 * ClipStruct StructureList 组件
 * 结构段落列表
 */
import React, { useRef, useEffect } from 'react';
import { SEGMENT_TYPE_LABELS } from '../common/constants.js';
import { getSegmentColor, formatTime } from '../common/utils.js';

/**
 * 结构列表组件
 * @param {Array} segments - 结构段落数组
 * @param {number} currentTime - 当前播放时间（秒）
 * @param {Function} onSegmentClick - 点击段落回调
 * @param {Function} onEditSegment - 编辑段落回调
 */
export default function StructureList({ segments, currentTime, onSegmentClick, onEditSegment }) {
  const listRef = useRef(null);
  const activeItemRef = useRef(null);

  if (!segments || segments.length === 0) {
    return null;
  }

  // 查找当前播放段落
  const currentSegmentIndex = segments.findIndex(
    seg => currentTime >= seg.start && currentTime < seg.end
  );

  // 自动滚动到当前播放段落
  useEffect(() => {
    if (activeItemRef.current && listRef.current) {
      const listRect = listRef.current.getBoundingClientRect();
      const itemRect = activeItemRef.current.getBoundingClientRect();
      
      // 如果当前项不在可视区域，滚动到它
      if (itemRect.top < listRect.top || itemRect.bottom > listRect.bottom) {
        activeItemRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [currentSegmentIndex]);

  return (
    <div className="structure-list" ref={listRef}>
      <h4 className="structure-list-title">📝 结构详情</h4>
      {segments.map((seg, i) => {
        const isActive = i === currentSegmentIndex;
        
        return (
          <div
            key={i}
            ref={isActive ? activeItemRef : null}
            className={`structure-item ${isActive ? 'active' : ''} ${seg.userModified ? 'user-modified' : ''}`}
          >
            <div className="structure-item-content" onClick={() => onSegmentClick(seg)}>
              <div className="structure-header">
                <span
                  className="structure-type-badge"
                  style={{ backgroundColor: getSegmentColor(seg.type) }}
                >
                  {SEGMENT_TYPE_LABELS[seg.type]}
                </span>
                <span className="structure-time">
                  {formatTime(seg.start)} - {formatTime(seg.end)}
                </span>
              </div>
              <div className="structure-intent">{seg.intent}</div>
              <div className="structure-text">
                {seg.text.substring(0, 80)}...
              </div>
            </div>
            <button
              className="structure-edit-btn"
              onClick={(e) => {
                e.stopPropagation();
                onEditSegment(seg);
              }}
              title="编辑此段落"
            >
              ✏️
            </button>
            {seg.userModified && (
              <span className="structure-modified-badge" title="此段落已被手动修改">
                ✓
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
