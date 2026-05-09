const API_BASE = '';
const $ = (id) => document.getElementById(id);

const state = {
  loggedIn: false,
  token: localStorage.getItem('finance_token') || '',
  query: {},
  submitting: false,
};

const formatDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseQuery = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    type: params.get('type') || 'expense',
    amount: params.get('amount') || '',
    remark: params.get('remark') || '',
  };
};

const request = async (path, body, token = state.token) => {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Request failed: ${response.status}`);
  }
  return data;
};

const setResult = (payload) => {
  $('resultCard').hidden = false;
  $('resultText').textContent = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
};

const syncView = () => {
  const { type, amount, remark } = state.query;
  $('billTypeText').textContent = type === 'income' ? '收入' : '支出';
  $('billAmountText').textContent = amount ? Number(amount).toFixed(2) : '-';
  $('billRemarkText').textContent = remark || '-';
  $('billDateText').textContent = formatDate(new Date());
  $('loginState').textContent = state.loggedIn ? '已登录' : '未登录';
  $('loginCard').hidden = state.loggedIn;
  $('actionCard').hidden = !state.loggedIn;
};

const loadSession = async () => {
  if (!state.token) return false;
  try {
    const result = await request('/api/functions/userSync', { action: 'sync', data: {} });
    if (result && result.success) {
      state.loggedIn = true;
      return true;
    }
  } catch (error) {
    state.token = '';
    localStorage.removeItem('finance_token');
  }
  return false;
};

const login = async (phoneNumber, password) => {
  const result = await request('/api/functions/login', {
    mode: 'password',
    phoneNumber,
    password,
    data: {
      nickname: phoneNumber,
    },
  }, '');

  if (!result || !result.success) {
    throw new Error(result?.message || '登录失败');
  }

  state.token = result.data.token || '';
  state.loggedIn = true;
  if (state.token) {
    localStorage.setItem('finance_token', state.token);
  }
  return result;
};

const createBill = async () => {
  if (state.submitting) return;
  state.submitting = true;
  $('submitButton').disabled = true;
  try {
    const payload = {
      action: 'create',
      data: {
        type: state.query.type === 'income' ? 'income' : 'expense',
        amount: Number(state.query.amount || 0),
        category: state.query.type === 'income' ? '收入' : '其他',
        merchant: '',
        remark: state.query.remark || '',
        date: formatDate(new Date()),
        source: 'h5',
      },
    };
    const result = await request('/api/functions/billService', payload);
    if (!result || !result.success) {
      throw new Error(result?.message || '记账失败');
    }
    setResult({
      success: true,
      message: '记账成功',
      bill: result.data,
    });
  } finally {
    state.submitting = false;
    $('submitButton').disabled = false;
  }
};

const init = async () => {
  state.query = parseQuery();
  syncView();

  $('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const phoneNumber = $('phoneNumber').value.trim();
    const password = $('password').value;
    if (!phoneNumber || !password) {
      setResult('请输入账号和密码');
      return;
    }
    try {
      $('loginButton').disabled = true;
      const result = await login(phoneNumber, password);
      setResult({ success: true, message: '登录成功' });
      syncView();
      if (result?.success) {
        await createBill();
      }
    } catch (error) {
      setResult(error.message || '登录失败');
    } finally {
      $('loginButton').disabled = false;
    }
  });

  $('submitButton').addEventListener('click', async () => {
    try {
      await createBill();
    } catch (error) {
      setResult(error.message || '记账失败');
    }
  });

  const loggedIn = await loadSession();
  syncView();
  if (loggedIn) {
    try {
      await createBill();
    } catch (error) {
      setResult(error.message || '自动记账失败');
    }
  } else {
    setResult('请先使用账号密码登录后继续记账');
  }
};

init();
