/**
 * ClipStruct 共享常量
 * 所有结构类型、颜色、关键词等常量集中定义，禁止在其他文件中硬编码。
 */

// ========== 存储键前缀 ==========

export const STORAGE_PREFIX = 'clipstruct_';
export const STORAGE_KEYS = {
  /** 结构分析结果：clipstruct_structure_{videoId} */
  structure: (videoId) => `${STORAGE_PREFIX}structure_${videoId}`,
  /** 分析历史列表 */
  history: `${STORAGE_PREFIX}history`,
  /** 用户设置 */
  settings: `${STORAGE_PREFIX}settings`,
};

// ========== 结构类型枚举 ==========

export const SEGMENT_TYPES = {
  HOOK: 'hook',
  BACKGROUND: 'background',
  CORE_POINT: 'corePoint',
  EXAMPLE: 'example',
  TRANSITION: 'transition',
  EMOTIONAL: 'emotional',
  CALL_TO_ACTION: 'callToAction',
};

/** 结构类型 → UI 显示名称 */
export const SEGMENT_TYPE_LABELS = {
  [SEGMENT_TYPES.HOOK]: 'Hook（吸引注意）',
  [SEGMENT_TYPES.BACKGROUND]: 'Background（背景铺垫）',
  [SEGMENT_TYPES.CORE_POINT]: 'Core Point（核心观点）',
  [SEGMENT_TYPES.EXAMPLE]: 'Example（案例说明）',
  [SEGMENT_TYPES.TRANSITION]: 'Transition（转折）',
  [SEGMENT_TYPES.EMOTIONAL]: 'Emotional（情绪放大）',
  [SEGMENT_TYPES.CALL_TO_ACTION]: 'Call To Action（行动引导）',
};

/** 结构类型 → 导出时的短名称 */
export const SEGMENT_TYPE_SHORT_LABELS = {
  [SEGMENT_TYPES.HOOK]: 'Hook',
  [SEGMENT_TYPES.BACKGROUND]: 'Background',
  [SEGMENT_TYPES.CORE_POINT]: 'Core Point',
  [SEGMENT_TYPES.EXAMPLE]: 'Example',
  [SEGMENT_TYPES.TRANSITION]: 'Transition',
  [SEGMENT_TYPES.EMOTIONAL]: 'Emotional Amplification',
  [SEGMENT_TYPES.CALL_TO_ACTION]: 'Call To Action',
};

/** 结构类型 → 颜色（按 PRD 定义） */
export const SEGMENT_COLORS = {
  [SEGMENT_TYPES.HOOK]: '#FF4136',
  [SEGMENT_TYPES.BACKGROUND]: '#0074D9',
  [SEGMENT_TYPES.CORE_POINT]: '#2ECC40',
  [SEGMENT_TYPES.EXAMPLE]: '#FFDC00',
  [SEGMENT_TYPES.TRANSITION]: '#B10DC9',
  [SEGMENT_TYPES.EMOTIONAL]: '#FF851B',
  [SEGMENT_TYPES.CALL_TO_ACTION]: '#F012BE',
};

/** 默认颜色（类型未知时） */
export const DEFAULT_SEGMENT_COLOR = '#9E9E9E';

// ========== 规则引擎关键词 ==========

export const STRUCTURE_KEYWORDS = {
  [SEGMENT_TYPES.HOOK]: [
    'imagine', 'what if', "here's the thing", 'let me tell you',
    "today we're going to", 'have you ever', "you won't believe", 'the secret is',
    '想象', '如果', '你知道吗', '今天我们要', '秘密',
  ],
  [SEGMENT_TYPES.BACKGROUND]: [
    'background', 'context', 'story', 'experience', 'when i was',
    'a few years ago', 'recently', 'in the past', 'the problem was',
    '背景', '故事', '经历', '几年前', '过去', '问题',
  ],
  [SEGMENT_TYPES.CORE_POINT]: [
    'the key point', 'the main idea', "here's why", 'the reason is',
    'most importantly', 'the truth is', 'actually',
    '核心', '关键', '重点', '原因', '最重要的是', '真相', '实际上',
  ],
  [SEGMENT_TYPES.EXAMPLE]: [
    'for example', 'for instance', "let's take", 'case study',
    'such as', 'imagine if', 'think about',
    '例如', '比如', '举个例子', '案例', '就像', '想象一下',
  ],
  [SEGMENT_TYPES.TRANSITION]: [
    'but', 'however', 'now', 'moving on', 'next', 'then',
    'so', 'therefore', 'thus', 'in conclusion',
    '但是', '然而', '现在', '接下来', '然后', '所以', '因此', '总之',
  ],
  [SEGMENT_TYPES.EMOTIONAL]: [
    'amazing', 'incredible', 'shocking', 'surprising', 'exciting',
    'important', 'critical', 'crucial', 'essential',
    '惊人', '不可思议', '震惊', '令人兴奋', '重要', '关键', '至关重要',
  ],
  [SEGMENT_TYPES.CALL_TO_ACTION]: [
    'subscribe', 'like', 'comment', 'share', 'follow',
    'click', 'check out', 'visit', 'download', 'sign up',
    '订阅', '点赞', '评论', '分享', '关注', '点击', '访问', '下载', '注册',
  ],
};

// ========== 文本预处理 ==========

/** 口语填充词（仅过滤这些，不过滤结构信号词） */
export const FILLER_WORDS = {
  en: ['uh', 'um', 'like', 'you know', 'i mean', 'i guess', 'basically', 'literally', 'kind of', 'sort of', 'well', 'yeah', 'okay', 'ok', 'right', 'so yeah', 'and stuff', 'or something', 'or whatever'],
  zh: ['呃', '嗯', '啊', '哦', '那个', '就是说', '怎么说呢', '对吧', '是吧', '嗯嗯'],
};

/** 短句合并阈值 */
export const MERGE_GAP_THRESHOLD = 0.5; // 秒：时间间隔 < 此值则合并
export const MERGE_LENGTH_LIMIT = 200;  // 字符：合并后总长度上限

/** 自然分段间隔阈值 */
export const SEGMENT_GAP_THRESHOLD = 5; // 秒：时间间隔 ≥ 此值视为分段点

// ========== 分析状态机 ==========

export const ANALYSIS_PHASES = {
  IDLE: 'idle',
  CHECKING: 'checking',
  FETCHING: 'fetching',
  ANALYZING: 'analyzing',
  DONE: 'done',
  ERROR: 'error',
};

// ========== UI 常量 ==========

export const PANEL_WIDTH = {
  DEFAULT: 300,
  MIN: 240,
  MAX: 500,
};

/** 数据过期天数 */
export const DATA_EXPIRY_DAYS = 30;

/** 历史记录最大条数 */
export const MAX_HISTORY_ITEMS = 50;

// ========== 默认设置 ==========

export const DEFAULT_SETTINGS = {
  autoAnalyze: true,
  aiEnabled: false,
  aiApiKey: '',
  aiModel: 'gpt-4o-mini',
  aiEndpoint: 'https://api.openai.com/v1/chat/completions',
};
