const { BILL_PARSE_CATEGORIES, SOURCE_LABELS } = require('./constants');

const buildSystemPrompt = () => [
  '你是微信记账小程序的账单解析器。',
  '你只能输出一个 JSON 对象，不能输出 Markdown、解释、代码块或多余文本。',
  '你的目标是从 OCR 文本中提取金额、商户、分类、时间、收入/支出。',
  `分类只能从以下列表中选择：${BILL_PARSE_CATEGORIES.join('、')}。`,
  'type 只能是 income 或 expense。',
  'amount 必须是数字，无法确认时返回 0。',
  'time 必须返回可读时间，优先格式 YYYY-MM-DD HH:mm；如果只能识别日期，则返回 YYYY-MM-DD。',
  'date 必须返回 YYYY-MM-DD，且与 time 对应。',
  'confidence 必须是 0 到 1 之间的小数。',
  '字段名必须固定，不得新增或删减关键字段。',
].join('');

const buildUserPrompt = (text, source = 'ocr') => {
  const sourceLabel = SOURCE_LABELS[source] || SOURCE_LABELS.ocr;

  return [
    `识别来源：${sourceLabel}`,
    '请根据下面的 OCR 文本生成稳定 JSON。',
    '输出字段必须包含：amount、merchant、category、time、date、type、currency、confidence、evidence、notes。',
    'evidence 里应尽量保留可追溯的原始片段。',
    '',
    'OCR 文本：',
    text,
    '',
    '只返回 JSON，不要输出其他内容。',
  ].join('\n');
};

module.exports = {
  buildSystemPrompt,
  buildUserPrompt,
};
