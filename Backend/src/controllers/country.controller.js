import * as countryService from '../services/country.service.js';

export async function listCountries(req, res) {
  res.json(await countryService.listCountries(req.validated.query));
}

export async function getCountry(req, res) {
  res.json({ country: await countryService.getCountry(req.validated.params.code) });
}
