const https = require('node:https');

const DEFAULT_APPID = 'wx4d7ca2f1e2eafe6b';

const exchangeCodeForSession = (code) =>
  new Promise((resolve, reject) => {
    const appid = String(process.env.WECHAT_APPID || DEFAULT_APPID).trim();
    const secret = String(process.env.WECHAT_SECRET || '').trim();

    if (!appid || !secret) {
      reject(new Error('missing WECHAT_APPID or WECHAT_SECRET'));
      return;
    }

    const url =
      `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appid)}` +
      `&secret=${encodeURIComponent(secret)}` +
      `&js_code=${encodeURIComponent(code)}` +
      `&grant_type=authorization_code`;

    https
      .get(url, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const json = JSON.parse(body || '{}');
            if (!json.openid) {
              reject(new Error(json.errmsg || 'failed to exchange wx login code'));
              return;
            }

            resolve({
              appid,
              openid: json.openid,
              unionid: json.unionid || '',
              sessionKey: json.session_key || '',
            });
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });

module.exports = {
  exchangeCodeForSession,
};
