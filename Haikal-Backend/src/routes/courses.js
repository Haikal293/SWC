import express from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.use(authenticate);

const courseSchema = z.object({
  course_code: z.string().min(2).max(20),
  course_name: z.string().min(2).max(100),
  credit_hour: z.coerce.number().int().min(1).max(10),
  faculty: z.string().min(2).max(100)
});

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 10, 100);
    const offset = (page - 1) * limit;

    const search = `%${req.query.search || ""}%`;

    const [count] = await pool.query(
      `SELECT COUNT(*) total
       FROM courses
       WHERE course_code LIKE ?
       OR course_name LIKE ?
       OR faculty LIKE ?`,
      [search, search, search]
    );

    const [rows] = await pool.query(
      `SELECT *
       FROM courses
       WHERE course_code LIKE ?
       OR course_name LIKE ?
       OR faculty LIKE ?
       ORDER BY course_code ASC
       LIMIT ? OFFSET ?`,
      [search, search, search, limit, offset]
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: count[0].total,
        pages: Math.ceil(count[0].total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM courses WHERE course_id = ?",
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/",
  authorize("Administrator", "Lecturer"),
  validate(courseSchema),
  async (req, res, next) => {
    try {
      const {
        course_code,
        course_name,
        credit_hour,
        faculty
      } = req.body;

      const [result] = await pool.query(
        `INSERT INTO courses
         (course_code, course_name, credit_hour, faculty)
         VALUES (?, ?, ?, ?)`,
        [course_code, course_name, credit_hour, faculty]
      );

      res.status(201).json({
        success: true,
        message: "Course created",
        course_id: result.insertId
      });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/:id",
  authorize("Administrator", "Lecturer"),
  validate(courseSchema),
  async (req, res, next) => {
    try {
      const {
        course_code,
        course_name,
        credit_hour,
        faculty
      } = req.body;

      const [result] = await pool.query(
        `UPDATE courses
         SET course_code = ?,
             course_name = ?,
             credit_hour = ?,
             faculty = ?
         WHERE course_id = ?`,
        [
          course_code,
          course_name,
          credit_hour,
          faculty,
          req.params.id
        ]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          success: false,
          message: "Course not found"
        });
      }

      res.json({
        success: true,
        message: "Course updated"
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
        "DELETE FROM courses WHERE course_id = ?",
        [req.params.id]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          success: false,
          message: "Course not found"
        });
      }

      res.json({
        success: true,
        message: "Course deleted"
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;