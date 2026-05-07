const CATEGORY_TONES = ['orange', 'blue', 'violet', 'emerald', 'pink', 'cyan', 'amber', 'green', 'slate', 'gray'];

const DEFAULT_BILL_CATEGORIES = {
  expense: [
    { value: '餐饮', label: '餐饮', tone: 'orange', keywords: ['餐', '饭', '外卖', '咖啡', '奶茶', '早餐', '午餐', '晚餐'] },
    { value: '交通', label: '交通', tone: 'blue', keywords: ['地铁', '公交', '打车', '出租', '停车', '加油', '交通'] },
    { value: '购物', label: '购物', tone: 'violet', keywords: ['购物', '淘宝', '京东', '买衣服', '商场', '超市'] },
    { value: '居住', label: '居住', tone: 'emerald', keywords: ['房租', '物业', '水电', '燃气', '房贷', '租金'] },
    { value: '娱乐', label: '娱乐', tone: 'pink', keywords: ['电影', '游戏', '演出', 'KTV', '娱乐', '直播'] },
    { value: '医疗', label: '医疗', tone: 'cyan', keywords: ['医院', '药', '体检', '诊所', '医疗'] },
    { value: '教育', label: '教育', tone: 'amber', keywords: ['学习', '课程', '培训', '学费', '教育'] },
    { value: '工资', label: '工资', tone: 'green', keywords: ['工资', '薪资', '薪水', '奖金', '报销'] },
    { value: '理财', label: '理财', tone: 'slate', keywords: ['理财', '基金', '股票', '投资', '利息'] },
    { value: '其他', label: '其他', tone: 'gray', keywords: ['其他'] },
  ],
  income: [
    { value: '工资', label: '工资', tone: 'green', keywords: ['工资', '薪资', '薪水', '底薪'] },
    { value: '奖金', label: '奖金', tone: 'emerald', keywords: ['奖金', '提成', '绩效', '红包'] },
    { value: '退款', label: '退款', tone: 'cyan', keywords: ['退款', '退货', '返现', '报销'] },
    { value: '理财收益', label: '理财收益', tone: 'violet', keywords: ['理财', '基金', '股票', '收益', '分红', '利息'] },
    { value: '其他收入', label: '其他收入', tone: 'slate', keywords: ['收入', '进账', '转账'] },
  ],
};

const toText = (value) => String(value ?? '').trim();

const buildValue = (label, type = 'expense') => {
  const prefix = type === 'income' ? 'income' : 'expense';
  const safe = toText(label)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20);

  return `${prefix}-${safe || 'category'}-${Date.now().toString(36)}`;
};

const normalizeCategoryItem = (item, type = 'expense', index = 0) => {
  if (typeof item === 'string') {
    const label = toText(item) || '其他';
    return {
      value: label,
      label,
      tone: CATEGORY_TONES[index % CATEGORY_TONES.length],
      keywords: [label],
    };
  }

  const label = toText(item?.label || item?.value) || '其他';
  const value = toText(item?.value) || label;
  const tone = CATEGORY_TONES.includes(item?.tone) ? item.tone : (item?.tone || CATEGORY_TONES[index % CATEGORY_TONES.length]);
  const keywords = Array.isArray(item?.keywords) && item.keywords.length
    ? item.keywords.map(toText).filter(Boolean)
    : [label];

  return {
    value,
    label,
    tone,
    keywords,
  };
};

const normalizeBillCategories = (categories = DEFAULT_BILL_CATEGORIES) => {
  const source = categories && typeof categories === 'object' ? categories : {};

  return {
    expense: (Array.isArray(source.expense) ? source.expense : DEFAULT_BILL_CATEGORIES.expense)
      .map((item, index) => normalizeCategoryItem(item, 'expense', index)),
    income: (Array.isArray(source.income) ? source.income : DEFAULT_BILL_CATEGORIES.income)
      .map((item, index) => normalizeCategoryItem(item, 'income', index)),
  };
};

const cloneBillCategories = (categories = DEFAULT_BILL_CATEGORIES) => normalizeBillCategories(categories);

const getBillCategories = (user = null) => {
  const categories = user?.billCategories || user?.categories || DEFAULT_BILL_CATEGORIES;
  return normalizeBillCategories(categories);
};

const getCategoryList = (categories, type = 'expense') => {
  const normalized = normalizeBillCategories(categories);
  return type === 'income' ? normalized.income : normalized.expense;
};

const getCategoryMeta = (category, categories = DEFAULT_BILL_CATEGORIES, type = 'expense') => {
  const categoryValue = toText(category);
  const normalized = getCategoryList(categories, type);
  const found = normalized.find((item) => item.value === categoryValue || item.label === categoryValue);

  if (found) return found;

  const fallbackLabel = categoryValue || '其他';
  return {
    value: fallbackLabel,
    label: fallbackLabel,
    tone: type === 'income' ? 'green' : 'gray',
    keywords: [fallbackLabel],
  };
};

const getCategoryOptions = (categories, type = 'expense') => getCategoryList(categories, type);

const getDefaultCategoryValue = (categories, type = 'expense') => {
  const list = getCategoryList(categories, type);
  return list[0]?.value || '';
};

const hasCategoryValue = (categories, type = 'expense', value = '') => {
  const list = getCategoryList(categories, type);
  return list.some((item) => item.value === value || item.label === value);
};

const resolveCategoryValue = (categories, type = 'expense', value = '') => {
  if (value && hasCategoryValue(categories, type, value)) {
    return value;
  }

  return getDefaultCategoryValue(categories, type);
};

const getCategoryTypes = () => [
  { label: '支出', value: 'expense', desc: '日常消费、固定支出' },
  { label: '收入', value: 'income', desc: '工资、奖金、退款等' },
];

module.exports = {
  CATEGORY_TONES,
  DEFAULT_BILL_CATEGORIES,
  buildValue,
  cloneBillCategories,
  getBillCategories,
  getCategoryList,
  getCategoryMeta,
  getCategoryOptions,
  getCategoryTypes,
  getDefaultCategoryValue,
  hasCategoryValue,
  normalizeBillCategories,
  normalizeCategoryItem,
  resolveCategoryValue,
};
