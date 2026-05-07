const cloud = require('wx-server-sdk');
const { createWorker } = require('tesseract.js');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const OCR_CACHE_COLLECTION = 'ocr_logs';

const ensureOcrCacheCollection = async () => {
  try {
    await db.createCollection(OCR_CACHE_COLLECTION);
  } catch (error) {
    return;
  }
};

const getOpenId = () => cloud.getWXContext().OPENID;

const normalizeText = (resp) => {
  if (!resp) return '';
  if (typeof resp === 'string') return resp.trim();
  if (typeof resp.text === 'string') return resp.text.trim();
  return '';
};

const normalizeLines = (text) =>
  String(text || '')
    .split(/\r?\n|\s{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);

const normalizeAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Number(amount.toFixed(2));
};

const normalizeDate = (value) => {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(text)) return text.slice(0, 10);
  return '';
};

const normalizeDateTime = (value) => {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text} 00:00`;
  return '';
};

const detectCategory = (text, source) => {
  const value = String(text || '').toLowerCase();
  const rules = [
    { keys: ['地铁', '公交', '打车', '出租', '停车', '出行'], category: '交通' },
    { keys: ['餐', '饭', '外卖', '咖啡', '奶茶', '美团', '饿了么'], category: '餐饮' },
    { keys: ['购物', '超市', '淘宝', '京东', '拼多多', '衣服'], category: '购物' },
    { keys: ['房租', '物业', '水电', '房贷', '租金'], category: '住房' },
    { keys: ['电影', '游戏', '演出', 'ktv'], category: '娱乐' },
    { keys: ['医院', '药店', '体检', '挂号'], category: '医疗' },
    { keys: ['培训', '课程', '学费', '教育'], category: '教育' },
    { keys: ['工资', '薪资', '报销', '收入', '退款'], category: '工资' },
    { keys: ['基金', '股票', '理财'], category: '理财' },
  ];

  if (source === 'meituan') return '餐饮';
  const hit = rules.find((rule) => rule.keys.some((key) => value.includes(key)));
  return hit ? hit.category : '其他';
};

const detectType = (text) => {
  const value = String(text || '');
  const incomeKeys = ['收入', '退款', '收款', '转入', '工资', '报销', '入账', '返钱'];
  return incomeKeys.some((key) => value.includes(key)) ? 'income' : 'expense';
};

const extractAmount = (lines, text) => {
  const candidates = [];
  const regex = /([0-9]+(?:\.[0-9]{1,2})?)(?=\s*(?:元|人民币|支付|收款|余额|$))/g;

  lines.forEach((line) => {
    let match;
    while ((match = regex.exec(line))) {
      candidates.push(Number(match[1]));
    }
  });

  if (!candidates.length) {
    let match;
    while ((match = regex.exec(text))) {
      candidates.push(Number(match[1]));
    }
  }

  return normalizeAmount(candidates.filter(Number.isFinite).sort((a, b) => a - b).pop() || 0);
};

const extractDateTime = (text) => {
  const value = String(text || '');
  const datetimeMatch = value.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})[日\s]+(\d{1,2})[:时](\d{1,2})/);
  if (datetimeMatch) {
    const year = datetimeMatch[1];
    const month = String(datetimeMatch[2]).padStart(2, '0');
    const day = String(datetimeMatch[3]).padStart(2, '0');
    const hour = String(datetimeMatch[4]).padStart(2, '0');
    const minute = String(datetimeMatch[5]).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  }

  const dateMatch = value.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})[日]?/);
  if (dateMatch) {
    const year = dateMatch[1];
    const month = String(dateMatch[2]).padStart(2, '0');
    const day = String(dateMatch[3]).padStart(2, '0');
    return `${year}-${month}-${day} 00:00`;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day} 00:00`;
};

const extractMerchant = (lines) => lines.find((line) => line.length >= 2 && line.length <= 24) || '';

const extractRemark = (lines) => lines.slice(0, 3).join(' ');

const parseBillDraft = ({ text, source }) => {
  const lines = normalizeLines(text);
  const joined = lines.join('\n');
  const amount = extractAmount(lines, joined);
  const type = detectType(joined);
  const category = detectCategory(joined, source);
  const merchant = extractMerchant(lines);
  const time = extractDateTime(joined);
  const date = normalizeDate(time);
  const remark = extractRemark(lines);

  return {
    parsedBill: {
      amount,
      type,
      category,
      merchant,
      remark,
      time,
      date,
      source: 'ocr',
      aiParsed: {
        source,
        lineCount: lines.length,
      },
    },
    confidence: amount > 0 ? 0.85 : 0.4,
    lines,
  };
};

const getCachedResult = async (cacheKey) => {
  try {
    await ensureOcrCacheCollection();
    const res = await db
      .collection(OCR_CACHE_COLLECTION)
      .where({
        openid: getOpenId(),
        cacheKey,
        status: 'done',
      })
      .limit(1)
      .get();

    return res.data[0] || null;
  } catch (error) {
    return null;
  }
};

const saveCache = async (doc) => {
  try {
    await ensureOcrCacheCollection();
    const now = db.serverDate();
    const payload = {
      ...doc,
      openid: getOpenId(),
      updatedAt: now,
    };

    if (doc._id) {
      await db.collection(OCR_CACHE_COLLECTION).doc(doc._id).update({
        data: payload,
      });
      return { ...payload, _id: doc._id };
    }

    const added = await db.collection(OCR_CACHE_COLLECTION).add({
      data: {
        ...payload,
        createdAt: now,
      },
    });

    return {
      ...payload,
      _id: added._id,
    };
  } catch (error) {
    return null;
  }
};

const resolveImageUrl = async (fileID) => {
  try {
    const res = await cloud.getTempFileURL({
      fileList: [fileID],
    });
    return res?.fileList?.[0]?.tempFileURL || fileID;
  } catch (error) {
    return fileID;
  }
};

let sharedWorker = null;
let sharedWorkerInit = null;

const getWorker = async () => {
  if (sharedWorker) return sharedWorker;
  if (!sharedWorkerInit) {
    sharedWorkerInit = (async () => {
      const worker = await createWorker({
        logger: () => null,
      });
      await worker.loadLanguage('chi_sim');
      await worker.initialize('chi_sim');
      return worker;
    })();
  }

  sharedWorker = await sharedWorkerInit;
  return sharedWorker;
};

const runTesseract = async (imagePath) => {
  const worker = await getWorker();
  const { data } = await worker.recognize(imagePath);
  return normalizeText(data?.text || '');
};

exports.main = async (event) => {
  const action = event.action || 'recognize';
  const data = event.data || {};

  if (action !== 'recognize') {
    return {
      success: false,
      errCode: 'OCR_UNKNOWN_ACTION',
      message: 'unknown action',
    };
  }

  const fileID = data.fileID || '';
  const fileHash = data.fileHash || '';
  const source = data.source || 'wechat';
  const cacheKey = `${source}:${fileHash || fileID}`;

  if (!fileID) {
    return {
      success: false,
      errCode: 'OCR_NO_FILE',
      message: '请先上传截图',
    };
  }

  const cached = await getCachedResult(cacheKey);
  if (cached) {
    return {
      success: true,
      data: {
        ...cached.result,
        cacheHit: true,
        cacheKey,
      },
    };
  }

  try {
    const imageUrl = await resolveImageUrl(fileID);
    const rawText = data.mockText || (await runTesseract(imageUrl));

    if (!rawText) {
      await saveCache({
        cacheKey,
        fileID,
        fileHash,
        source,
        status: 'failed',
        errorMessage: 'OCR_EMPTY_RESULT',
      });

      return {
        success: false,
        errCode: 'OCR_EMPTY_RESULT',
        message: '没有识别到有效文本',
      };
    }

    const fallback = parseBillDraft({
      text: rawText,
      source,
    });

    const result = {
      source,
      cacheHit: false,
      cacheKey,
      fileID,
      fileHash,
      rawText,
      textLines: fallback.lines,
      parsedBill: fallback.parsedBill,
      confidence: fallback.confidence,
      provider: data.mockText ? 'mock' : 'tesseract',
      model: 'tesseract.js',
      ocrError: '',
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      aiResult: null,
    };

    const cachedDoc = await saveCache({
      cacheKey,
      fileID,
      fileHash,
      source,
      status: 'done',
      result,
      rawText,
      confidence: result.confidence,
    });

    return {
      success: true,
      data: {
        ...result,
        _id: cachedDoc?._id || '',
      },
    };
  } catch (error) {
    await saveCache({
      cacheKey,
      fileID,
      fileHash,
      source,
      status: 'failed',
      errorMessage: error?.message || 'OCR_FAILED',
    }).catch(() => null);

    return {
      success: false,
      errCode: 'OCR_FAILED',
      message: 'OCR识别失败',
      detail: error?.message || String(error),
    };
  }
};
