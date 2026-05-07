Component({
  properties: {
    ec: {
      type: Object,
      value: null,
    },
  },

  lifetimes: {
    ready() {
      const ec = this.data.ec;
      if (!ec || typeof ec.onInit !== 'function') {
        return;
      }

      const query = this.createSelectorQuery();
      query.select('.ec-canvas').boundingClientRect((rect) => {
        const canvas = {
          setChart() {},
        };
        const dpr = (wx.getSystemInfoSync && wx.getSystemInfoSync().pixelRatio) || 1;
        ec.onInit(canvas, rect?.width || 0, rect?.height || 0, dpr);
      }).exec();
    },
  },
});
