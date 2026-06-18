const express = require('express');
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const manualController = require('../controllers/manualController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600 }, // 100MB default
  fileFilter: (req, file, cb) => {
    const allowed = [
      // Documents
      '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.html',
      // Images
      '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
      // Video
      '.mp4', '.webm', '.mov', '.avi', '.mkv',
      // Audio
      '.mp3', '.wav', '.ogg', '.m4a', '.aac'
    ];
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('File type not allowed. Accepted: PDF, DOC, PPT, XLS, images, video, audio.'));
  }
});

router.use(authenticate);

router.get('/', manualController.getAll);
router.get('/:id/download', manualController.download);

router.post('/', authorize('admin'), upload.single('file'), manualController.upload);
router.post('/link', authorize('admin'), manualController.addLink);
router.delete('/:id', authorize('admin'), manualController.remove);

module.exports = router;
