import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
// import session from "cookie-session";
import { config } from "./config/app.config";
import connectDatabase from "./config/database.config";
import { errorHandler } from "./middlewares/errorHandler.middleware";
import { HTTPSTATUS } from "./config/http.config";
import { asyncHandler } from "./middlewares/asyncHandler.middleware";
import { BadRequestException } from "./utils/appError";
import { ErrorCodeEnum } from "./enums/error-code.enum";
import session from "express-session";
import MongoStore from "connect-mongo";
import "./config/passport.config";
import passport from "passport";
import authRoutes from "./routes/auth.route";
import userRoutes from "./routes/user.route";
import isAuthenticated from "./middlewares/isAuthenticated.middleware";
import workspaceRoutes from "./routes/workspace.route";
import memberRoutes from "./routes/member.route";
import projectRoutes from "./routes/project.route";
import taskRoutes from "./routes/task.route";

const app = express();

const BASE_PATH = config.BASE_PATH;

app.use(express.json());

app.use(express.urlencoded({ extended: true }));
// ✅ CORS must come early
app.use(cors({
  origin: config.FRONTEND_ORIGIN,
  credentials: true,
}));
app.options("*", cors({
  origin: config.FRONTEND_ORIGIN,
  credentials: true,
}));
// ✅ Then add this middleware immediately after CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", config.FRONTEND_ORIGIN);
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});

// app.use(
//   session({
//     name: "session",
//     keys: [config.SESSION_SECRET],
//     maxAge: parseInt(process.env.SESSION_EXPIRES_IN || "86400000"), // 1 day
//     secure: config.NODE_ENV === "production",
//     httpOnly: true,
//     sameSite: "lax",
//   })
// );
app.use(
  session({
    secret: config.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: config.MONGO_URI,
      collectionName: "sessions",
    }),
    cookie: {
      httpOnly: true,
      secure: true, // ✅ Render uses HTTPS
      sameSite: "none", // ✅ Must be 'none' for cross-origin cookies
      maxAge: parseInt(process.env.SESSION_EXPIRES_IN || "86400000"),
    },
  })
);


app.use(passport.initialize());
app.use(passport.session());


app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("Express Error:", err); // for debugging

  res.status(statusCode).json({ message });
});


app.get(
  `/`,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    throw new BadRequestException(
      "This is a bad request",
      ErrorCodeEnum.AUTH_INVALID_TOKEN
    );
    return res.status(HTTPSTATUS.OK).json({
      message: "Hello Subscribe to the channel & share",
    });
  })
);

app.use(`${BASE_PATH}/auth`, authRoutes);
app.use(`${BASE_PATH}/user`, isAuthenticated, userRoutes);
app.use(`${BASE_PATH}/workspace`, isAuthenticated, workspaceRoutes);
app.use(`${BASE_PATH}/member`, isAuthenticated, memberRoutes);
app.use(`${BASE_PATH}/project`, isAuthenticated, projectRoutes);
app.use(`${BASE_PATH}/task`, isAuthenticated, taskRoutes);

app.use(errorHandler);

app.listen(config.PORT, async () => {
  console.log(`Server listening on port ${config.PORT} in ${config.NODE_ENV}`);
  await connectDatabase();
});
