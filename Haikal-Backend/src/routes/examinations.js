import express from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.use(authenticate);

const examSchema = z.object({
  course_id: z.coerce.number().int().positive(),
  venue_id: z.coerce.number().int().positive(),
  exam_date: z.string().min(8),
  start_time: z.string().min(4),
  end_time: z.string().min(4),
  exam_type: z.string().min(2).max(30)
});

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 10, 100);
    const offset = (page - 1) * limit;

    const search = `%${req.query.search || ""}%`;

    const where = `
      WHERE c.course_code LIKE ?
      OR c.course_name LIKE ?
      OR e.exam_type LIKE ?
      OR v.venue_name LIKE ?
    `;

    const params = [search, search, search, search];

    const [count] = await pool.query(
      `SELECT COUNT(*) total
       FROM examinations e
       JOIN courses c ON e.course_id = c.course_id
       JOIN venues v ON e.venue_id = v.venue_id
       ${where}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT
          e.*,
          c.course_code,
          c.course_name,
          v.venue_name,
          v.building,
          v.capacity
       FROM examinations e
       JOIN courses c ON e.course_id = c.course_id
       JOIN venues v ON e.venue_id = v.venue_id
       ${where}
       ORDER BY e.exam_date, e.start_time
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
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

router.get("/:id/qr", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT
          e.examination_id,
          e.exam_date,
          e.start_time,
          e.end_time,
          e.exam_type,
          c.course_code,
          c.course_name,
          v.venue_name,
          v.building
       FROM examinations e
       JOIN courses c ON e.course_id = c.course_id
       JOIN venues v ON e.venue_id = v.venue_id
       WHERE e.examination_id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Examination not found"
      });
    }

    const exam = rows[0];

    const qrText =
      `${exam.course_code} | ${exam.course_name} | ` +
      `${exam.exam_date} | ${exam.start_time} | ` +
      `${exam.venue_name}`;

    const qrUrl =
      "https://api.qrserver.com/v1/create-qr-code/" +
      `?size=250x250&data=${encodeURIComponent(qrText)}`;

    res.json({
      success: true,
      data: {
        examination: exam,
        qrUrl
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT
          e.*,
          c.course_code,
          c.course_name,
          v.venue_name,
          v.building,
          v.capacity
       FROM examinations e
       JOIN courses c ON e.course_id = c.course_id
       JOIN venues v ON e.venue_id = v.venue_id
       WHERE e.examination_id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Examination not found"
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
  validate(examSchema),
  async (req, res, next) => {
    try {
      const {
        course_id,
        venue_id,
        exam_date,
        start_time,
        end_time,
        exam_type
      } = req.body;

      if (start_time >= end_time) {
        return res.status(400).json({
          success: false,
          message: "End time must be after start time"
        });
      }

      const [conflict] = await pool.query(
        `SELECT examination_id
         FROM examinations
         WHERE venue_id = ?
         AND exam_date = ?
         AND start_time < ?
         AND end_time > ?`,
        [venue_id, exam_date, end_time, start_time]
      );

      if (conflict.length) {
        return res.status(409).json({
          success: false,
          message: "Venue already has an examination during this time"
        });
      }

      const [result] = await pool.query(
        `INSERT INTO examinations
         (course_id, venue_id, exam_date,
          start_time, end_time, exam_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          course_id,
          venue_id,
          exam_date,
          start_time,
          end_time,
          exam_type
        ]
      );

      res.status(201).json({
        success: true,
        message: "Examination created",
        examination_id: result.insertId
      });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/:id",
  authorize("Administrator", "Lecturer"),
  validate(examSchema),
  async (req, res, next) => {
    try {
      const {
        course_id,
        venue_id,
        exam_date,
        start_time,
        end_time,
        exam_type
      } = req.body;

      if (start_time >= end_time) {
        return res.status(400).json({
          success: false,
          message: "End time must be after start time"
        });
      }

      const [conflict] = await pool.query(
        `SELECT examination_id
         FROM examinations
         WHERE venue_id = ?
         AND exam_date = ?
         AND examination_id <> ?
         AND start_time < ?
         AND end_time > ?`,
        [
          venue_id,
          exam_date,
          req.params.id,
          end_time,
          start_time
        ]
      );

      if (conflict.length) {
        return res.status(409).json({
          success: false,
          message: "Venue already has an examination during this time"
        });
      }

      const [result] = await pool.query(
        `UPDATE examinations
         SET course_id = ?,
             venue_id = ?,
             exam_date = ?,
             start_time = ?,
             end_time = ?,
             exam_type = ?
         WHERE examination_id = ?`,
        [
          course_id,
          venue_id,
          exam_date,
          start_time,
          end_time,
          exam_type,
          req.params.id
        ]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          success: false,
          message: "Examination not found"
        });
      }

      res.json({
        success: true,
        message: "Examination updated"
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
        "DELETE FROM examinations WHERE examination_id = ?",
        [req.params.id]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          success: false,
          message: "Examination not found"
        });
      }

      res.json({
        success: true,
        message: "Examination deleted"
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;