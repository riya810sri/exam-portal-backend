const roleConfig = {
  "/api/role": {
    GET: ["admin"],
    POST: ["admin"],
    PUT: ["admin"],
    DELETE: ["admin"]
  },
  "/api/users": {
    GET: ["admin", "teacher", "student"],
    POST: ["admin"],
    PUT: ["admin", "teacher", "student"],
    DELETE: ["admin"]
  },
  "/api/exams": {
    GET: ["admin", "teacher", "student"],
    POST: ["admin", "teacher"],
    PUT: ["admin", "teacher"],
    DELETE: ["admin"]
  },
  "/api/questions": {
    GET: ["admin", "teacher"],
    POST: ["admin", "teacher"],
    PUT: ["admin", "teacher"],
    DELETE: ["admin"]
  },
  "/api/examAttendance": {
    GET: ["admin", "teacher", "student"],
    POST: ["student"],
    PUT: ["student"]
  },
  "/api/certificate": {
    GET: ["admin", "teacher", "student"],
    POST: ["admin"]
  },
  "/api/auth": {
    POST: ["admin", "teacher", "student"],
    GET: ["admin", "teacher", "student"]
  },
  "/api/admin": {
    GET: ["admin"],
    POST: ["admin"],
    PUT: ["admin"],
    DELETE: ["admin"]
  },
  "*": {
    "*": ["admin"]
  }
};

module.exports = roleConfig; 