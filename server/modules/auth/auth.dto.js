export const loginDto = {
  email:    ['string', 'required', 'email'],
  password: ['string', 'required', 'min:1'],
}
