const auth = require('../../services/auth');
const billService = require('../../services/bill');
const reportService = require('../../services/report');
const categoryService = require('../../services/category');
const { ROUTES, go } = require('../../utils/route');
const { formatMonth } = require('../../utils/format');
const { aggregateStats } = require('../../utils/stats');
const { createPieOption, createTrendOption, createBarOption } = require('../../utils/chart');
const { getBillCategories } = require('../../utils/category');

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
    categories: getBillCategories(auth.getCachedUser()),
  },

  async onShow() {
    if (!auth.isLoggedIn()) {
      go(ROUTES.login, 'reLaunch');
      return;
    }

    const user = auth.getCachedUser();
    if (user?.billCategories) {
      this.setData({ categories: getBillCategories(user) });
    } else {
      const result = await categoryService.getBillCategories().catch(() => null);
      if (result?.success && result.data?.user) {
        this.setData({ categories: getBillCategories(result.data.user) });
      }
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
      const stats = aggregateStats(bills, { month: this.data.month });

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
          xAxis: stats.trend.xAxis,
          expense: stats.trend.expense,
          income: stats.trend.income,
        }),
        monthlyOption: createBarOption({
          title: '月趋势',
          xAxis: stats.periodTrend.xAxis,
          expense: stats.periodTrend.expense,
          income: stats.periodTrend.income,
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
    this.setData({ month: event.detail.value });
    this.loadStats();
  },

  handleGoReport() {
    go(ROUTES.report, 'navigateTo');
  },
});
