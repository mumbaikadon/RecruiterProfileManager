import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

// Simple password hashing function that doesn't use crypto
function hashPassword(password: string): string {
  // In production, you would use a proper hashing library
  // This is a simple base64 encoding for demonstration
  return Buffer.from(password).toString('base64');
}

// Simple password comparison that doesn't use crypto
function comparePasswords(supplied: string, stored: string): boolean {
  // For hardcoded users or plain text passwords
  if (!stored.includes('.')) {
    return supplied === stored;
  }
  
  // For "hashed" passwords (in this case, just base64 encoded)
  // In production, use a proper password hashing library
  const encodedSupplied = Buffer.from(supplied).toString('base64');
  return encodedSupplied === stored;
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "fallback-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Hardcoded credentials for admin and recruiter
        const hardcodedUsers = {
          admin: {
            id: 1,
            username: "admin",
            password: "VelocityAdmin2025!",
            name: "Administrator",
            email: "admin@velocitytech.com",
            role: "admin" as const,
            createdAt: new Date()
          },
          recruiter: {
            id: 2,
            username: "recruiter", 
            password: "VelocityRecruit2025!",
            name: "Recruiter",
            email: "recruiter@velocitytech.com",
            role: "recruiter" as const,
            createdAt: new Date()
          }
        };

        const hardcodedUser = hardcodedUsers[username as keyof typeof hardcodedUsers];
        if (hardcodedUser && hardcodedUser.password === password) {
          return done(null, hardcodedUser);
        }

        // Fallback to database users if not hardcoded
        try {
          const user = await storage.getUserByUsername(username);
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false);
          } else {
            return done(null, user);
          }
        } catch (error) {
          // If database lookup fails, still check if it's a hardcoded user
          return done(null, false);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      // Handle hardcoded users
      if (id === 1) {
        return done(null, {
          id: 1,
          username: "admin",
          password: "VelocityAdmin2025!",
          name: "Administrator",
          email: "admin@velocitytech.com",
          role: "admin" as const,
          createdAt: new Date()
        });
      }
      if (id === 2) {
        return done(null, {
          id: 2,
          username: "recruiter",
          password: "VelocityRecruit2025!",
          name: "Recruiter",
          email: "recruiter@velocitytech.com", 
          role: "recruiter" as const,
          createdAt: new Date()
        });
      }

      // Fallback to database users
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}

// Middleware to protect routes
export function requireAuth(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Authentication required" });
}