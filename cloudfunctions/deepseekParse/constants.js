const BILL_PARSE_CATEGORIES = [
  '餐饮',
  '交通',
  '购物',
  '住房',
  '娱乐',
  '医疗',
  '教育',
  '工资',
  '理财',
  '其他',
];

const DEFAULT_MODEL = 'deepseek-chat';
const DEFAULT_CURRENCY = 'CNY';
const AI_LOG_COLLECTION = 'ai_logs';
const SOURCE_LABELS = {
  wechat: '微信支付',
  alipay: '支付宝',
  meituan: '美团订单',
  ocr: 'OCR文本',
};

const EMPTY_TOKEN_USAGE = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};

module.exports = {
  BILL_PARSE_CATEGORIES,
  DEFAULT_MODEL,
  DEFAULT_CURRENCY,
  AI_LOG_COLLECTION,
  SOURCE_LABELS,
  EMPTY_TOKEN_USAGE,
};
