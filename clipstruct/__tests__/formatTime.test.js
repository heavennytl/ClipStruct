// 时间格式化函数测试

// 模拟 formatTime 函数
const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

describe('formatTime 函数测试', () => {
  test('测试整数秒数', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(59)).toBe('0:59');
    expect(formatTime(60)).toBe('1:00');
    expect(formatTime(125)).toBe('2:05');
    expect(formatTime(3600)).toBe('60:00');
  });

  test('测试小数秒数', () => {
    expect(formatTime(1.5)).toBe('0:01');
    expect(formatTime(60.999)).toBe('1:00');
    expect(formatTime(125.75)).toBe('2:05');
  });

  test('测试负数秒数', () => {
    expect(formatTime(-10)).toBe('-1:-10');
  });

  test('测试大秒数', () => {
    expect(formatTime(3661)).toBe('61:01');
    expect(formatTime(7200)).toBe('120:00');
  });
});
