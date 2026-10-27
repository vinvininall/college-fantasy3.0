import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";

export async function requireAuth(req, res, next) {
  const authorization = req.get("authorization");
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const payload = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof payload === "string" || !mongoose.isValidObjectId(payload.sub)) {
      return res.status(401).json({ message: "Invalid or expired token." });
    }
    const user = await User.findById(payload.sub).select("_id name email role");
    if (!user) {
      return res.status(401).json({ message: "Authentication required." });
    }
    req.user = user;
    req.auth = { userId: user._id.toString(), role: user.role };
    return next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Invalid or expired token." });
    }
    return next(error);
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.auth?.role !== role) {
      return res.status(403).json({ message: "You do not have permission to perform this action." });
    }
    return next();
  };
}
