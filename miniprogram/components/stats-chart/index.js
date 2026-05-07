const echarts = require('../../lib/echarts');

Component({
  properties: {
    title: {
      type: String,
      value: '',
    },
    subtitle: {
      type: String,
      value: '',
    },
    option: {
      type: Object,
      value: null,
    },
    height: {
      type: Number,
      value: 520,
    },
    emptyText: {
      type: String,
      value: '暂无数据',
    },
  },

  data: {
    ec: {
      lazyLoad: true,
    },
  },

  lifetimes: {
    attached() {
      this.chart = null;
      this.initChart = this.initChart.bind(this);
      this.setData({
        ec: {
          lazyLoad: true,
          onInit: this.initChart,
        },
      });
    },

    detached() {
      if (this.chart) {
        this.chart.dispose();
        this.chart = null;
      }
    },
  },

  observers: {
    option() {
      this.renderChart();
    },
  },

  methods: {
    initChart(canvas, width, height, dpr) {
      this.chart = echarts.init(canvas, null, {
        width,
        height,
        devicePixelRatio: dpr,
      });
      canvas.setChart(this.chart);
      this.renderChart();
      return this.chart;
    },

    renderChart() {
      if (!this.chart || !this.data.option) return;
      this.chart.setOption(this.data.option, true);
    },
  },
});
