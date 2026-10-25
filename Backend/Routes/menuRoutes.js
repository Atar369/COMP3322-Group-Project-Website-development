const express = require('express');
const multer = require('multer');
const menuController = require('../Controllers/menuController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (file.mimetype !== 'image/png' || !file.originalname.toLowerCase().endsWith('.png')) {
      return callback(new Error('Upload a PNG image.'));
    }
    return callback(null, true);
  },
});
const managerOnly = [verifyToken, requireRole('manager')];

router.post('/', ...managerOnly, (request, response, next) => {
  upload.single('image')(request, response, error => {
    if (error) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return response.status(413).json({ error: 'PNG image must be 5 MB or smaller.' });
      }
      if (error instanceof multer.MulterError || error.message === 'Upload a PNG image.') {
        return response.status(400).json({ error: error.message });
      }
      return next(error);
    }
    return next();
  });
}, menuController.create);
router.patch('/:id', ...managerOnly, menuController.update);
router.delete('/:id', ...managerOnly, menuController.remove);

module.exports = router;
