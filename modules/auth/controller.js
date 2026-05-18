const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const User = require('./model');
const { sendEmail } = require('../email');

function makeTokens(user, config) {
  const authCfg = config.features.auth;
  const payload = { id: user._id, email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, authCfg.jwtSecret, { expiresIn: authCfg.tokenExpiry || '7d' });
  const refreshToken = uuidv4();
  return { accessToken, refreshToken };
}

async function register(req, res, config) {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (await User.findOne({ email })) return res.status(409).json({ error: 'Email already registered' });

  const user = await User.create({ email, password, name });
  const { accessToken, refreshToken } = makeTokens(user, config);
  user.refreshTokens.push(refreshToken);
  await user.save();

  res.status(201).json({ user: user.toSafeObject(), accessToken, refreshToken });
}

async function login(req, res, config) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = await User.findOne({ email });
  if (!user || !user.password) return res.status(401).json({ error: 'Invalid credentials' });
  if (!(await user.comparePassword(password))) return res.status(401).json({ error: 'Invalid credentials' });

  const { accessToken, refreshToken } = makeTokens(user, config);
  user.refreshTokens.push(refreshToken);
  await user.save();

  res.json({ user: user.toSafeObject(), accessToken, refreshToken });
}

async function refresh(req, res, config) {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  const user = await User.findOne({ refreshTokens: refreshToken });
  if (!user) return res.status(401).json({ error: 'Invalid refresh token' });

  user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken);
  const tokens = makeTokens(user, config);
  user.refreshTokens.push(tokens.refreshToken);
  await user.save();

  res.json(tokens);
}

async function logout(req, res) {
  const { refreshToken } = req.body;
  if (refreshToken) {
    const user = await User.findOne({ refreshTokens: refreshToken });
    if (user) {
      user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken);
      await user.save();
    }
  }
  res.json({ message: 'Logged out' });
}

async function me(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: user.toSafeObject() });
}

async function forgotPassword(req, res, config) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const user = await User.findOne({ email });
  const token = crypto.randomBytes(32).toString('hex');

  if (user) {
    user.resetToken = token;
    user.resetExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    let emailSent = false;
    try {
      await sendEmail({
        to: email,
        subject: 'Password reset',
        html: `<p>Your password reset token: <strong>${token}</strong></p><p>Expires in 1 hour.</p>`,
        text: `Your password reset token: ${token}\nExpires in 1 hour.`,
        config
      });
      emailSent = true;
    } catch (_) {}

    if (!emailSent && process.env.NODE_ENV !== 'production') {
      return res.json({ message: 'Reset token generated (email not configured)', token });
    }
  }

  if (!user && process.env.NODE_ENV !== 'production') {
    return res.json({ message: 'If that email exists, a reset link has been sent.' });
  }

  res.json({ message: 'If that email exists, a reset link has been sent.' });
}

async function resetPassword(req, res) {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and newPassword required' });

  const user = await User.findOne({ resetToken: token, resetExpiry: { $gt: new Date() } });
  if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

  user.password = newPassword;
  user.resetToken = undefined;
  user.resetExpiry = undefined;
  await user.save();

  res.json({ message: 'Password updated successfully' });
}

module.exports = { register, login, refresh, logout, me, forgotPassword, resetPassword };
