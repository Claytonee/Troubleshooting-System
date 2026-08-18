const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getAll, getStats, getById, create, update, changeStatus, remove } = require('../controllers/lrsController');

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

router.use(authenticate);
router.use(adminOnly);

router.get('/', getAll);
router.get('/stats', getStats);
router.get('/:id', getById);
router.post('/', create);
router.put('/:id', update);
router.patch('/:id/status', changeStatus);
router.delete('/:id', remove);

module.exports = router;
