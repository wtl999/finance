const validateBillForm = (form) => {
  const amount = Number(form.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: '请输入正确金额' };
  }

  if (!form.category) {
    return { ok: false, message: '请选择分类' };
  }

  if (!form.date) {
    return { ok: false, message: '请选择日期' };
  }

  return { ok: true, message: '' };
};

module.exports = {
  validateBillForm,
};
