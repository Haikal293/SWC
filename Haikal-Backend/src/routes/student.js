import express from "express";
import { pool } from "../db/pool.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);

function canAccessStudent(req, res, next) {
  const requestedId = Number(req.params.userId);

  if (
    req.user.role === "Student" &&
    Number(req.user.userId) !== requestedId
  ) {
    return res.status(403).json({
      success: false,
      message: "Students can only access their own records"
    });
  }

  next();
}

router.get(
  "/:userId/profile",
  canAccessStudent,
  async (req, res, next) => {
    try {
      const [rows] = await pool.query(
        `SELECT user_id, full_name, email, role, student_id
         FROM users
         WHERE user_id = ?
         AND role = 'Student'`,
        [req.params.userId]
      );

      if (!rows.length) {
        return res.status(404).json({
          success: false,
          message: "Student not found"
        });
      }

      res.json({
        success: true,
        data: rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/:userId/timetable",
  canAccessStudent,
  async (req, res, next) => {
    try {
      const [rows] = await pool.query(
        `SELECT
            e.examination_id,
            c.course_id,
            c.course_code,
            c.course_name,
            e.exam_date,
            e.start_time,
            e.end_time,
            e.exam_type,
            v.venue_name,
            v.building,
            r.semester
         FROM registrations r
         JOIN courses c
           ON r.course_id = c.course_id
         JOIN examinations e
           ON e.course_id = c.course_id
         JOIN venues v
           ON e.venue_id = v.venue_id
         WHERE r.student_id = ?
         ORDER BY e.exam_date, e.start_time`,
        [req.params.userId]
      );

      res.json({
        success: true,
        data: rows
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/:userId/results",
  canAccessStudent,
  async (req, res, next) => {
    try {
      const [rows] = await pool.query(
        `SELECT
            r.result_id,
            c.course_code,
            c.course_name,
            e.exam_type,
            e.exam_date,
            r.marks,
            r.grade,
            r.status
         FROM results r
         JOIN examinations e
           ON r.examination_id = e.examination_id
         JOIN courses c
           ON e.course_id = c.course_id
         WHERE r.student_id = ?
         ORDER BY e.exam_date`,
        [req.params.userId]
      );

      res.json({
        success: true,
        data: rows
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;