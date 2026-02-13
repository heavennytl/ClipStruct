# 产品名称（暂定）

**ClipStruct – YouTube 视频结构拉片插件**

---

## 1. 产品背景与目标

### 1.1 背景

成长阶段的内容创作者（YouTube / B站 / 知识区创作者），在高频观看头部创作者视频时，核心行为不是"看内容"，而是**拉片**：

* 拆结构
* 看节奏
* 学文案
* 理解爆款为什么成功

现有插件主要集中在：

* 数据分析（Viewstats）
* AI 总结 / 情绪分析
* 增长与优化建议

**但没有工具服务于"观看过程中"的结构理解。**

---

### 1.2 产品目标（MVP）

> **在不打断观看体验的前提下，帮助用户在观看 YouTube 视频时，清晰理解视频结构与内容意图。**

MVP 目标：

* 跑通完整业务闭环
* 单视频可用、稳定、低成本
* 不追求"智能推荐""自动爆款模板"

---

### 1.3 非目标（明确不做）

* ❌ 视频自动总结
* ❌ 数据增长预测
* ❌ SEO / 标题优化建议
* ❌ 渠道/账号分析
* ❌ 社交分享 / 社区

---

## 2. 目标用户画像

### 核心用户

* YouTube 成长阶段创作者
* 知识区 / 商业 / 自媒体
* 高强度拉片学习者

### 使用场景

* 看头部创作者视频
* 边看边暂停
* 对结构、节奏、表达方式高度敏感

---

## 3. 使用流程（User Flow）

1. 用户打开 YouTube 视频页面
2. 插件自动检测视频与字幕
3. 右侧弹出「结构分析面板」
4. 视频播放时：

   * 当前结构段高亮
   * 时间轴同步
5. 用户可：

   * 查看结构拆解
   * 手动标注 / 调整
   * 导出结构结果

---

## 4. 核心功能需求（MVP）

### 4.1 字幕获取（必需）

**功能描述**：

* 自动读取 YouTube 官方字幕（优先）
* 支持：

  * 英文
  * 中文字幕

**实现要求**：

* 前端获取（不调用 AI）
* 带时间戳

**技术实现细节**：

* **三层回退策略**：
  1. **Innertube API**（优先）：通过 YouTube 页面内嵌的 `ytInitialPlayerResponse` 获取 `captions.playerCaptionsTracklistRenderer.captionTracks`，拼接字幕文件 URL 并请求 JSON3 格式字幕数据
  2. **ytplayer API**（备选）：从 `ytplayer.config.args` 中提取字幕配置信息，解析字幕轨道列表
  3. **DOM 实时抓取**（兜底）：监听页面字幕 DOM 节点变化，实时采集当前显示的字幕文本与时间戳

* **语言优先级**：中文（zh）→ 英文（en）→ 第一个可用语言

* **错误处理**：
  * 无字幕时：显示提示"该视频未提供字幕，无法分析结构"
  * 字幕加载失败：三种方式依次回退，全部失败后提示用户
  * 字幕语言不支持：显示提示"暂不支持该语言字幕的结构分析"

* **数据结构定义**：
  ```json
  {
    "captions": [
      {
        "text": "内容文本",
        "start": 10.5,
        "duration": 2.3
      }
    ]
  }
  ```

---

### 4.2 文本预处理（前端）

* 合并短句
* 去除填充词（like, um 等口语填充词）
* 保留时间轴信息

**详细实现规则**：

* **合并短句规则**：
  * 当两个相邻字幕的时间间隔 < 0.5 秒
  * 且合并后总长度 < 200 字符时
  * 自动合并为一个段落

* **分段间隔阈值**：
  * 当相邻字幕时间间隔 ≥ 5 秒时，视为自然分段点

* **填充词列表**：
  * 英文：uh, um, like, you know, I mean, I guess, basically, literally, kind of, sort of, well, yeah, okay, ok, right, so yeah, and stuff, or something, or whatever
  * 中文：呃, 嗯, 啊, 哦, 那个, 就是说, 怎么说呢, 对吧, 是吧, 嗯嗯

  > 注：结构信号词（如"但是""因为""首先""然而""总之"等）**不应**作为停用词过滤，它们是结构分析的重要线索。

* **输出数据结构**：
  ```json
  {
    "processed_captions": [
      {
        "text": "合并后的文本",
        "start": 10.5,
        "end": 12.8,
        "original_indices": [0, 1]
      }
    ]
  }
  ```

---

### 4.3 结构分段（核心）

**目标**：将视频划分为有明确"内容意图"的结构段

#### 4.3.1 默认结构类型（固定枚举）

```text
1. hook           – Hook（吸引注意）
2. background     – Background / Context（背景铺垫）
3. corePoint      – Core Point（核心观点）
4. example        – Example / Case（案例说明）
5. transition     – Transition（转折/承上启下）
6. emotional      – Emotional Amplification（情绪放大）
7. callToAction   – Call To Action（行动引导）
```

> 代码中统一使用 camelCase 键名（左列），UI 显示使用可读名称（右列）。

---

### 4.4 结构识别方式（MVP 策略）

#### Step 1：规则引擎（默认）

* 基于时间（前 15–30 秒默认 Hook）
* 基于关键词（why / imagine / here's the thing / the reason is）
* 基于段落长度变化

**详细规则引擎**：

* **hook 段识别**：
  * 前 15-30 秒默认标记为 Hook
  * 包含关键词：imagine, what if, here's the thing, let me tell you, today we're going to, have you ever, you won't believe, the secret is

* **background 段识别**：
  * 位于 Hook 段之后
  * 包含关键词：background, context, story, experience, when I was, a few years ago, recently, in the past, the problem was

* **corePoint 段识别**：
  * 长度 > 45 秒
  * 包含关键词：the key point, the main idea, here's why, the reason is, most importantly, the truth is, actually

* **example 段识别**：
  * 位于 Core Point 段之后
  * 包含关键词：for example, for instance, let's take, case study, such as, imagine if, think about

* **transition 段识别**：
  * 长度 < 20 秒
  * 包含关键词：but, however, now, moving on, next, then, so, therefore, thus, in conclusion

* **emotional 段识别**：
  * 包含关键词：amazing, incredible, shocking, surprising, exciting, important, critical, crucial, essential
  * 句子结尾有感叹号或问号

* **callToAction 段识别**：
  * 视频最后 30-60 秒
  * 包含关键词：subscribe, like, comment, share, follow, click, check out, visit, download, sign up

#### Step 2：AI 辅助标注（可选，用户可开关）

* 输入：带时间戳的字幕分段
* 输出：

  * 每段的「结构类型」
  * 一句话解释"这一段在干嘛"

> 注：AI 不负责生成内容，只负责"理解与标注"

**AI 调用参数**：

* **API**：OpenAI Chat Completions API（或兼容接口）
* **模型**：gpt-4o-mini（低成本轻量模型，可由用户自定义）
* **系统提示词**：
  ```
  你是一个视频结构分析助手，负责将YouTube字幕划分为固定结构类型：
  1. hook – Hook（吸引注意）
  2. background – Background / Context（背景铺垫）
  3. corePoint – Core Point（核心观点）
  4. example – Example / Case（案例说明）
  5. transition – Transition（转折/承上启下）
  6. emotional – Emotional Amplification（情绪放大）
  7. callToAction – Call To Action（行动引导）
  
  输入：带时间戳的字幕分段；
  输出：每段的结构类型（使用 camelCase 键名）+ 一句话意图说明（与输入字幕语言一致）。
  要求：仅输出JSON，不包含其他文本。
  ```

* **输入格式示例**：
  ```json
  {
    "video_title": "如何在30天内学会编程",
    "segments": [
      {"text": "想象一下，30天后你就能独立开发一个网站", "start": 0, "end": 15},
      {"text": "我曾用这个方法在2个月内从零基础到拿到offer", "start": 16, "end": 45}
    ]
  }
  ```

* **输出格式示例**：
  ```json
  {
    "segments": [
      {
        "start": 0,
        "end": 15,
        "type": "hook",
        "intent": "通过想象场景吸引观众注意，激发好奇心"
      },
      {
        "start": 16,
        "end": 45,
        "type": "background",
        "intent": "分享个人经历，建立可信度"
      }
    ]
  }
  ```

---

### 4.5 结构时间轴可视化

**UI 要求**：

* 时间轴横向展示
* 不同结构类型使用不同颜色标签
* 当前播放段高亮

**UI布局细节**：

* **面板宽度**：默认 300px，可拖拽调整（最小 240px，最大 500px）
* **时间轴高度**：默认 80px（可响应式调整，范围 60-120px）
* **结构段颜色**：
  * hook：红色 (#FF4136)
  * background：蓝色 (#0074D9)
  * corePoint：绿色 (#2ECC40)
  * example：黄色 (#FFDC00)
  * transition：紫色 (#B10DC9)
  * emotional：橙色 (#FF851B)
  * callToAction：粉色 (#F012BE)
* **结构段标签**：字体大小 12px，鼠标悬停显示完整类型名称

**交互逻辑**：

* **点击时间轴某段**：视频跳转到对应时间点
* **视频播放时**：
  * 时间轴自动滚动，保持当前段在视图中心
  * 当前段高亮（边框加粗 2px + 背景色加深 20%）
* **鼠标悬停**：显示该段的详细信息（开始/结束时间、结构类型、意图描述）
* **拖拽调整**：支持拖动结构段边界调整分段（仅编辑模式）

---

### 4.6 段落意图说明（重点）

每一段必须包含：

* Structure Type（枚举）
* Intent Description（一句话说明意图，不是总结内容）

示例：

> "This segment is used to challenge the viewer's existing belief and create curiosity."

---

### 4.7 手动编辑能力（必需）

* 用户可修改：

  * 结构类型
  * 分段边界
  * 意图描述
* 修改后：

  * 使用 `chrome.storage.local` 持久化保存

**编辑操作流程**：

* **进入编辑模式**：点击面板顶部的「编辑」按钮
* **修改结构类型**：
  * 点击时间轴上的结构段
  * 弹出编辑弹窗
  * 结构类型：下拉选择（固定枚举）
  * 意图描述：可编辑文本框（限制 100 字）
* **调整分段边界**：
  * 编辑模式下，结构段两端显示拖拽手柄
  * 拖动手柄调整边界
  * 支持精确输入时间（格式：mm:ss）
* **保存修改**：点击弹窗「保存」按钮，或按 Enter 键
* **取消编辑**：点击弹窗「取消」按钮，或按 Esc 键

**本地存储逻辑**：

* **存储方式**：`chrome.storage.local`（跨会话持久化，优于 localStorage）
* **存储键**：`clipstruct_structure_{videoId}`
* **存储内容**：完整分析结果（包含用户修改后的结构）
* **过期时间**：30 天（自动清理旧数据）
* **同步机制**：修改后立即保存，保存成功显示「已保存」提示

**数据结构**：
```json
{
  "videoId": "dQw4w9WgXcQ",
  "videoTitle": "视频标题",
  "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "analysisTime": "2024-01-01T12:00:00Z",
  "segments": [
    {
      "start": 0,
      "end": 15,
      "type": "hook",
      "intent": "通过想象场景吸引观众注意",
      "userModified": false
    }
  ]
}
```

---

### 4.8 导出功能（MVP 版）

支持导出：

* Markdown
* 纯文本

导出内容包括：

* 视频标题 + URL
* 结构时间轴
* 每段结构类型 + 意图描述

**Markdown 导出格式示例**：

```markdown
# 视频结构分析
- 标题：如何在30天内学会编程
- URL：https://www.youtube.com/watch?v=dQw4w9WgXcQ

## 结构时间轴
0:00-0:15 | Hook | 通过想象场景吸引观众注意，激发好奇心
0:16-0:45 | Background | 分享个人经历，建立可信度
0:46-1:30 | Core Point | 讲解核心学习方法：每天专注2小时
1:31-2:00 | Example | 举例说明如何安排学习时间
2:01-2:10 | Transition | 承上启下，引出下一个关键点
2:11-2:30 | Emotional Amplification | 强调坚持的重要性，激发情绪
2:31-2:50 | Call To Action | 引导订阅频道，获取更多学习资源

## 结构概览
- Hook：15秒
- Background：29秒
- Core Point：44秒
- Example：29秒
- Transition：9秒
- Emotional Amplification：19秒
- Call To Action：19秒
```

**纯文本导出格式示例**：

```
视频结构分析
标题：如何在30天内学会编程
URL：https://www.youtube.com/watch?v=dQw4w9WgXcQ

结构时间轴
0:00-0:15 | Hook | 通过想象场景吸引观众注意，激发好奇心
0:16-0:45 | Background | 分享个人经历，建立可信度
0:46-1:30 | Core Point | 讲解核心学习方法：每天专注2小时
1:31-2:00 | Example | 举例说明如何安排学习时间
2:01-2:10 | Transition | 承上启下，引出下一个关键点
2:11-2:30 | Emotional Amplification | 强调坚持的重要性，激发情绪
2:31-2:50 | Call To Action | 引导订阅频道，获取更多学习资源

结构概览
Hook：15秒
Background：29秒
Core Point：44秒
Example：29秒
Transition：9秒
Emotional Amplification：19秒
Call To Action：19秒
```

---

## 5. UI / 交互要求

### 5.1 插件形态

* Chrome Extension（Manifest V3）
* Content Script 注入 YouTube 页面

### 5.2 面板位置

* 视频右侧（推荐）
* 可折叠（点击面板顶部的折叠按钮）
* 默认宽度：300px（可拖拽调整，最小 240px，最大 500px）

---

## 6. 技术方案

### 6.1 技术栈

* **Chrome 扩展**：Manifest V3
* **前端框架**：React 19 + JSX
* **构建工具**：Vite
* **包管理器**：npm

**模块职责划分**：

* **Content Script**（`content.jsx`）：
  * 注入 YouTube 页面，获取字幕数据
  * 渲染右侧结构分析面板（React 组件）
  * 监听视频播放事件，同步时间轴
  * 处理用户交互（编辑、导出）

* **Background Script**（`background.js`）：
  * 处理跨域请求（如 AI API 调用）
  * 管理本地存储（分析结果 + 历史记录）
  * 提供消息传递接口（Content Script ↔ Background Script）

* **Popup Page**（`popup.jsx`）：
  * 插件设置（如 AI API Key 配置、自动分析开关）
  * 分析历史列表
  * 版本信息

**Manifest V3 配置**：

```json
{
  "manifest_version": 3,
  "name": "ClipStruct",
  "version": "1.0.0",
  "description": "YouTube 视频结构拉片插件",
  "permissions": [
    "activeTab",
    "scripting",
    "storage"
  ],
  "host_permissions": [
    "https://www.youtube.com/*"
  ],
  "content_scripts": [
    {
      "matches": ["https://www.youtube.com/*"],
      "js": ["content/content.js"],
      "css": ["assets/content.css"],
      "run_at": "document_idle"
    }
  ],
  "background": {
    "service_worker": "background/background.js"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

> 注：Content Script 的 js/css 路径为 Vite 构建后的输出路径，非源码路径。

---

### 6.2 AI 调用（可开关）

* API：OpenAI Chat Completions API（或兼容接口）
* 模型建议：gpt-4o-mini（低成本，用户可自定义模型名）
* 输入：结构化字幕 JSON
* 输出：

  ```json
  {
    "segments": [
      {
        "start": 0,
        "end": 15,
        "type": "hook",
        "intent": "通过想象场景吸引观众注意，激发好奇心"
      }
    ]
  }
  ```

* AI 调用失败时，自动回退到规则引擎分析

---

### 6.3 项目结构

```
clipstruct/
├── src/
│   ├── content/          # Content Script（注入 YouTube 页面）
│   │   ├── content.jsx   # 主组件：字幕获取、结构分析、面板渲染
│   │   └── content.css   # 面板样式
│   ├── background/       # Background Script（Service Worker）
│   │   └── background.js # 消息传递、存储管理、AI API 调用
│   ├── popup/            # Popup Page（插件弹窗）
│   │   ├── popup.html
│   │   ├── popup.jsx     # 设置、历史列表
│   │   └── popup.css
│   └── common/           # 共享代码
│       ├── constants.js  # 结构类型枚举、颜色映射、关键词等常量
│       └── utils.js      # 时间格式化、数据转换等工具函数
├── public/
│   ├── icons/            # 插件图标（16/32/48/128px）
│   └── manifest.json     # Manifest V3 配置
├── __tests__/            # 单元测试
├── package.json
└── vite.config.js        # Vite 构建配置（多入口）
```

---

### 6.4 开发与部署

* **开发命令**：
  * 安装依赖：`npm install`
  * 开发模式：`npm run dev`（监视文件变化，自动构建）
  * 构建生产版本：`npm run build`
  * 运行测试：`npm test`

* **本地测试**：
  * Chrome 扩展管理页（chrome://extensions）→ 开启开发者模式 → 加载已解压的扩展 → 选择 `dist` 目录

* **发布**：
  * `npm run build` → 将 `dist` 压缩为 ZIP → 提交至 Chrome Web Store

---

## 7. 数据与隐私

* 不上传用户账号信息
* 不存储视频内容到服务器（MVP 阶段所有数据仅保存在本地）
* API Key 由用户本地配置，不经过任何中间服务器

---

## 8. MVP 验收标准

* 能对任意 YouTube 视频完成：

  * 字幕读取
  * 结构分段
  * 时间轴同步
* 不报错、不影响视频播放
* 单视频分析 < 10 秒

**功能测试场景**：

* **场景 1：无字幕视频**
  * 预期结果：显示提示"该视频未提供字幕，无法分析结构"，不崩溃
  * 测试步骤：打开一个无字幕的 YouTube 视频，观察插件行为

* **场景 2：长视频（> 30 分钟）**
  * 预期结果：分析时间 < 10 秒，时间轴滚动流畅，不影响视频播放
  * 测试步骤：打开一个 45 分钟的 YouTube 视频，点击分析按钮，观察分析时间和播放流畅度

* **场景 3：用户手动调整结构**
  * 预期结果：修改后本地保存成功，刷新页面后保持修改
  * 测试步骤：分析一个视频，手动调整结构类型和分段边界，保存后刷新页面，检查是否保持修改

* **场景 4：AI API 调用失败**
  * 预期结果：自动回退到规则引擎分析，显示"AI 分析失败，已使用规则引擎分析"提示
  * 测试步骤：配置错误的 API Key，分析视频，观察回退行为

* **场景 5：导出功能**
  * 预期结果：成功导出 Markdown 和纯文本格式，内容完整准确
  * 测试步骤：分析一个视频，分别导出为 Markdown 和纯文本，检查导出内容

* **场景 6：YouTube SPA 页面导航**
  * 预期结果：用户在 YouTube 站内切换视频时，插件自动检测新视频并重新分析
  * 测试步骤：分析一个视频后，点击推荐视频跳转，观察插件是否自动更新

**性能指标**：

* **页面加载时间**：插件注入后，YouTube 页面加载时间增加 < 300ms
* **内存占用**：
  * 空闲状态 < 30MB
  * 分析中 < 80MB
* **CPU 使用率**：
  * 空闲状态 < 1%
  * 分析过程中 < 10%
* **响应时间**：
  * 打开插件面板：< 100ms
  * 点击编辑按钮：< 50ms
  * 保存修改：< 200ms

---

## 9. 后续迭代方向（不做）

* 结构模板抽象
* 相似结构视频推荐
* 脚本生成
* 多视频对比

---

## 10. 一句话总结

> **这是一个帮助创作者"在观看中看懂结构"的工具，而不是一个替你创作或预测爆款的 AI。**
