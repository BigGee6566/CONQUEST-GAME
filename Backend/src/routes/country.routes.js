import { Router } from 'express';
import { getCountry, listCountries } from '../controllers/country.controller.js';
import { validate } from '../middleware/validate.js';
import { countryParams, listCountriesQuery } from '../validators/country.schemas.js';

export const countryRouter = Router();

countryRouter.get('/', validate({ query: listCountriesQuery }), listCountries);
countryRouter.get('/:code', validate({ params: countryParams }), getCountry);
