/**
 * ClipStruct EditModal 组件
 * 编辑结构段落的模态框
 */
import React, { useState } from 'react';
import { SEGMENT_TYPES, SEGMENT_TYPE_LABELS } from '../common/constants.js';
import { formatTime, parseTime } from '../common/utils.js';

/**
 * 编辑模态框组件
 * @param {Object} segment - 要编辑的段落
 * @param {Function} onSave - 保存回调
 * @param {Function} onCancel - 取消回调
 */
export default function EditModal({ segment, onSave, onCancel }) {
  const [type, setType] = useState(segment.type);
  const [intent, setIntent] = useState(segment.intent);
  const [startTime, setStartTime] = useState(formatTime(segment.start));
  const [endTime, setEndTime] = useState(formatTime(segment.end));
  const [error, setError] = useState(null);

  // 处理保存
  const handleSave = () => {
    // 验证时间格式
    const start = parseTime(startTime);
    const end = parseTime(endTime);

    if (start < 0 || end < 0) {
      setError('时间格式不正确，请使用 mm:ss 格式');
      return;
    }

    if (start >= end) {
      setError('开始时间必须小于结束时间');
      return;
    }

    // 验证意图描述长度
    if (intent.trim().length === 0) {
      setError('意图描述不能为空');
      return;
    }

    if (intent.length > 200) {
      setError('意图描述不能超过200字符');
      return;
    }

    // 保存修改
    onSave({
      ...segment,
      type,
      intent: intent.trim(),
      start,
      end,
      duration: end - start,
      userModified: true,
    });
  };

  // 按 Enter 保存，按 Esc 取消
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="edit-modal-overlay" onClick={onCancel}>
      <div className="edit-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="edit-modal-header">
          <h3>编辑结构段落</h3>
          <button className="edit-modal-close" onClick={onCancel}>×</button>
        </div>

        <div className="edit-modal-content">
          {/* 结构类型选择 */}
          <div className="edit-field">
            <label className="edit-label">结构类型</label>
            <select 
              className="edit-select" 
              value={type} 
              onChange={(e) => setType(e.target.value)}
            >
              {Object.keys(SEGMENT_TYPES).map(key => (
                <option key={SEGMENT_TYPES[key]} value={SEGMENT_TYPES[key]}>
                  {SEGMENT_TYPE_LABELS[SEGMENT_TYPES[key]]}
                </option>
              ))}
            </select>
          </div>

          {/* 时间范围调整 */}
          <div className="edit-field-group">
            <div className="edit-field">
              <label className="edit-label">开始时间</label>
              <input
                type="text"
                className="edit-input"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="mm:ss"
              />
            </div>
            <div className="edit-field">
              <label className="edit-label">结束时间</label>
              <input
                type="text"
                className="edit-input"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="mm:ss"
              />
            </div>
          </div>

          {/* 意图描述编辑 */}
          <div className="edit-field">
            <label className="edit-label">
              意图描述
              <span className="edit-label-hint">（{intent.length}/200）</span>
            </label>
            <textarea
              className="edit-textarea"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="请输入段落的意图描述..."
              rows={3}
              maxLength={200}
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="edit-error">{error}</div>
          )}
        </div>

        <div className="edit-modal-footer">
          <button className="edit-btn edit-btn-cancel" onClick={onCancel}>
            取消
          </button>
          <button className="edit-btn edit-btn-save" onClick={handleSave}>
            保存修改
          </button>
        </div>

        <div className="edit-modal-hint">
          提示：Ctrl+Enter 保存，Esc 取消
        </div>
      </div>
    </div>
  );
}
