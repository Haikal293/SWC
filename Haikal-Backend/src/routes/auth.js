import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post(
  "/login",
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const [rows] = await pool.query(
        "SELECT * FROM users WHERE email = ?",
        [email]
      );

      if (rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password"
        });
      }

      const user = rows[0];

      let passwordCorrect = false;

      if (user.password.startsWith("$2")) {
        passwordCorrect = await bcrypt.compare(
          password,
          user.password
        );
      } else {
        passwordCorrect = password === user.password;

        if (passwordCorrect) {
          const hashedPassword = await bcrypt.hash(password, 10);

          await pool.query(
            "UPDATE users SET password = ? WHERE user_id = ?",
            [hashedPassword, user.user_id]
          );
        }
      }

      if (!passwordCorrect) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password"
        });
      }

      const token = jwt.sign(
        {
          userId: user.user_id,
          email: user.email,
          role: user.role,
          name: user.full_name,
          studentId: user.student_id
        },
        process.env.JWT_SECRET,
        { expiresIn: "8h" }
      );

      res.json({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user.user_id,
          name: user.full_name,
          email: user.email,
          role: user.role,
          studentId: user.student_id
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT user_id, full_name, email, role, student_id
       FROM users
       WHERE user_id = ?`,
      [req.user.userId]
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

export default router;