const express = require('express');
const fs = require('fs');
const History = require('../models/History');

const originalDownload = express.response.download;

express.response.download = function (path, filename, options, fn) {
  const req = this.req;
  
  if (req && req.user) {
    // Extract tool name from the URL path (e.g., /api/merge -> merge)
    const toolName = req.originalUrl.split('/').pop().split('?')[0];
    
    try {
      const stats = fs.statSync(path);
      History.create({
        userId: req.user.id,
        toolName: toolName,
        fileName: filename || 'result.pdf',
        fileSize: stats.size,
        status: 'success'
      }).catch(err => console.error('Failed to save History:', err));
    } catch (err) {
      console.error('Failed to stat file for History:', err);
    }
  }

  return originalDownload.apply(this, arguments);
};
