const darkPalette = ['#38bdf8', '#22c55e', '#f59e0b', '#a78bfa', '#fb7185', '#14b8a6', '#60a5fa'];

const baseGrid = {
  left: 16,
  right: 16,
  top: 48,
  bottom: 18,
  containLabel: true,
};

const baseAxisStyle = {
  axisLine: {
    lineStyle: {
      color: 'rgba(148, 163, 184, 0.24)',
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
};

const createPieOption = (series = [], title = '') => ({
  backgroundColor: 'transparent',
  color: darkPalette,
  animationDuration: 900,
  animationEasing: 'cubicOut',
  tooltip: {
    trigger: 'item',
    backgroundColor: '#0f172a',
    borderColor: 'rgba(148, 163, 184, 0.16)',
    textStyle: {
      color: '#e2e8f0',
    },
    formatter: '{b}<br/>{c} 元 ({d}%)',
  },
  legend: {
    bottom: 0,
    textStyle: {
      color: '#94a3b8',
    },
  },
  series: [
    {
      name: title,
      type: 'pie',
      radius: ['42%', '68%'],
      center: ['50%', '44%'],
      avoidLabelOverlap: true,
      label: {
        color: '#e2e8f0',
      },
      labelLine: {
        lineStyle: {
          color: 'rgba(148, 163, 184, 0.35)',
        },
      },
      itemStyle: {
        borderColor: '#0b1220',
        borderWidth: 2,
      },
      data: series,
    },
  ],
});

const createTrendOption = ({ xAxis = [], expense = [], income = [], title = '趋势' }) => ({
  backgroundColor: 'transparent',
  color: darkPalette,
  animationDuration: 900,
  animationEasing: 'cubicOut',
  tooltip: {
    trigger: 'axis',
    backgroundColor: '#0f172a',
    borderColor: 'rgba(148, 163, 184, 0.16)',
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
  grid: baseGrid,
  xAxis: {
    type: 'category',
    data: xAxis,
    ...baseAxisStyle,
  },
  yAxis: {
    type: 'value',
    ...baseAxisStyle,
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
        color: 'rgba(251, 113, 133, 0.16)',
      },
      data: expense,
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
      data: income,
    },
  ],
  title: {
    text: title,
    textStyle: {
      color: '#f8fafc',
      fontSize: 12,
    },
    left: 8,
    top: 8,
  },
});

const createBarOption = ({ xAxis = [], expense = [], income = [], title = '月趋势' }) => ({
  backgroundColor: 'transparent',
  color: darkPalette,
  animationDuration: 900,
  animationEasing: 'cubicOut',
  tooltip: {
    trigger: 'axis',
    axisPointer: {
      type: 'shadow',
    },
    backgroundColor: '#0f172a',
    borderColor: 'rgba(148, 163, 184, 0.16)',
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
  grid: baseGrid,
  xAxis: {
    type: 'category',
    data: xAxis,
    ...baseAxisStyle,
  },
  yAxis: {
    type: 'value',
    ...baseAxisStyle,
  },
  series: [
    {
      name: '支出',
      type: 'bar',
      barWidth: '42%',
      itemStyle: {
        borderRadius: [8, 8, 0, 0],
        color: '#fb7185',
      },
      data: expense,
    },
    {
      name: '收入',
      type: 'bar',
      barWidth: '42%',
      itemStyle: {
        borderRadius: [8, 8, 0, 0],
        color: '#34d399',
      },
      data: income,
    },
  ],
  title: {
    text: title,
    textStyle: {
      color: '#f8fafc',
      fontSize: 12,
    },
    left: 8,
    top: 8,
  },
});

module.exports = {
  createPieOption,
  createTrendOption,
  createBarOption,
};
