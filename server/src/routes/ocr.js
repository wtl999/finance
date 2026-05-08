// OCR routes: receipt image parsing is a standalone endpoint.
const express = require('express');
const fs = require('node:fs');
const multer = require('multer');
const os = require('node:os');
const path = require('node:path');
const { requireAuth } = require('../middlewares/auth');
const { recognizeImage } = require('../services/ocrService');

const upload = multer({ dest: path.join(os.tmpdir(), 'finance-uploads') });
const router = express.Router();

router.post('/recognize', requireAuth, upload.single('file'), async (req, res) => {
  const file = req.file;
  const source = String(req.body?.source || 'wechat');

  if (!file) {
    return res.status(400).json({ success: false, message: 'missing file' });
  }

  const tempTarget = `${file.path}.png`;
  try {
    fs.renameSync(file.path, tempTarget);
    const result = await recognizeImage(tempTarget, source);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'OCR识别失败',
      detail: error?.message || String(error),
    });
  } finally {
    [file?.path, tempTarget].forEach((target) => {
      if (target && fs.existsSync(target)) {
        try {
          fs.unlinkSync(target);
        } catch (error) {
          void error;
        }
      }
    });
  }
});

module.exports = router;
