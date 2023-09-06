import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  KAFKA_BROKERS: Joi.string().required(),
});
