import express from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.use(authenticate);

const resultSchema = z.object({
  student_id: z.coerce.number().int().positive(),
  examination_id: z.coerce.number().int().positive(),
  marks: z.coerce.number().min(0).max(100),
  grade: z.string().min(1).max(2),
  status: z.string().min(2).max(20)
});

router.get(
  "/",
  authorize("Administrator", "Lecturer"),
  async (req, res, next) => {
    try {
      const [rows] = await pool.query(
        `SELECT
            r.result_id,
            r.student_id,
            u.student_id AS student_code,
            u.full_name,
            r.examination_id,
            c.course_code,
            c.course_name,
            r.marks,
            r.grade,
            r.status
         FROM results r
         JOIN users u
           ON r.student_id = u.user_id
         JOIN examinations e
           ON r.examination_id = e.examination_id
         JOIN courses c
           ON e.course_id = c.course_id
         ORDER BY u.full_name, c.course_code`
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
  "/:id",
  authorize("Administrator", "Lecturer"),
  async (req, res, next) => {
    try {
      const [rows] = await pool.query(
        `SELECT
            r.*,
            u.full_name,
            u.student_id AS student_code,
            c.course_code,
            c.course_name
         FROM results r
         JOIN users u ON r.student_id = u.user_id
         JOIN examinations e
           ON r.examination_id = e.examination_id
         JOIN courses c ON e.course_id = c.course_id
         WHERE r.result_id = ?`,
        [req.params.id]
      );

      if (!rows.length) {
        return res.status(404).json({
          success: false,
          message: "Result not found"
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

router.post(
  "/",
  authorize("Administrator", "Lecturer"),
  validate(resultSchema),
  async (req, res, next) => {
    try {
      const {
        student_id,
        examination_id,
        marks,
        grade,
        status
      } = req.body;

      const [result] = await pool.query(
        `INSERT INTO results
         (student_id, examination_id, marks, grade, status)
         VALUES (?, ?, ?, ?, ?)`,
        [
          student_id,
          examination_id,
          marks,
          grade,
          status.toUpperCase()
        ]
      );

      res.status(201).json({
        success: true,
        message: "Result created",
        result_id: result.insertId
      });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/:id",
  authorize("Administrator", "Lecturer"),
  validate(resultSchema),
  async (req, res, next) => {
    try {
      const {
        student_id,
        examination_id,
        marks,
        grade,
        status
      } = req.body;

      const [result] = await pool.query(
        `UPDATE results
         SET student_id = ?,
             examination_id = ?,
             marks = ?,
             grade = ?,
             status = ?
         WHERE result_id = ?`,
        [
          student_id,
          examination_id,
          marks,
          grade,
          status.toUpperCase(),
          req.params.id
        ]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          success: false,
          message: "Result not found"
        });
      }

      res.json({
        success: true,
        message: "Result updated"
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
        "DELETE FROM results WHERE result_id = ?",
        [req.params.id]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          success: false,
          message: "Result not found"
        });
      }

      res.json({
        success: true,
        message: "Result deleted"
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;