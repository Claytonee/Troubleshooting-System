const express = require('express');
const multer = require('multer');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const errorController = require('../controllers/errorController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.html',
      '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
      '.mp4', '.webm', '.mov', '.avi', '.mkv',
      '.mp3', '.wav', '.ogg', '.m4a', '.aac'
    ];
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('File type not allowed.'));
  }
});

// Public CSAT submission via tokenised link (must be registered before authenticate).
router.post('/csat/:token', [
  body('rating').isInt({ min: 0, max: 5 }).withMessage('Rating must be 0-5'),
  validate
], errorController.submitCsat);

router.use(authenticate);

router.get('/', errorController.getAll);
router.get('/stats', errorController.getStats);
router.get('/export', authorize('admin', 'subadmin'), errorController.exportErrors);
router.get('/:id', errorController.getById);

router.post('/', upload.array('attachments', 5), [
  body('title').notEmpty().withMessage('Error title is required'),
  body('school_id').isInt().withMessage('School ID is required'),
  body('category').isIn(['Connectivity', 'Hardware', 'Platform', 'Power', 'Accounts', 'Other']).withMessage('Valid category is required'),
  body('priority').optional().isIn(['critical', 'high', 'medium', 'low']),
  validate
], errorController.create);

router.post('/:id/attachments', upload.array('attachments', 5), errorController.addAttachments);

router.put('/:id', [
  authorize('admin', 'subadmin'),
  body('title').notEmpty().withMessage('Error title is required'),
  validate
], errorController.update);

router.patch('/:id/status', [
  body('status').isIn(['open', 'progress', 'escalated', 'resolved']).withMessage('Valid status is required'),
  validate
], errorController.updateStatus);

router.post('/:id/updates', [
  body('note').notEmpty().withMessage('Update note is required'),
  validate
], errorController.addUpdate);

router.patch('/:id/assign', authorize('admin'), errorController.assignError);

router.post('/:id/escalate', authorize('school', 'teacher'), errorController.escalateToAdmin);

router.delete('/:id', authorize('admin'), errorController.remove);

module.exports = router;
