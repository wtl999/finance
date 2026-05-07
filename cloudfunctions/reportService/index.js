const cloud = require('wx-server-sdk');
const { normalizeDate, summarizeBills } = require('../shared');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const getOpenId = () => cloud.getWXContext().OPENID;

const buildAdvice = (summary) => {
  if ((summary.totalExpense || 0) > (summary.totalIncome || 0)) {
    return '本月支出高于收入，优先控制高频小额消费。';
  }

  if ((summary.totalCount || 0) < 5) {
    return '本月记录较少，建议继续保持手动记账习惯。';
  }

  return '本月现金流健康，可以继续观察分类占比。';
};

const generate = async (data = {}) => {
  const month = data.month || normalizeDate(new Date()).slice(0, 7);
  const result = await db.collection('bills').where({
    openid: getOpenId(),
    month,
  }).get();

  const summary = summarizeBills(result.data || [], normalizeDate(new Date()));
  const topNames = summary.topCategories.map((item) => item.name).join('、') || '暂无';

  return {
    success: true,
    data: {
      month,
      summaryText: `本月共 ${summary.totalCount} 笔，支出 ¥${summary.totalExpense.toFixed(2)}，收入 ¥${summary.totalIncome.toFixed(2)}。`,
      adviceText: buildAdvice(summary),
      tagsText: topNames,
      detail: summary,
      prompt: data.prompt || '',
    },
  };
};

exports.main = async (event) => {
  const action = event.action || 'generate';
  const data = event.data || {};

  if (action === 'generate') return generate(data);

  return {
    success: false,
    message: 'unknown action',
  };
};
