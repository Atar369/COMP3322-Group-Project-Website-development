const errorHandler = (err, req, res, next) => {
  // 1. Log the error for the developer (you) to see in the terminal
  console.error(`[Error] ${req.method} ${req.url}:`, err.message || err);

  // 2. If the response has already started, let Express handle it
  if (res.headersSent) {
    return next(err);
  }

  // 3. Handle specific database errors (MySQL)
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'This record already exists.' });
  }
  
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ error: 'Invalid reference ID provided.' });
  }

  // 4. Handle JSON parsing errors (e.g., malformed body sent by frontend)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON format in request body.' });
  }

  // 5. Default 500 Server Error for anything else
  const statusCode = err.status || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    error: message,
    // Only show stack trace in development (optional)
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
};

module.exports = errorHandler;