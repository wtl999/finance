Component({
  properties: {
    action: {
      type: String,
      value: '',
    },
    label: {
      type: String,
      value: '',
    },
    hint: {
      type: String,
      value: '',
    },
    tone: {
      type: String,
      value: 'cyan',
    },
  },

  methods: {
    handleTap() {
      this.triggerEvent(
        'tap',
        {
          action: this.data.action,
        },
        {},
      );
    },
  },
});
