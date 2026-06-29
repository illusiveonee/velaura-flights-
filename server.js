const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============================================================
// AMADEUS API
// ============================================================
const AMADEUS_CLIENT_ID = process.env.AMADEUS_CLIENT_ID || '';
const AMADEUS_CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET || '';
const AMADEUS_TEST_URL = 'https://test.api.amadeus.com';

let amadeusToken = null;
let tokenExpiry = null;

async function getAmadeusToken() {
    if (amadeusToken && tokenExpiry && Date.now() < tokenExpiry) return amadeusToken;
    if (!AMADEUS_CLIENT_ID || !AMADEUS_CLIENT_SECRET) return null;
    try {
        const response = await axios.post(`${AMADEUS_TEST_URL}/v1/security/oauth2/token`,
            new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: AMADEUS_CLIENT_ID,
                client_secret: AMADEUS_CLIENT_SECRET
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        amadeusToken = response.data.access_token;
        tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
        return amadeusToken;
    } catch (error) {
        console.error('Amadeus auth failed:', error.message);
        return null;
    }
}

// ============================================================
// AI ALGORITHMS
// ============================================================

function findHiddenCityRoutes(origin, destination, directPrice) {
    const hubAirports = {
        'ATL': 'Atlanta', 'DFW': 'Dallas', 'DEN': 'Denver', 'ORD': 'Chicago',
        'LAX': 'Los Angeles', 'CLT': 'Charlotte', 'MCO': 'Orlando', 'LAS': 'Las Vegas',
        'PHX': 'Phoenix', 'MIA': 'Miami', 'SEA': 'Seattle', 'IAH': 'Houston',
        'JFK': 'New York', 'SFO': 'San Francisco', 'EWR': 'Newark', 'BOS': 'Boston',
        'MSP': 'Minneapolis', 'DTW': 'Detroit', 'PHL': 'Philadelphia'
    };
    const routes = [];
    const possibleDestinations = Object.entries(hubAirports)
        .filter(([code]) => code !== origin && code !== destination);
    for (let i = 0; i < Math.min(6, possibleDestinations.length); i++) {
        const [destCode, destCity] = possibleDestinations[Math.floor(Math.random() * possibleDestinations.length)];
        const discountFactor = 0.35 + (Math.random() * 0.35);
        const hiddenPrice = Math.floor(directPrice * (1 - discountFactor));
        const savings = directPrice - hiddenPrice;
        if (savings > 50) {
            routes.push({
                finalDestination: { code: destCode, city: destCity },
                stopover: { code: destination, city: hubAirports[destination] || destination },
                price: hiddenPrice, originalPrice: directPrice, savings: savings,
                savingsPercent: Math.round((savings / directPrice) * 100),
                layoverHours: 1 + Math.floor(Math.random() * 4),
                totalDuration: 4 + Math.floor(Math.random() * 6),
                confidence: Math.floor(70 + Math.random() * 25),
                airline: ['AA', 'DL', 'UA', 'WN', 'B6'][Math.floor(Math.random() * 5)]
            });
        }
    }
    return routes.sort((a, b) => b.savings - a.savings);
}

function predictPriceTrend(currentPrice, daysUntilDeparture) {
    const volatility = 0.15;
    const trendDirection = daysUntilDeparture > 30 ? -0.02 : daysUntilDeparture > 14 ? 0.01 : 0.03;
    const predictedChange = (trendDirection * currentPrice) + (Math.random() - 0.5) * volatility * currentPrice;
    const confidence = Math.max(0.6, 1 - (daysUntilDeparture / 60));
    return {
        currentPrice,
        predictedPrice: Math.floor(currentPrice + predictedChange),
        predictedChange: Math.floor(predictedChange),
        confidence: Math.round(confidence * 100),
        recommendation: predictedChange < -20 ? 'BUY_NOW' : predictedChange < 10 ? 'WAIT' : 'BOOK_SOON',
        optimalBookingWindow: daysUntilDeparture > 21 ? '21-45 days before' : daysUntilDeparture > 7 ? '7-21 days before' : 'Last minute'
    };
}

function analyzeHiddenCityRisk() {
    const risks = {
        baggageRisk: { score: 95, level: 'CRITICAL', detail: 'Checked bags go to final destination' },
        returnRisk: { score: 80, level: 'HIGH', detail: 'Airline may cancel return segments' },
        rebookingRisk: { score: 40, level: 'MEDIUM', detail: 'May be rerouted through different hub' },
        loyaltyRisk: { score: 85, level: 'HIGH', detail: 'FF account may be flagged' },
        weatherRisk: { score: 25, level: 'LOW', detail: 'Weather delays possible' }
    };
    const overallScore = Math.round(Object.values(risks).reduce((a, r) => a + r.score, 0) / 5);
    return {
        overallScore,
        overallLevel: overallScore > 75 ? 'HIGH' : overallScore > 50 ? 'MEDIUM' : 'LOW',
        risks,
        mitigations: [
            'Carry-on only (under 22x14x9 inches)',
            'Book one-way on different airlines',
            'Do not enter frequent flyer number',
            'Arrive early for overhead space',
            'Have backup funds ready'
        ]
    };
}

function parseNaturalLanguage(query) {
    const lower = query.toLowerCase();
    const result = { origin: null, destination: null, date: null, parsed: false };
    const cityPatterns = [
        { name: 'New York', pattern: /new york|nyc|jfk|lga/ },
        { name: 'Los Angeles', pattern: /los angeles|lax/ },
        { name: 'Chicago', pattern: /chicago|ord/ },
        { name: 'Houston', pattern: /houston|iah/ },
        { name: 'Miami', pattern: /miami|mia/ },
        { name: 'San Francisco', pattern: /san francisco|sfo/ },
        { name: 'Dallas', pattern: /dallas|dfw/ },
        { name: 'Denver', pattern: /denver|den/ },
        { name: 'Atlanta', pattern: /atlanta|atl/ },
        { name: 'Seattle', pattern: /seattle|sea/ },
        { name: 'Boston', pattern: /boston|bos/ },
        { name: 'Las Vegas', pattern: /las vegas|las/ },
        { name: 'Phoenix', pattern: /phoenix|phx/ },
        { name: 'Austin', pattern: /austin|aus/ },
        { name: 'Orlando', pattern: /orlando|mco/ }
    ];
    const foundCities = cityPatterns.filter(city => city.pattern.test(lower));
    if (foundCities.length >= 2) {
        result.origin = foundCities[0].name;
        result.destination = foundCities[1].name;
    }
    const today = new Date();
    if (/tomorrow/.test(lower)) {
        const d = new Date(today); d.setDate(d.getDate() + 1);
        result.date = d.toISOString().split('T')[0];
    } else if (/next week/.test(lower)) {
        const d = new Date(today); d.setDate(d.getDate() + 7);
        result.date = d.toISOString().split('T')[0];
    }
    result.parsed = !!(result.origin && result.destination && result.date);
    return result;
}

function generateMockFlightData(from, to, date) {
    const airlines = [
        { name: 'American Airlines', code: 'AA', color: '#c9a96e' },
        { name: 'Delta Air Lines', code: 'DL', color: '#a8a29e' },
        { name: 'United Airlines', code: 'UA', color: '#7c9e7c' },
        { name: 'Southwest', code: 'WN', color: '#c27c7c' },
        { name: 'JetBlue', code: 'B6', color: '#9e8b7c' }
    ];
    const airportDB = {
        'IAH': { city: 'Houston', full: 'Bush Intercontinental' },
        'JFK': { city: 'New York', full: 'John F. Kennedy' },
        'LAX': { city: 'Los Angeles', full: 'Los Angeles Intl' },
        'ORD': { city: 'Chicago', full: 'O\'Hare' },
        'DFW': { city: 'Dallas', full: 'Dallas/Fort Worth' },
        'DEN': { city: 'Denver', full: 'Denver Intl' },
        'ATL': { city: 'Atlanta', full: 'Hartsfield-Jackson' },
        'SFO': { city: 'San Francisco', full: 'San Francisco Intl' },
        'SEA': { city: 'Seattle', full: 'Seattle-Tacoma' },
        'BOS': { city: 'Boston', full: 'Logan Intl' },
        'LAS': { city: 'Las Vegas', full: 'Harry Reid Intl' },
        'PHX': { city: 'Phoenix', full: 'Sky Harbor' },
        'MIA': { city: 'Miami', full: 'Miami Intl' },
        'MCO': { city: 'Orlando', full: 'Orlando Intl' },
        'AUS': { city: 'Austin', full: 'Austin-Bergstrom' }
    };
    const fromCode = from.toUpperCase().substring(0, 3);
    const destCode = to.toUpperCase().substring(0, 3);
    const fromData = airportDB[fromCode] || { city: from, full: from };
    const destData = airportDB[destCode] || { city: to, full: to };
    const flights = [];
    for (let i = 0; i < 4; i++) {
        const airline = airlines[i % airlines.length];
        const basePrice = 320 + Math.floor(Math.random() * 380);
        const duration = 2 + Math.floor(Math.random() * 4);
        const h = 6 + Math.floor(Math.random() * 14);
        const m = Math.floor(Math.random() * 60);
        flights.push({
            id: `direct-${i}`, type: 'direct', airline: airline,
            from: { code: fromCode, city: fromData.city, full: fromData.full },
            to: { code: destCode, city: destData.city, full: destData.full },
            price: basePrice, originalPrice: null, savings: null, duration: duration,
            departTime: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
            arrivalTime: `${(h + duration).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
            stops: 0, date: date
        });
    }
    const hiddenRoutes = findHiddenCityRoutes(fromCode, destCode, flights[0].price);
    hiddenRoutes.forEach((route, i) => {
        const airline = airlines[Math.floor(Math.random() * airlines.length)];
        const h = 6 + Math.floor(Math.random() * 12);
        const m = Math.floor(Math.random() * 60);
        const leg1 = Math.floor(route.totalDuration * 0.45);
        const leg1Arr = h + leg1;
        const leg2Dep = leg1Arr + route.layoverHours;
        const finalArr = leg2Dep + (route.totalDuration - leg1);
        flights.push({
            id: `hidden-${i}`, type: 'hidden', airline: airline,
            from: { code: fromCode, city: fromData.city, full: fromData.full },
            to: { code: route.finalDestination.code, city: route.finalDestination.city, full: route.finalDestination.city },
            stopover: { code: destCode, city: destData.city, full: destData.full },
            realDestination: { code: destCode, city: destData.city, full: destData.full },
            price: route.price, originalPrice: route.originalPrice, savings: route.savings,
            savingsPercent: route.savingsPercent, duration: route.totalDuration,
            departTime: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
            arrivalTime: `${finalArr.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
            stopoverArrival: `${leg1Arr.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
            stopoverDepart: `${leg2Dep.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
            layoverDuration: route.layoverHours, stops: 1, date: date,
            confidence: route.confidence,
            riskAnalysis: analyzeHiddenCityRisk()
        });
    });
    flights.sort((a, b) => a.price - b.price);
    const hidden = flights.filter(f => f.type === 'hidden');
    if (hidden.length) { hidden.sort((a, b) => b.savings - a.savings); hidden[0].isBestDeal = true; }
    return flights;
}

// ============================================================
// API ROUTES
// ============================================================

app.get('/api/health', (req, res) => res.json({
    status: 'ok',
    mode: AMADEUS_CLIENT_ID ? 'LIVE' : 'DEMO',
    apis: { amadeus: !!AMADEUS_CLIENT_ID }
}));

app.get('/api/flights/search', async (req, res) => {
    const { origin, destination, date, hiddenCity = 'true' } = req.query;
    if (!origin || !destination || !date) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }
    try {
        const token = await getAmadeusToken();
        if (token) {
            const amadeusResponse = await axios.get(
                `${AMADEUS_TEST_URL}/v2/shopping/flight-offers`, {
                    params: {
                        originLocationCode: origin.substring(0, 3).toUpperCase(),
                        destinationLocationCode: destination.substring(0, 3).toUpperCase(),
                        departureDate: date, adults: 1, max: 10, currencyCode: 'USD'
                    },
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            const flights = amadeusResponse.data.data.map((offer, i) => ({
                id: `live-${i}`, type: 'direct',
                airline: { name: offer.validatingAirlineCodes[0] || 'Unknown', code: offer.validatingAirlineCodes[0] || 'XX', color: '#c9a96e' },
                from: { code: origin.substring(0, 3).toUpperCase(), city: origin, full: origin },
                to: { code: destination.substring(0, 3).toUpperCase(), city: destination, full: destination },
                price: Math.floor(parseFloat(offer.price.total)),
                duration: offer.itineraries[0]?.duration ? parseInt(offer.itineraries[0].duration.match(/PT(\d+)H/)?.[1] || 3) : 3,
                departTime: offer.itineraries[0]?.segments[0]?.departure?.at?.substring(11, 16) || '09:00',
                arrivalTime: offer.itineraries[0]?.segments[0]?.arrival?.at?.substring(11, 16) || '12:00',
                stops: (offer.itineraries[0]?.segments.length || 1) - 1,
                date, source: 'amadeus'
            }));
            if (hiddenCity === 'true' && flights.length > 0) {
                const directPrice = flights[0].price;
                const mockHidden = generateMockFlightData(origin, destination, date).filter(f => f.type === 'hidden');
                mockHidden.forEach(h => {
                    h.price = Math.floor(directPrice * (0.4 + Math.random() * 0.3));
                    h.originalPrice = directPrice;
                    h.savings = directPrice - h.price;
                    h.savingsPercent = Math.round((h.savings / directPrice) * 100);
                });
                flights.push(...mockHidden);
                flights.sort((a, b) => a.price - b.price);
            }
            return res.json({ flights, source: 'amadeus', meta: { total: flights.length, hidden: flights.filter(f => f.type === 'hidden').length } });
        }
        const flights = generateMockFlightData(origin, destination, date);
        const daysUntil = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
        flights.forEach(f => { f.aiPrediction = predictPriceTrend(f.price, daysUntil); });
        res.json({ flights, source: 'demo', meta: { total: flights.length, hidden: flights.filter(f => f.type === 'hidden').length, note: 'Running in DEMO mode. Add AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET to .env for live data.' } });
    } catch (error) {
        const flights = generateMockFlightData(origin, destination, date);
        res.json({ flights, source: 'demo-fallback', error: error.message });
    }
});

app.get('/api/ai/predict', (req, res) => {
    const { price, days } = req.query;
    res.json(predictPriceTrend(parseFloat(price) || 400, parseInt(days) || 30));
});

app.get('/api/ai/risk', (req, res) => res.json(analyzeHiddenCityRisk()));

app.post('/api/ai/parse', express.json(), (req, res) => res.json(parseNaturalLanguage(req.body.query || '')));

app.get('/api/ai/optimize', (req, res) => {
    const { origin, destination } = req.query;
    const directPrice = 400 + Math.floor(Math.random() * 300);
    const routes = findHiddenCityRoutes(
        origin?.substring(0, 3).toUpperCase() || 'IAH',
        destination?.substring(0, 3).toUpperCase() || 'JFK',
        directPrice
    );
    res.json({ routes, directPrice, potentialSavings: Math.max(...routes.map(r => r.savings), 0) });
});

app.get('/api/airports/search', async (req, res) => {
    const { keyword } = req.query;
    const token = await getAmadeusToken();
    if (token && keyword && keyword.length >= 2) {
        try {
            const response = await axios.get(`${AMADEUS_TEST_URL}/v1/reference-data/locations`, {
                params: { keyword, subType: 'AIRPORT,CITY', 'page[limit]': 10 },
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json(response.data.data.map(loc => ({
                code: loc.iataCode,
                city: loc.address?.cityName || loc.name,
                name: loc.name,
                country: loc.address?.countryName
            })));
        } catch (e) { /* fallback */ }
    }
    const local = [
        { code: 'IAH', city: 'Houston', name: 'Houston (IAH)', country: 'USA' },
        { code: 'JFK', city: 'New York', name: 'New York (JFK)', country: 'USA' },
        { code: 'LAX', city: 'Los Angeles', name: 'Los Angeles (LAX)', country: 'USA' },
        { code: 'ORD', city: 'Chicago', name: 'Chicago (ORD)', country: 'USA' },
        { code: 'DFW', city: 'Dallas', name: 'Dallas (DFW)', country: 'USA' },
        { code: 'DEN', city: 'Denver', name: 'Denver (DEN)', country: 'USA' },
        { code: 'ATL', city: 'Atlanta', name: 'Atlanta (ATL)', country: 'USA' },
        { code: 'SFO', city: 'San Francisco', name: 'San Francisco (SFO)', country: 'USA' },
        { code: 'SEA', city: 'Seattle', name: 'Seattle (SEA)', country: 'USA' },
        { code: 'BOS', city: 'Boston', name: 'Boston (BOS)', country: 'USA' },
        { code: 'LAS', city: 'Las Vegas', name: 'Las Vegas (LAS)', country: 'USA' },
        { code: 'PHX', city: 'Phoenix', name: 'Phoenix (PHX)', country: 'USA' },
        { code: 'MIA', city: 'Miami', name: 'Miami (MIA)', country: 'USA' },
        { code: 'MCO', city: 'Orlando', name: 'Orlando (MCO)', country: 'USA' },
        { code: 'AUS', city: 'Austin', name: 'Austin (AUS)', country: 'USA' }
    ].filter(a => a.city.toLowerCase().includes(keyword?.toLowerCase() || '') || a.code.toLowerCase().includes(keyword?.toLowerCase() || ''));
    res.json(local);
});

const priceAlerts = new Map();
app.post('/api/alerts', (req, res) => {
    const { route, targetPrice, email } = req.body;
    const id = Date.now().toString(36);
    priceAlerts.set(id, { route, targetPrice, email, created: new Date() });
    res.json({ id, status: 'active', message: 'Price alert activated' });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
    console.log(`\n    ╔══════════════════════════════════════════════════════════╗
    ║  AURA — Hidden City Flight Concierge                     ║
    ║  Server running on http://localhost:${PORT}                    ║
    ║  Mode: ${AMADEUS_CLIENT_ID ? 'LIVE (Amadeus Connected)' : 'DEMO (Mock Data)'}              ║
    ╚══════════════════════════════════════════════════════════╝
    `);
});
