import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { config } from "../config/app.config";
import { registerSchema } from "../validation/auth.validation";
import { HTTPSTATUS } from "../config/http.config";
import { registerUserService } from "../services/auth.service";
import passport from "passport";
import { signJwtToken } from "../utils/jwt";

// Google OAuth callback
export const googleLoginCallback = asyncHandler(
  async (req: Request, res: Response) => {
    const jwt=req.jwt
    const currentWorkspace = req.user?.currentWorkspace;

    if (!jwt) {
      return res.redirect(`${config.FRONTEND_ORIGIN}?status=failure`);
    }

      return res.redirect(`${config.FRONTEND_ORIGIN}?status=success&access_token=${jwt}&current_workspace=${currentWorkspace}`);
  }
);

// User registration
export const registerUserController = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      console.log("🔍 Registration body:", req.body); // log incoming data

      const body = registerSchema.parse(req.body); // validate body
      await registerUserService(body); // call service

      return res.status(HTTPSTATUS.CREATED).json({
        message: "User created successfully",
      });
    } catch (error) {
      console.error("❌ Error in registration:", error); // log the actual error
      throw error; // rethrow to be caught by error handler
    }
  }
);

// User login
export const loginController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate(
      "local",
      (
        err: Error | null,
        user: Express.User | false,
        info: { message: string } | undefined
      ) => {
        if (err) return next(err);

        if (!user) {
          return res.status(HTTPSTATUS.UNAUTHORIZED).json({
            message: info?.message || "Invalid email or password",
          });
        }

        // req.logIn(user, (err) => {
        //   if (err) return next(err);

        //   return res.status(HTTPSTATUS.OK).json({
        //     message: "Logged in successfully",
        //     user,
        //   });
        // });
        const access_token=signJwtToken({userId:user._id});
        return res.status(HTTPSTATUS.OK).json({
          message: "Loggin In Successfully",
          access_token,
          user,

        });
      }
    )(req, res, next);
  }
);

// Logout
export const logOutController = asyncHandler(
  async (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res
          .status(HTTPSTATUS.INTERNAL_SERVER_ERROR)
          .json({ message: "Failed to log out" });
      }

      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
          return res.status(500).json({ message: "Failed to destroy session" });
        }

        res.clearCookie("connect.sid"); // important: cookie name from express-session
        return res.status(200).json({ message: "Logged out successfully" });
      });
    });
  }
);


