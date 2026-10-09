require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDatabase = require('./config/database');
const apiRoutes = require('./routers');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();
const port = process.env.PORT || 5000;

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://connect.facebook.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'https://www.facebook.com'],
      connectSrc: ["'self'", 'https://www.facebook.com', 'https://connect.facebook.net']
    }
  }
}));
app.use(cors({ origin: process.env.CLIENT_URL || true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => res.json({ status: 'ok', name: 'GBN Supply Chain' }));
app.use('/api', apiRoutes);

const distPath = path.resolve(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(distPath, 'index.html'), (error) => {
    if (error) next(error);
  });
});

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('JWT_SECRET must be configured with at least 32 characters.');
    process.exit(1);
  }
  connectDatabase()
    .then(() => app.listen(port, () => console.log(`GBN Supply Chain listening on port ${port}`)))
    .catch((error) => {
      console.error('Unable to start GBN Supply Chain:', error.message);
      process.exit(1);
    });
}

module.exports = app;
