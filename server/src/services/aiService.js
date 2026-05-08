// AI service: deterministic local classification and summary generation.
const { buildAiAnalysis } = require('../lib');
const { listBillsForUser, serializeBill } = require('../repositories/billRepository');
const { formatDate } = require('../../miniprogram/utils/format');

const classifyBillText = (text = '') => {
  const value = String(text).toLowerCase();
  const incomeKeywords = ['工资', 'salary', '收入', '报销', '退款'];
  const categoryMap = [
    { keywords: ['餐', '饭', 'coffee', '咖啡', '奶茶', '外卖'], category: '餐饮' },
    { keywords: ['地铁', '公交', '打车', '出租', '停车', '加油'], category: '交通' },
    { keywords: ['商场', '淘宝', '京东', '购物', '衣服'], category: '购物' },
    { keywords: ['房租', '物业', '水电', '燃气'], category: '居住' },
    { keywords: ['电影', '游戏', '演出', 'ktv'], category: '娱乐' },
    { keywords: ['医院', '药店', '体检'], category: '医疗' },
    { keywords: ['课程', '培训', '学费'], category: '教育' },
    { keywords: ['基金', '股票', '理财'], category: '理财' },
  ];

  const isIncome = incomeKeywords.some((keyword) => value.includes(keyword.toLowerCase()));
  const categoryHit = categoryMap.find((item) => item.keywords.some((keyword) => value.includes(keyword.toLowerCase())));

  return {
    type: isIncome ? 'income' : 'expense',
    category: categoryHit ? categoryHit.category : '其他',
    confidence: categoryHit ? 0.92 : 0.62,
    reason: categoryHit ? `命中关键词：${categoryHit.category}` : '未命中固定分类，回退到其他',
  };
};

const extractAmount = (text = '') => {
  const content = String(text).replace(/[，,]/g, '').replace(/\s+/g, ' ');
  const candidates = [];
  const pushCandidate = (value, weight = 0) => {
    const amount = Number(String(value).replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) return;
    candidates.push({ amount: Number(amount.toFixed(2)), weight });
  };

  for (const match of content.matchAll(/(?:实付|支付|付款|交易金额|金额|支出|消费|支付成功|已支付|付出)[^0-9\n]{0,12}(?:¥|\$)?\s*(\d+(?:\.\d{1,2})?)/g)) {
    pushCandidate(match[1], 100);
  }

  for (const match of content.matchAll(/(?:¥|\$)\s*(\d+(?:\.\d{1,2})?)/g)) {
    pushCandidate(match[1], 80);
  }

  for (const match of content.matchAll(/(?:合计|总计|共计|总额|小计)[^0-9\n]{0,12}(?:¥|\$)?\s*(\d+(?:\.\d{1,2})?)/g)) {
    pushCandidate(match[1], 70);
  }

  if (!candidates.length) {
    for (const match of content.matchAll(/(?:^|[^0-9])(\d+(?:\.\d{1,2})?)(?!\d)/g)) {
      pushCandidate(match[1], 10);
    }
  }

  if (!candidates.length) return 0;
  candidates.sort((a, b) => b.weight - a.weight || b.amount - a.amount);
  return candidates[0].amount;
};

const extractDate = (text = '') => {
  const content = String(text);
  const patterns = [
    /(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/,
    /(20\d{2})\s*(\d{1,2})\s*(\d{1,2})/,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
    }
  }

  return formatDate(new Date());
};

const parseBillText = (text = '', source = 'ocr') => {
  const classify = classifyBillText(text);
  return {
    amount: extractAmount(text),
    type: classify.type,
    category: classify.category,
    merchant: '',
    remark: String(text).slice(0, 60),
    date: extractDate(text),
    source,
    aiParsed: {
      source,
      rawText: text,
      confidence: classify.confidence,
      reason: classify.reason,
    },
  };
};

const analyzeBills = ({ currentBills = [], previousBills = [], range }) =>
  buildAiAnalysis({
    currentBills,
    previousBills,
    range,
  });

module.exports = {
  analyzeBills,
  classifyBillText,
  parseBillText,
};
