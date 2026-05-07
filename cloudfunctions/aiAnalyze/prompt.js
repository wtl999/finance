const buildSystemPrompt = () => [
  '你是微信记账小程序的 AI 消费分析器。',
  '你只能输出 JSON，不能输出 Markdown、解释、代码块或多余文本。',
  '必须基于输入的聚合数据分析，不要编造没有出现在输入里的金额、日期和数量。',
  '输出结果要适合前端直接渲染，字段名固定、结构稳定。',
  '支持 periodType 为 week 或 month，两种情况下都要输出相同的顶层结构。',
  '必须围绕这些主题给出结论：消费趋势、异常消费、分类变化、月预算预测、奶茶/外卖等高频行为分析。',
  '如果信息不足，用保守结论，并保持 JSON 完整。',
].join('');

const buildUserPrompt = (seed) => {
  const json = JSON.stringify(seed);

  return [
    '请根据下面的消费聚合数据输出结构化 JSON。',
    '要求：',
    '1. summary 用于页面卡片展示。',
    '2. trend 用于趋势图和趋势结论。',
    '3. anomalies 用于异常消费列表。',
    '4. categoryChanges 用于分类变化展示。',
    '5. budgetForecast 用于预算预测卡片。',
    '6. highFrequency 用于奶茶/外卖等高频行为分析。',
    '7. actionItems 必须是可执行建议数组。',
    '8. ui 里给出页面展示标题和标签。',
    '',
    '请严格输出以下 JSON 结构：',
    '{',
    '  "periodType": "week | month",',
    '  "headline": "string",',
    '  "overview": "string",',
    '  "trend": { "direction": "up | down | flat", "title": "string", "detail": "string", "keyPoint": "string" },',
    '  "anomalies": [{ "date": "YYYY-MM-DD", "amount": 0, "merchant": "string", "category": "string", "reason": "string", "severity": "low | medium | high" }],',
    '  "categoryChanges": [{ "category": "string", "current": 0, "previous": 0, "delta": 0, "changeRate": 0, "direction": "up | down | flat" }],',
    '  "budgetForecast": { "forecastExpense": 0, "pressure": "low | medium | high", "confidence": 0, "suggestion": "string", "referenceCategories": "string" },',
    '  "highFrequency": [{ "label": "string", "count": 0, "amount": 0, "behavior": "string", "suggestion": "string" }],',
    '  "actionItems": ["string"],',
    '  "ui": { "badge": "string", "tone": "string", "subtitle": "string" }',
    '}',
    '',
    '消费聚合数据：',
    json,
  ].join('\n');
};

module.exports = {
  buildSystemPrompt,
  buildUserPrompt,
};
