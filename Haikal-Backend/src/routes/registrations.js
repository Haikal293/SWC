import express from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.use(authenticate);

const registrationSchema = z.object({
  student_id: z.coerce.number().int().positive(),
  course_id: z.coerce.number().int().positive(),
  semester: z.string().min(2).max(20),
  registration_date: z.string().min(8)
});

router.get(
  "/",
  authorize("Administrator", "Lecturer"),
  async (req, res, next) => {
    try {
      const [rows] = await pool.query(
        `SELECT
            r.registration_id,
            r.student_id,
            u.student_id AS student_code,
            u.full_name,
            r.course_id,
            c.course_code,
            c.course_name,
            r.semester,
            r.registration_date
         FROM registrations r
         JOIN users u ON r.student_id = u.user_id
         JOIN courses c ON r.course_id = c.course_id
         ORDER BY r.registration_id`
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

router.post(
  "/",
  authorize("Administrator", "Lecturer"),
  validate(registrationSchema),
  async (req, res, next) => {
    try {
      const {
        student_id,
        course_id,
        semester,
        registration_date
      } = req.body;

      const [student] = await pool.query(
        `SELECT user_id
         FROM users
         WHERE user_id = ?
         AND role = 'Student'`,
        [student_id]
      );

      if (!student.length) {
        return res.status(400).json({
          success: false,
          message: "Student user not found"
        });
      }

      const [result] = await pool.query(
        `INSERT INTO registrations
         (student_id, course_id, semester, registration_date)
         VALUES (?, ?, ?, ?)`,
        [
          student_id,
          course_id,
          semester,
          registration_date
        ]
      );

      res.status(201).json({
        success: true,
        message: "Registration created",
        registration_id: result.insertId
      });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/:id",
  authorize("Administrator"),
  validate(registrationSchema),
  async (req, res, next) => {
    try {
      const {
        student_id,
        course_id,
        semester,
        registration_date
      } = req.body;

      const [result] = await pool.query(
        `UPDATE registrations
         SET student_id = ?,
             course_id = ?,
             semester = ?,
             registration_date = ?
         WHERE registration_id = ?`,
        [
          student_id,
          course_id,
          semester,
          registration_date,
          req.params.id
        ]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          success: false,
          message: "Registration not found"
        });
      }

      res.json({
        success: true,
        message: "Registration updated"
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:id",
  authorize("Administrator"),
  async (req, res, next) => {
    try {
      const [result] = await pool.query(
        "DELETE FROM registrations WHERE registration_id = ?",
        [req.params.id]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          success: false,
          message: "Registration not found"
        });
      }

      res.json({
        success: true,
        message: "Registration deleted"
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;