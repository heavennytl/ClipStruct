// 结构分段算法测试

// 模拟识别结构类型函数
const identifyStructureType = (text) => {
  const lowerText = text.toLowerCase();
  
  const structureKeywords = {
    introduction: ['介绍', '今天', '我们', '要', '讲', '分享', '开始', 'hello', 'hi', 'welcome', 'today', 'we', 'are', 'going', 'to', 'let', 'me', 'start'],
    main: ['主要', '核心', '重点', '首先', '其次', '然后', '接下来', 'first', 'second', 'then', 'next', 'now', 'moving', 'on'],
    conclusion: ['总结', '最后', '总之', '所以', '感谢', '再见', 'summary', 'finally', 'in', 'conclusion', 'thank', 'you', 'goodbye']
  };
  
  for (const [type, keywords] of Object.entries(structureKeywords)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return type;
      }
    }
  }
  
  return 'main'; // 默认类型
};

// 模拟结构分段函数
const analyzeStructure = (captions) => {
  const segments = [];
  let currentSegment = null;

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

// 模拟获取结构段标题函数
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

describe('结构分段算法测试', () => {
  describe('identifyStructureType 函数测试', () => {
    test('测试识别介绍类型', () => {
      expect(identifyStructureType('今天我们来学习')).toBe('introduction');
      expect(identifyStructureType('Hello everyone')).toBe('introduction');
      expect(identifyStructureType('Welcome to my channel')).toBe('introduction');
      expect(identifyStructureType('开始今天的课程')).toBe('introduction');
    });

  test('测试识别主体类型', () => {
    expect(identifyStructureType('核心观点是')).toBe('main');
    expect(identifyStructureType('重点内容')).toBe('main');
  });

  test('测试识别总结类型', () => {
    expect(identifyStructureType('最后，总结一下')).toBe('conclusion');
    expect(identifyStructureType('感谢大家的观看')).toBe('conclusion');
  });

    test('测试默认类型', () => {
      expect(identifyStructureType('这是一段普通内容')).toBe('main');
      expect(identifyStructureType('测试文本')).toBe('main');
    });
  });

  describe('analyzeStructure 函数测试', () => {
    test('测试基本结构分段', () => {
      const captions = [
        { text: '今天我们来学习JavaScript', start: 0, duration: 3 },
        { text: '首先，我们了解变量', start: 3, duration: 4 },
        { text: '然后，学习函数', start: 7, duration: 4 },
        { text: '最后，总结一下', start: 11, duration: 3 }
      ];

      const result = analyzeStructure(captions);
      expect(result.length).toBe(3);
      expect(result[0].type).toBe('introduction');
      expect(result[1].type).toBe('main');
      expect(result[2].type).toBe('conclusion');
    });

    test('测试时间间隔分段', () => {
      const captions = [
        { text: '介绍部分', start: 0, duration: 3 },
        { text: '间隔后的内容', start: 10, duration: 3 } // 时间间隔超过5秒
      ];

      const result = analyzeStructure(captions);
      expect(result.length).toBe(2);
      expect(result[0].start).toBe(0);
      expect(result[1].start).toBe(10);
    });

    test('测试过滤短结构段', () => {
      const captions = [
        { text: '介绍', start: 0, duration: 0.5 }, // 时长不足1秒
        { text: '主体内容', start: 1, duration: 5 }
      ];

      const result = analyzeStructure(captions);
      expect(result.length).toBe(1);
      expect(result[0].type).toBe('main');
    });
  });

  describe('getSegmentTitle 函数测试', () => {
    test('测试从文本提取标题', () => {
      expect(getSegmentTitle('main', '这是一个合适的标题')).toBe('这是一个合适的标题');
    });

    test('测试使用类型默认标题', () => {
      expect(getSegmentTitle('introduction', '今天我们要讲的内容非常重要，包括很多方面')).toBe('介绍');
      expect(getSegmentTitle('main', '首先我们来看第一点，然后是第二点，最后是第三点')).toBe('主体');
    });
  });
});
