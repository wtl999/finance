const createStubChart = () => ({
  setOption() {},
  dispose() {},
});

module.exports = {
  init() {
    return createStubChart();
  },
};
