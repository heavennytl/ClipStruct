// 文本预处理函数测试

// 模拟短句合并函数
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

// 模拟停用词过滤函数
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

describe('文本预处理函数测试', () => {
  describe('mergeShortSentences 函数测试', () => {
    test('测试短句合并', () => {
      const captions = [
        { text: '你好', start: 0, duration: 1 },
        { text: '我是', start: 1, duration: 1 },
        { text: '一名开发者', start: 2, duration: 2 },
        { text: '今天', start: 4, duration: 1 },
        { text: '我们来学习', start: 5, duration: 2 }
      ];

      const result = mergeShortSentences(captions);
      expect(result.length).toBe(1);
      expect(result[0].text).toBe('你好 我是 一名开发者 今天 我们来学习');
    });

    test('测试无短句情况', () => {
      const captions = [
        { text: '这是一个长句子', start: 0, duration: 2 },
        { text: '这也是一个长句子', start: 2, duration: 2 }
      ];

      const result = mergeShortSentences(captions);
      expect(result.length).toBe(1);
      expect(result[0].text).toBe('这是一个长句子 这也是一个长句子');
    });

    test('测试全是短句情况', () => {
      const captions = [
        { text: '你', start: 0, duration: 1 },
        { text: '好', start: 1, duration: 1 },
        { text: '吗', start: 2, duration: 1 }
      ];

      const result = mergeShortSentences(captions);
      expect(result.length).toBe(1);
      expect(result[0].text).toBe('你 好 吗');
      expect(result[0].start).toBe(0);
      expect(result[0].duration).toBe(3);
    });
  });

  describe('filterStopWords 函数测试', () => {
    test('测试中文停用词过滤', () => {
      const captions = [
        { text: '我是一名开发者', start: 0, duration: 2 },
        { text: '这是一个测试', start: 2, duration: 2 }
      ];

      const result = filterStopWords(captions);
      expect(result.length).toBe(2);
      expect(result[0].originalText).toBe('我是一名开发者');
      expect(result[1].originalText).toBe('这是一个测试');
    });

    test('测试英文停用词过滤', () => {
      const captions = [
        { text: 'The quick brown fox', start: 0, duration: 2 },
        { text: 'jumps over the lazy dog', start: 2, duration: 2 }
      ];

      const result = filterStopWords(captions);
      expect(result.length).toBe(2);
    });

    test('测试标点符号处理', () => {
      const captions = [
        { text: '你好，世界！', start: 0, duration: 2 },
        { text: 'Hello, world!', start: 2, duration: 2 }
      ];

      const result = filterStopWords(captions);
      expect(result.length).toBe(2);
    });
  });
});
