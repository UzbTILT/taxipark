const BASE_PRICE = 500;
const PAUSE_PRICE_PER_MIN = 200;

const DAY_RATES  = { first: 6000, second: 5000, rest: 4500 };
const NIGHT_RATES = { first: 8000, second: 7000, rest: 6500 };

const calcKmPrice = (km, isNight) => {
  const r = isNight ? NIGHT_RATES : DAY_RATES;
  if (km <= 1) return km * r.first;
  if (km <= 2) return r.first + (km - 1) * r.second;
  return r.first + r.second + (km - 2) * r.rest;
};

module.exports = { BASE_PRICE, PAUSE_PRICE_PER_MIN, DAY_RATES, NIGHT_RATES, calcKmPrice };
