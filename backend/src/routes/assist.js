/**
 * Guided resolution (feature 14, phase 1).
 *
 * Its own router rather than another path under /api/guides: that router carries
 * a `/:id` route, and every static path added beside it has to be remembered
 * above that line or Express reads the word as an id and answers 404. Giving
 * this feature its own mount removes the trap instead of stepping around it.
 */
const express = require('express');
const { authenticate } = require('../middleware/auth');
const assistController = require('../controllers/assistController');

const router = express.Router();

router.use(authenticate);

// What we already hold that might fix this. Any signed-in role: a teacher about
// to file, a school admin deciding whether to escalate, an engineer in a lab.
router.get('/resources', assistController.resources);

module.exports = router;
