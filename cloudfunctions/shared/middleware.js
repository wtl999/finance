const { checkAiPermission, consumeAiQuota } = require('./membership');

const withAiPermission = async ({
  db,
  openid,
  need = 1,
  now = new Date(),
  serverNow = now,
  deniedMessage = 'AI 次数不足，请开通会员',
  handler,
}) => {
  const permission = await checkAiPermission({
    db,
    openid,
    need,
    now,
    serverNow,
  });

  if (!permission.allowed) {
    return {
      success: false,
      errCode: permission.reason,
      message: deniedMessage,
      data: {
        user: permission.user,
      },
    };
  }

  const result = await handler({
    permission,
  });

  if (result && result.success !== false) {
    await consumeAiQuota({
      db,
      openid,
      amount: need,
      now,
      serverNow,
    });
  }

  return result;
};

module.exports = {
  withAiPermission,
};
