const auth = require('../../services/auth');
const billService = require('../../services/bill');
const reportService = require('../../services/report');
const { ROUTES, go } = require('../../utils/route');
const { formatMonth } = require('../../utils/format');
const { aggregateStats, getMonthRange } = require('../../utils/stats');
const { createPieOption, createTrendOption, createBarOption } = require('../../utils/chart');

Page({
  data: {
    loading: false,
    month: formatMonth(new Date()),
    summaryCards: [],
    categoryList: [],
    insight: null,
    categoryOption: null,
    weeklyOption: null,
    monthlyOption: null,
  },

  onShow() {
    if (!auth.isLoggedIn()) {
      go(ROUTES.login, 'reLaunch');
      return;
    }

    this.loadStats();
  },

  onPullDownRefresh() {
    this.loadStats(true);
  },

  async loadStats(fromRefresh = false) {
    this.setData({ loading: true });

    try {
      const [billResult, reportResult] = await Promise.all([
        billService.getBillPage({
          month: this.data.month,
          page: 1,
          pageSize: 500,
        }),
        reportService.generateMonthlyReport({
          month: this.data.month,
        }),
      ]);

      const bills = billResult.data?.list || [];
      const stats = aggregateStats(bills, this.data.month);

      this.setData({
        summaryCards: stats.summaryCards,
        categoryList: stats.categoryList,
        insight: reportResult.data || stats.insights,
        categoryOption: createPieOption(
          stats.categoryList.map((item) => ({
            name: item.name,
            value: item.value,
          })),
          '分类占比',
        ),
        weeklyOption: createTrendOption({
          title: '周趋势',
          xAxis: stats.weeklyTrend.xAxis,
          expense: stats.weeklyTrend.expense,
          income: stats.weeklyTrend.income,
        }),
        monthlyOption: createBarOption({
          title: '月趋势',
          xAxis: stats.monthlyTrend.xAxis,
          expense: stats.monthlyTrend.expense,
          income: stats.monthlyTrend.income,
        }),
      });
    } catch (error) {
      wx.showToast({
        title: '统计加载失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
      if (fromRefresh) {
        wx.stopPullDownRefresh();
      }
    }
  },

  handleMonthChange(event) {
    this.setData({
      month: event.detail.value,
    });
    this.loadStats();
  },

  handleGoReport() {
    go(ROUTES.report, 'navigateTo');
  },
});
