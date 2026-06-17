const express = require('express');
const { authenticate } = require('../middleware/auth');
const searchController = require('../controllers/searchController');

const router = express.Router();

router.use(authenticate);
router.get('/', searchController.search);

module.exports = router;
