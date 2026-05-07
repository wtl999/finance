const { ROUTES, go } = require('../../utils/route');

Component({
  properties: {
    hidden: {
      type: Boolean,
      value: false,
    },
  },

  methods: {
    handleTap() {
      go(ROUTES.add, 'navigateTo');
    },
  },
});
