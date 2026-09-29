import Joi from "joi";

const pin = Joi.string()
  .pattern(/^\d{4,6}$/)
  .required()
  .messages({
    "string.pattern.base": "PIN must be 4 to 6 numeric digits",
    "any.required": "PIN is required",
  });

const pinValidation = {
  setup: Joi.object({
    pin,
    confirmPin: Joi.string().required(),
  }),

  change: Joi.object({
    currentPin: Joi.string().required(),
    newPin: pin,
    confirmNewPin: Joi.string().required(),
    authType: Joi.string().valid("password", "otp").required(),
    password: Joi.when("authType", {
      is: "password",
      then: Joi.string().min(8).required(),
      otherwise: Joi.forbidden(),
    }),
    otp: Joi.when("authType", {
      is: "otp",
      then: Joi.string().length(6).required(),
      otherwise: Joi.forbidden(),
    }),
  }),

  reset: Joi.object({
    otp: Joi.string().length(6).required(),
    newPin: pin,
    confirmPin: Joi.string().required(),
  }),
};

export default pinValidation;
