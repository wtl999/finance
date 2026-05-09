const MINI_APP_ID = 'wx4d7ca2f1e2eafe6b';
const MINI_PATH = 'miniprogram/pages/index/index';

const $ = (id) => document.getElementById(id);

const state = {
  token: localStorage.getItem('finance_token') || '',
  query: {},
  loggedIn: false,
  working: false,
  billResult: null,
};

const parseQuery = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    type: params.get('type') || 'expense',
    amount: params.get('amount') || '',
    remark: params.get('remark') || '',
  };
};

const today = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const request = async (path, body, token = state.token) => {
  const response = await fetch(path, {
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

const setMessage = (message) => {
  $('messageText').textContent = message;
  $('errorPanel').hidden = false;
};

const syncMiniProgramLink = () => {
  const link = $('miniProgramLink');
  const query = new URLSearchParams({
    type: state.query.type || 'expense',
    amount: state.query.amount || '',
    remark: state.query.remark || '',
    date: today(),
  }).toString();
  link.href = `weixin://dl/business/?appid=${MINI_APP_ID}&path=${encodeURIComponent(`${MINI_PATH}?${query}`)}`;
};

const renderBillState = (result) => {
  $('billMeta').textContent = [
    `类型：${state.query.type === 'income' ? '收入' : '支出'}`,
    `金额：${state.query.amount || '-'}`,
    `备注：${state.query.remark || '-'}`,
    `日期：${today()}`,
    result ? `状态：${result.success ? '记账成功' : '记账失败'}` : '状态：待处理',
  ].join(' / ');
  $('statePanel').hidden = false;
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

const login = async () => {
  const phoneNumber = $('phoneNumber').value.trim();
  const password = $('password').value;
  if (!phoneNumber || !password) {
    throw new Error('请输入账号和密码');
  }

  const result = await request('/api/functions/login', {
    mode: 'password',
    phoneNumber,
    password,
    data: { nickname: phoneNumber },
  }, '');

  if (!result || !result.success) {
    throw new Error(result?.message || '登录失败');
  }

  state.token = result.data.token || '';
  state.loggedIn = true;
  localStorage.setItem('finance_token', state.token);
  return result;
};

const createBill = async () => {
  const payload = {
    action: 'create',
    data: {
      type: state.query.type === 'income' ? 'income' : 'expense',
      amount: Number(state.query.amount || 0),
      category: state.query.type === 'income' ? '收入' : '其他',
      merchant: '',
      remark: state.query.remark || '',
      date: today(),
      source: 'h5',
    },
  };

  const result = await request('/api/functions/billService', payload);
  if (!result || !result.success) {
    throw new Error(result?.message || '记账失败');
  }

  state.billResult = result.data;
  renderBillState({ success: true });
  setMessage('记账完成');
  return result;
};

const showLoggedInView = () => {
  $('loginPanel').hidden = true;
  $('statePanel').hidden = false;
  syncMiniProgramLink();
};

const run = async () => {
  state.query = parseQuery();
  syncMiniProgramLink();

  $('loginButton').addEventListener('click', async () => {
    if (state.working) return;
    state.working = true;
    $('loginButton').disabled = true;
    try {
      await login();
      showLoggedInView();
      await createBill();
    } catch (error) {
      setMessage(error.message || '登录失败');
    } finally {
      state.working = false;
      $('loginButton').disabled = false;
    }
  });

  const loggedIn = await loadSession();
  if (loggedIn) {
    showLoggedInView();
    try {
      await createBill();
    } catch (error) {
      renderBillState({ success: false });
      setMessage(error.message || '自动记账失败');
    }
  } else {
    $('loginPanel').hidden = false;
    $('statePanel').hidden = true;
  }

  syncMiniProgramLink();
};

run();
