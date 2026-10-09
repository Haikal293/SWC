import express from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.use(authenticate);
router.use(authorize("Administrator"));

const createSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["Administrator", "Lecturer", "Student"]),
  student_id: z.string().nullable().optional()
});

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 10, 1),
      100
    );

    const offset = (page - 1) * limit;
    const search = String(req.query.search || "");
    const role = String(req.query.role || "");

    const allowedSort = [
      "user_id",
      "full_name",
      "email",
      "role",
      "student_id"
    ];

    const sort = allowedSort.includes(req.query.sort)
      ? req.query.sort
      : "user_id";

    const order =
      String(req.query.order).toUpperCase() === "DESC"
        ? "DESC"
        : "ASC";

    const conditions = [];
    const params = [];

    if (search) {
      conditions.push(
        "(full_name LIKE ? OR email LIKE ? OR student_id LIKE ?)"
      );

      const value = `%${search}%`;
      params.push(value, value, value);
    }

    if (role) {
      conditions.push("role = ?");
      params.push(role);
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM users ${where}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT user_id, full_name, email, role, student_id
       FROM users
       ${where}
       ORDER BY ${sort} ${order}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: countRows[0].total,
        pages: Math.ceil(countRows[0].total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT user_id, full_name, email, role, student_id
       FROM users
       WHERE user_id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "User not found"
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

router.post("/", validate(createSchema), async (req, res, next) => {
  try {
    const {
      full_name,
      email,
      password,
      role,
      student_id
    } = req.body;

    const hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users
       (full_name, email, password, role, student_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        full_name,
        email,
        hash,
        role,
        role === "Student" ? student_id || null : null
      ]
    );

    res.status(201).json({
      success: true,
      message: "User created",
      user_id: result.insertId
    });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const [existing] = await pool.query(
      "SELECT * FROM users WHERE user_id = ?",
      [req.params.id]
    );

    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const current = existing[0];

    const full_name =
      req.body.full_name ?? current.full_name;

    const email =
      req.body.email ?? current.email;

    const role =
      req.body.role ?? current.role;

    const student_id =
      role === "Student"
        ? req.body.student_id ?? current.student_id
        : null;

    let password = current.password;

    if (req.body.password) {
      password = await bcrypt.hash(req.body.password, 10);
    }

    await pool.query(
      `UPDATE users
       SET full_name = ?,
           email = ?,
           password = ?,
           role = ?,
           student_id = ?
       WHERE user_id = ?`,
      [
        full_name,
        email,
        password,
        role,
        student_id,
        req.params.id
      ]
    );

    res.json({
      success: true,
      message: "User updated"
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM users WHERE user_id = ?",
      [req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      message: "User deleted"
    });
  } catch (error) {
    next(error);
  }
});

export default router;