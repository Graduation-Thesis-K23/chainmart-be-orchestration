import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  KAFKA_HOST: Joi.string().required(),
  KAFKA_PORT: Joi.number().required(),
});
