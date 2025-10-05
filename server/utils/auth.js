// // server/utils/auth.js
// // Converted from ES Module to CommonJS
// const decode = require("jwt-decode");

// class AuthService {
//   getProfile() {
//     return decode(this.getToken());
//   }

//   loggedIn() {
//     const token = this.getToken();
//     // If there is a token and it's not expired, return true
//     return token && !this.isTokenExpired(token);
//   }

//   isTokenExpired(token) {
//     try {
//       const decoded = decode(token);
//       // If expiration time has passed, remove token and return true
//       if (decoded.exp < Date.now() / 1000) {
//         if (typeof localStorage !== "undefined") {
//           localStorage.removeItem("id_token");
//         }
//         return true;
//       }
//       return false;
//     } catch (err) {
//       return true;
//     }
//   }

//   getToken() {
//     if (typeof localStorage === "undefined") return null;
//     return localStorage.getItem("id_token");
//   }

//   login(idToken) {
//     if (typeof localStorage !== "undefined") {
//       localStorage.setItem("id_token", idToken);
//     }
//     if (typeof window !== "undefined") {
//       window.location.assign("/");
//     }
//   }

//   logout() {
//     if (typeof localStorage !== "undefined") {
//       localStorage.removeItem("id_token");
//     }
//     if (typeof window !== "undefined") {
//       window.location.reload();
//     }
//   }
// }

// module.exports = new AuthService();
// const jwt = require("jsonwebtoken");

// const secret = process.env.JWT_SECRET || "test-secret";
// const expiration = "2h";

// // Create a JWT for a user doc
// function signToken(user) {
//   const { _id, email, username } = user;
//   const payload = { _id, email, username };
//   return jwt.sign({ data: payload }, secret, { expiresIn: expiration });
// }

// // Decode/verify a Bearer token from request headers
// function getUserFromReq(req) {
//   const header = req.headers.authorization || "";
//   let token = header.startsWith("Bearer ") ? header.slice(7) : header;
//   if (!token) return null;
//   try {
//     const { data } = jwt.verify(token, secret);
//     return data; // {_id,email,username}
//   } catch {
//     return null;
//   }
// }

// module.exports = { signToken, getUserFromReq };
const jwt = require("jsonwebtoken");
const secret = process.env.JWT_SECRET || "test-secret";
const expiration = "2h";

function signToken(user) {
  const { _id, email, username } = user;
  return jwt.sign({ data: { _id, email, username } }, secret, {
    expiresIn: expiration,
  });
}

function getUserFromReq(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (!token) return null;
  try {
    const { data } = jwt.verify(token, secret);
    return data; // {_id, email, username}
  } catch {
    return null;
  }
}

module.exports = { signToken, getUserFromReq, secret };
