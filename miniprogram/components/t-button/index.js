Component({
  properties: {
    theme: {
      type: String,
      value: 'primary',
    },
    block: {
      type: Boolean,
      value: false,
    },
    disabled: {
      type: Boolean,
      value: false,
    },
    loading: {
      type: Boolean,
      value: false,
    },
    text: {
      type: String,
      value: '',
    },
  },

  methods: {
    handleTap(event) {
      if (this.data.disabled || this.data.loading) {
        return;
      }
      this.triggerEvent('tap', event.detail, {});
    },
  },
});
