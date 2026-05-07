const https = require('https');

const requestJson = ({ apiKey, body, host = 'api.deepseek.com', path = '/chat/completions', timeout = 20000 }) =>
  new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        path,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout,
      },
      (res) => {
        let raw = '';

        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
              return;
            }

            reject(
              new Error(
                parsed?.error?.message || parsed?.message || `DeepSeek API error: ${res.statusCode}`,
              ),
            );
          } catch (error) {
            reject(new Error(`DeepSeek response parse failed: ${error.message}`));
          }
        });
      },
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('DeepSeek request timeout'));
    });

    req.write(JSON.stringify(body));
    req.end();
  });

module.exports = {
  requestJson,
};
