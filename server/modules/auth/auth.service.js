import User from '../../models/User.js'
import Token from '../../models/Token.js'

export const authService = {
  async login(email, password) {
    const user = await User.findOne({ email })
    if (!user) return null

    const valid = await user.verifyPassword(password)
    if (!valid) return null

    const session = await Token.generate(user._id)
    return { user: user.toSafe(), token: session.token }
  },

  async logout(token) {
    await Token.deleteOne({ token })
  },
}
