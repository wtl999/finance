const auth = require('../../services/auth');
const aiAnalyzeService = require('../../services/aiAnalyze');
const { ROUTES, go } = require('../../utils/route');
const { formatMonth, formatMoney } = require('../../utils/format');

const buildTrendOption = (trend = {}) => ({
  backgroundColor: 'transparent',
  color: ['#fb7185', '#34d399'],
  animationDuration: 900,
  animationEasing: 'cubicOut',
  tooltip: {
    trigger: 'axis',
    backgroundColor: '#0f172a',
    borderColor: 'rgba(148, 163, 184, 0.18)',
    textStyle: {
      color: '#e2e8f0',
    },
  },
  legend: {
    top: 4,
    textStyle: {
      color: '#94a3b8',
    },
  },
  grid: {
    left: 16,
    right: 16,
    top: 44,
    bottom: 18,
    containLabel: true,
  },
  xAxis: {
    type: 'category',
    data: trend.xAxis || [],
    axisLine: {
      lineStyle: {
        color: 'rgba(148, 163, 184, 0.25)',
      },
    },
    axisTick: {
      show: false,
    },
    axisLabel: {
      color: '#94a3b8',
    },
  },
  yAxis: {
    type: 'value',
    axisLine: {
      lineStyle: {
        color: 'rgba(148, 163, 184, 0.25)',
      },
    },
    axisTick: {
      show: false,
    },
    axisLabel: {
      color: '#94a3b8',
    },
    splitLine: {
      lineStyle: {
        color: 'rgba(148, 163, 184, 0.12)',
      },
    },
  },
  series: [
    {
      name: '支出',
      type: 'line',
      smooth: true,
      symbolSize: 6,
      lineStyle: {
        width: 3,
        color: '#fb7185',
      },
      itemStyle: {
        color: '#fb7185',
      },
      areaStyle: {
        color: 'rgba(251, 113, 133, 0.14)',
      },
      data: trend.expense || [],
    },
    {
      name: '收入',
      type: 'line',
      smooth: true,
      symbolSize: 6,
      lineStyle: {
        width: 3,
        color: '#34d399',
      },
      itemStyle: {
        color: '#34d399',
      },
      areaStyle: {
        color: 'rgba(52, 211, 153, 0.12)',
      },
      data: trend.income || [],
    },
  ],
});

const formatRate = (value = 0) => {
  const rate = Number(value || 0);
  const percent = `${Math.abs(rate * 100).toFixed(0)}%`;
  if (rate > 0) return `+${percent}`;
  if (rate < 0) return `-${percent}`;
  return '0%';
};

const pressureLabel = (value = 'low') => {
  if (value === 'high') return '高';
  if (value === 'medium') return '中';
  return '低';
};

const mapSummaryCards = (summary = {}, budget = {}) => [
  {
    label: '支出',
    value: `¥${formatMoney(summary.totalExpense || 0)}`,
    desc: `${summary.expenseCount || 0} 笔`,
  },
  {
    label: '收入',
    value: `¥${formatMoney(summary.totalIncome || 0)}`,
    desc: `${summary.incomeCount || 0} 笔`,
  },
  {
    label: '净额',
    value: `¥${formatMoney(summary.netAmount || 0)}`,
    desc: summary.netAmount >= 0 ? '结余' : '超支',
  },
  {
    label: '预算预测',
    value: `¥${formatMoney(budget.forecastExpense || 0)}`,
    desc: `${pressureLabel(budget.pressure)}压力`,
  },
];

Page({
  data: {
    loading: false,
    periodType: 'month',
    month: formatMonth(new Date()),
    analysis: {
      ui: {},
    },
    summaryCards: [],
    trendOption: null,
    anomalies: [],
    categoryChanges: [],
    highFrequency: [],
    actionItems: [],
    rangeLabel: '',
  },

  onShow() {
    if (!auth.isLoggedIn()) {
      go(ROUTES.login, 'reLaunch');
      return;
    }

    this.loadAnalysis();
  },

  onPullDownRefresh() {
    this.loadAnalysis(true);
  },

  async loadAnalysis(fromRefresh = false) {
    this.setData({ loading: true });

    try {
      const result = await aiAnalyzeService.analyzeBills({
        periodType: this.data.periodType,
        month: this.data.month,
      });

      const data = result.data || {};
      const analysis = data.analysis || { ui: {} };

      this.setData({
        analysis: {
          ...analysis,
          ui: analysis.ui || {},
          periodType: data.periodType || this.data.periodType,
          range: data.range,
          summary: data.summary,
          trend: data.trend,
          categoryTotals: data.categoryTotals,
          categoryChanges: data.categoryChanges,
          anomalies: data.anomalies,
          highFrequency: data.highFrequency,
          budgetForecast: data.budgetForecast,
        },
        summaryCards: mapSummaryCards(data.summary || {}, data.budgetForecast || {}),
        trendOption: buildTrendOption(data.trend || {}),
        anomalies: (analysis?.anomalies || data.anomalies || []).map((item) => ({
          ...item,
          severityText: item.severity === 'high' ? '高' : item.severity === 'medium' ? '中' : '低',
        })),
        categoryChanges: (data.categoryChanges || []).map((item) => ({
          ...item,
          changeRateText: formatRate(item.changeRate || 0),
        })),
        highFrequency: analysis?.highFrequency || data.highFrequency || [],
        actionItems: analysis?.actionItems || [],
        rangeLabel: data.range?.label || '',
      });
    } catch (error) {
      wx.showToast({
        title: 'AI 分析失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
      if (fromRefresh) {
        wx.stopPullDownRefresh();
      }
    }
  },

  handlePeriodChange(event) {
    const value = event.currentTarget.dataset.value;
    if (!value || value === this.data.periodType) return;

    this.setData(
      {
        periodType: value,
      },
      () => {
        this.loadAnalysis();
      },
    );
  },

  handleMonthChange(event) {
    this.setData(
      {
        month: event.detail.value,
      },
      () => {
        if (this.data.periodType === 'month') {
          this.loadAnalysis();
        }
      },
    );
  },

  handleAnalyze() {
    this.loadAnalysis();
  },
});
