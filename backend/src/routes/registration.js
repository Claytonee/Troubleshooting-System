const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/registrationController');

// --- Public endpoints (no auth) ---
router.get('/schools-list', ctrl.getSchoolsList);
router.post('/school-admin', ctrl.registerSchoolAdmin);
router.get('/status/:id', ctrl.getRegistrationStatus);
router.post('/appeal', ctrl.submitAppeal);

// --- Teacher registration via link (public) ---
router.get('/verify/:token', ctrl.verifyTeacherLink);
router.post('/teacher/:token', ctrl.registerTeacher);
router.post('/teacher-status', ctrl.getTeacherStatus);

// --- Admin: Approval management ---
router.get('/approvals', authenticate, authorize('admin'), ctrl.getAllApprovals);
router.get('/approvals/pending', authenticate, authorize('admin'), ctrl.getPendingApprovals);
router.get('/approvals/appeals', authenticate, authorize('admin'), ctrl.getAppeals);
router.get('/approvals/:id', authenticate, authorize('admin'), ctrl.getApprovalDetail);
router.post('/approvals/:id/approve', authenticate, authorize('admin'), ctrl.approveRegistration);
router.post('/approvals/:id/reject', authenticate, authorize('admin'), ctrl.rejectRegistration);

// --- School Admin: Teacher links & approval ---
router.post('/teacher-links', authenticate, authorize('school'), ctrl.generateTeacherLink);
router.get('/teacher-links', authenticate, authorize('school'), ctrl.getTeacherLinks);
router.delete('/teacher-links/:id', authenticate, authorize('school'), ctrl.deactivateLink);
router.get('/teacher-approvals/pending', authenticate, authorize('school'), ctrl.getPendingTeachers);
router.post('/teacher-approvals/:id/approve', authenticate, authorize('school'), ctrl.approveTeacher);
router.post('/teacher-approvals/:id/reject', authenticate, authorize('school'), ctrl.rejectTeacher);

// --- School Admin: Teacher CRUD ---
router.get('/teachers', authenticate, authorize('school'), ctrl.getTeachers);
router.get('/teachers/:id', authenticate, authorize('school'), ctrl.getTeacher);
router.post('/teachers', authenticate, authorize('school'), ctrl.createTeacher);
router.put('/teachers/:id', authenticate, authorize('school'), ctrl.updateTeacher);
router.patch('/teachers/:id/status', authenticate, authorize('school'), ctrl.updateTeacherStatus);
router.delete('/teachers/:id', authenticate, authorize('school'), ctrl.deleteTeacher);

module.exports = router;
