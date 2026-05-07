const AI_LOG_COLLECTION = 'ai_logs';
const BILL_COLLECTION = 'bills';
const DEFAULT_MODEL = 'deepseek-chat';
const EMPTY_TOKEN_USAGE = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};

const ANALYSIS_CATEGORIES = [
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

const HFR_KEYWORDS = [
  { label: '奶茶', keywords: ['奶茶', '喜茶', '奈雪', '蜜雪', '茶百道'] },
  { label: '外卖', keywords: ['外卖', '饿了么', '美团', '点餐'] },
  { label: '咖啡', keywords: ['咖啡', '瑞幸', '星巴克'] },
  { label: '打车', keywords: ['打车', '滴滴', '出租', '顺风车'] },
  { label: '便利店', keywords: ['便利店', '全家', '罗森', '711'] },
  { label: '地铁', keywords: ['地铁', '公交', '高铁', '轻轨'] },
];

module.exports = {
  AI_LOG_COLLECTION,
  BILL_COLLECTION,
  DEFAULT_MODEL,
  EMPTY_TOKEN_USAGE,
  ANALYSIS_CATEGORIES,
  HFR_KEYWORDS,
};
