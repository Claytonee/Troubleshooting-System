const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const auditController = require('../controllers/auditController');

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/', auditController.getAll);

module.exports = router;
