const BASE_PRICE = 500;
const COMPANY_SHARE = 900;
const PAUSE_PRICE_PER_MIN = 200;
const WAITING_FREE_MINUTES = 3;
const WAITING_PRICE_PER_MIN = 1000;

const DAY_RATES  = { first: 6000, second: 5000, rest: 4500 };
const NIGHT_RATES = { first: 8000, second: 7000, rest: 6500 };

const calcKmPrice = (km, isNight) => {
  const r = isNight ? NIGHT_RATES : DAY_RATES;
  if (km <= 1) return km * r.first;
  if (km <= 2) return r.first + (km - 1) * r.second;
  return r.first + r.second + (km - 2) * r.rest;
};

const TARIFF_PLANS = [
  { id: 'per_order', name: 'Donali',       price: 0,     duration_hours: null, description: 'Har reysdan 900 so\'m' },
  { id: 'half_day',  name: 'Yarim kunlik', price: 11000, duration_hours: 12   },
  { id: 'daily',     name: 'Kunlik',       price: 22000, duration_hours: 24   },
  { id: 'monthly',   name: 'Oylik',        price: 29900, duration_hours: 720  },
];

module.exports = { BASE_PRICE, COMPANY_SHARE, PAUSE_PRICE_PER_MIN, WAITING_FREE_MINUTES, WAITING_PRICE_PER_MIN, DAY_RATES, NIGHT_RATES, calcKmPrice, TARIFF_PLANS };
