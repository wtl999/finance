// Route registry: each business capability is mounted independently.
const express = require('express');
const authRoutes = require('./auth');
const billRoutes = require('./bills');
const categoryRoutes = require('./categories');
const reportRoutes = require('./reports');
const aiRoutes = require('./ai');
const ocrRoutes = require('./ocr');

const registerRoutes = (app) => {
  const apiRouter = express.Router();

  apiRouter.use('/functions', authRoutes);
  apiRouter.use('/functions/billService', billRoutes);
  apiRouter.use('/functions/categoryService', categoryRoutes);
  apiRouter.use('/functions/reportService', reportRoutes);
  apiRouter.use('/functions', aiRoutes);
  apiRouter.use('/ocr', ocrRoutes);

  app.use('/api', apiRouter);
};

module.exports = {
  registerRoutes,
};
