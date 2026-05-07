const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const classify = (text = '') => {
  const value = String(text).toLowerCase();

  const incomeKeywords = ['工资', 'salary', '收入', '报销', '退款'];
  const categoryMap = [
    { keywords: ['餐', '饭', 'coffee', '咖啡', '奶茶', '外卖'], category: '餐饮' },
    { keywords: ['地铁', '公交', '打车', '出租', '停车', '加油'], category: '交通' },
    { keywords: ['商场', '淘宝', '京东', '购物', '衣服', '鞋'], category: '购物' },
    { keywords: ['房租', '租金', '物业', '水电'], category: '住房' },
    { keywords: ['电影', '游戏', '演出', 'ktv'], category: '娱乐' },
    { keywords: ['医院', '药', '体检'], category: '医疗' },
    { keywords: ['书', '课程', '培训', '学费'], category: '教育' },
    { keywords: ['理财', '基金', '股票'], category: '理财' },
  ];

  const isIncome = incomeKeywords.some((keyword) => value.includes(keyword.toLowerCase()));
  const categoryHit = categoryMap.find((item) =>
    item.keywords.some((keyword) => value.includes(keyword.toLowerCase())),
  );

  return {
    type: isIncome ? 'income' : 'expense',
    category: categoryHit ? categoryHit.category : '其他',
    confidence: categoryHit ? 0.92 : 0.62,
    reason: categoryHit ? `命中关键词：${categoryHit.category}` : '未命中固定分类，回退到其他',
  };
};

exports.main = async (event) => {
  const action = event.action || 'classify';
  const data = event.data || {};

  if (action === 'classify') {
    return {
      success: true,
      data: classify(data.text || ''),
    };
  }

  return {
    success: false,
    message: 'unknown action',
  };
};
