const User = require('../models/User');
const Workspace = require('../models/Workspace');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

function generateToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

class AuthController {
  async register(req, res, next) {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
      }

      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
      }

      const user = new User({
        name,
        email: email.toLowerCase(),
        password,
        role: 'analyst'
      });
      await user.save();

      // Create default personal workspace for the user
      const slug = `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.round(Math.random() * 1e4)}`;
      const defaultWorkspace = new Workspace({
        name: `${name}'s Workspace`,
        slug,
        ownerId: user._id,
        members: [{ userId: user._id, role: 'owner' }]
      });
      await defaultWorkspace.save();

      user.activeWorkspaceId = defaultWorkspace._id;
      await user.save();

      const token = generateToken(user);
      setAuthCookie(res, token);

      res.status(201).json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          activeWorkspaceId: defaultWorkspace._id
        },
        workspace: defaultWorkspace
      });
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required.' });
      }

      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid email or password.' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Invalid email or password.' });
      }

      let activeWorkspace = null;
      if (user.activeWorkspaceId) {
        activeWorkspace = await Workspace.findById(user.activeWorkspaceId);
      }
      if (!activeWorkspace) {
        activeWorkspace = await Workspace.findOne({
          $or: [{ ownerId: user._id }, { 'members.userId': user._id }]
        });
      }

      const token = generateToken(user);
      setAuthCookie(res, token);

      res.json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          activeWorkspaceId: activeWorkspace?._id
        },
        workspace: activeWorkspace
      });
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res) {
    res.clearCookie('token', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    res.json({ success: true, message: 'Logged out successfully.' });
  }

  async getMe(req, res, next) {
    try {
      const workspaces = await Workspace.find({
        $or: [{ ownerId: req.user._id }, { 'members.userId': req.user._id }]
      });

      res.json({
        success: true,
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          activeWorkspaceId: req.user.activeWorkspaceId
        },
        workspaces
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
