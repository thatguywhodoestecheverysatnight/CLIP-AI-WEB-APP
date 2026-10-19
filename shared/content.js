// Learning, interpretation and adaptation content for CLIP-AI.
// Quiz answers live here so the server can score submissions authoritatively.

export const CATEGORIES = ['All', 'Weather', 'Water', 'Land', 'Health', 'Architecture'];

export const CATEGORY_STYLE = {
  Weather: { fg: '#7c3aed', bg: '#f5f0ff', border: '#e4d8ff' },
  Water: { fg: '#2563eb', bg: '#eef4ff', border: '#cfe0ff' },
  Land: { fg: '#b7791f', bg: '#fff8e6', border: '#f7e2a8' },
  Health: { fg: '#ea580c', bg: '#fff3ea', border: '#fcd9bd' },
  Architecture: { fg: '#047857', bg: '#ecfdf5', border: '#bfeedd' },
};

export const TOPICS = [
  {
    id: 'climate-change', title: 'What is Climate Change?', category: 'Weather', minutes: 2, icon: '🌍',
    summary: 'Long-term shifts in temperature and weather patterns, now driven mainly by burning fossil fuels.',
    sections: [
      { h: 'The basics', p: 'Weather is what happens today. Climate is the average pattern over 30 years or more. Greenhouse gases such as carbon dioxide and methane trap heat in the atmosphere, and their concentration has risen sharply since the industrial era.' },
      { h: 'What it means for Bengal', p: 'West Bengal sits on the Ganga-Brahmaputra delta, facing the Bay of Bengal. A warmer climate brings hotter and more humid pre-monsoon months, more intense rainfall bursts, stronger cyclones and rising seas that push salt water inland in the Sundarbans.' },
    ],
    keyPoints: ['Climate is the long-term average of weather.', 'Extra greenhouse gases trap extra heat.', 'Deltas like ours feel heat, floods, cyclones and sea-level rise together.'],
    quiz: [
      { q: 'Climate describes weather patterns averaged over roughly how long?', options: ['One week', 'One season', '30 years or more', 'One day'], answer: 2, why: 'Climate normals are usually computed over 30-year periods.' },
      { q: 'Which gas is the largest driver of human-caused warming?', options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Argon'], answer: 1, why: 'CO2 from fossil fuels is the largest contributor.' },
      { q: 'Why is a delta region especially exposed?', options: ['It is far from the sea', 'It is low-lying, coastal and river-fed', 'It has no rainfall', 'It is mountainous'], answer: 1, why: 'Low elevation plus rivers and sea means multiple overlapping hazards.' },
    ],
  },
  {
    id: 'heatwaves', title: 'Heatwaves', category: 'Health', minutes: 1, icon: '🌡️',
    summary: 'Periods of extremely high temperature that stress the body, crops and water supply.',
    sections: [
      { h: 'How IMD defines a heatwave', p: 'In the plains, IMD considers a heatwave when the maximum temperature is at least 40°C and 4.5°C or more above normal, or when it reaches 45°C or more. In coastal stations the threshold is 37°C with the same departure.' },
      { h: 'Why humidity matters', p: 'In humid Bengal, sweat evaporates slowly, so the body cannot cool itself well. The "feels like" temperature can be several degrees above the air temperature.' },
      { h: 'Stay safe', p: 'Drink water often even if not thirsty, avoid outdoor work between 12 pm and 4 pm, wear light loose cotton, and check on elderly neighbours, infants and outdoor workers.' },
    ],
    keyPoints: ['Heatwaves are periods of extremely high temperature.', 'They can affect health, agriculture and water.', 'Stay hydrated and avoid peak afternoon heat.'],
    quiz: [
      { q: 'In the plains, a heatwave can be declared when the maximum temperature reaches at least...', options: ['30°C', '35°C', '40°C with a large departure from normal', '25°C'], answer: 2, why: 'IMD uses 40°C plus a departure of 4.5°C or more, or 45°C outright.' },
      { q: 'Why does humid heat feel worse?', options: ['Sweat evaporates slowly', 'The sun is closer', 'Wind is stronger', 'Air is thinner'], answer: 0, why: 'High humidity slows evaporative cooling of the skin.' },
      { q: 'Which time window is most dangerous for outdoor work?', options: ['6 am to 8 am', '12 pm to 4 pm', '8 pm to 10 pm', 'Midnight'], answer: 1, why: 'Peak heat load is usually early to mid afternoon.' },
    ],
  },
  {
    id: 'floods', title: 'Floods', category: 'Water', minutes: 2, icon: '🌊',
    summary: 'River overflow, heavy rain and blocked drains can flood homes and streets within hours.',
    sections: [
      { h: 'Types of flooding', p: 'Riverine floods come from rivers such as the Damodar, Rupnarayan, Teesta and Ganga. Urban waterlogging happens when intense rain exceeds drain capacity. Coastal flooding comes from storm surge during cyclones.' },
      { h: 'Reading the rain', p: 'IMD calls 64.5 to 115.5 mm in 24 hours heavy rain and 115.6 to 204.4 mm very heavy. Even moderate rain at high tide can waterlog low parts of Kolkata and Howrah.' },
      { h: 'Stay safe', p: 'Never walk or drive through moving water; 15 cm of fast water can knock a person down. Switch off mains power if water enters the house and move documents and medicines to a high shelf.' },
    ],
    keyPoints: ['Floods can be riverine, urban or coastal.', 'Heavy rain is 64.5 mm or more in 24 hours.', 'Do not enter moving water.'],
    quiz: [
      { q: 'IMD classes 24-hour rainfall of 64.5 to 115.5 mm as...', options: ['Light', 'Moderate', 'Heavy', 'Extremely heavy'], answer: 2, why: 'That band is "heavy rainfall" in IMD terminology.' },
      { q: 'What should you do if water enters your home?', options: ['Keep appliances running', 'Switch off the mains power', 'Open the fridge', 'Go to the basement'], answer: 1, why: 'Water and live wiring are a deadly combination.' },
      { q: 'Urban waterlogging is mainly caused by...', options: ['Rain exceeding drain capacity', 'Earthquakes', 'Cold waves', 'Dust storms'], answer: 0, why: 'Drains overwhelmed by intense rain, often worsened by high tide and blockages.' },
    ],
  },
  {
    id: 'cyclones', title: 'Cyclones', category: 'Weather', minutes: 2, icon: '🌀',
    summary: 'The Bay of Bengal is one of the most active cyclone basins on Earth.',
    sections: [
      { h: 'How strong is strong?', p: 'IMD grades systems by sustained wind: Depression 31 to 49 km/h, Cyclonic Storm 62 to 88, Severe Cyclonic Storm 89 to 117, Very Severe 118 to 166, Extremely Severe 167 to 221 and Super Cyclone 222 km/h or more.' },
      { h: 'Recent memory', p: 'Aila (2009), Bulbul (2019), Amphan (2020), Yaas (2021) and Remal (2024) all hit coastal Bengal. Amphan was the strongest, causing wide damage to Kolkata and the Sundarbans.' },
      { h: 'Biggest killer: surge', p: 'Storm surge, the sea water pushed ashore by wind, causes most cyclone deaths. Follow evacuation orders for low-lying coastal blocks early.' },
    ],
    keyPoints: ['Cyclonic storm winds start at 62 km/h.', 'Storm surge is the greatest danger.', 'Evacuate early when advised.'],
    quiz: [
      { q: 'A Cyclonic Storm has sustained winds of...', options: ['31-49 km/h', '62-88 km/h', '222+ km/h', '10-20 km/h'], answer: 1, why: 'IMD category "Cyclonic Storm" is 62 to 88 km/h.' },
      { q: 'What causes most deaths in a cyclone?', options: ['Lightning', 'Storm surge', 'Heat', 'Fog'], answer: 1, why: 'Surge flooding along the coast is historically the deadliest element.' },
      { q: 'Which was a recent super-strength cyclone affecting Bengal?', options: ['Amphan (2020)', 'Katrina', 'Haiyan', 'Sandy'], answer: 0, why: 'Amphan reached super cyclone strength over the Bay of Bengal in May 2020.' },
    ],
  },
  {
    id: 'salinity', title: 'Salinity & Sea-level Rise', category: 'Water', minutes: 2, icon: '🧂',
    summary: 'Rising seas and surges push salt water into fields, ponds and groundwater.',
    sections: [
      { h: 'What is happening', p: 'Relative sea level in the Sundarbans is rising faster than the global average because the delta is also sinking. Cyclone surges break embankments and leave salt on farmland for seasons.' },
      { h: 'Impacts', p: 'Salt reduces rice yields, kills freshwater fish and makes drinking water unsafe. Families often must travel far for potable water.' },
      { h: 'Adapting', p: 'Salt-tolerant rice varieties, raised freshwater ponds, rooftop rainwater harvesting and mangrove restoration all help.' },
    ],
    keyPoints: ['Sea-level rise and surges bring salt inland.', 'Salt harms crops, fish and drinking water.', 'Mangroves and rainwater harvesting help.'],
    quiz: [
      { q: 'Why is relative sea-level rise faster in the Sundarbans?', options: ['The land is also sinking', 'There is less rain', 'It is colder', 'There are no rivers'], answer: 0, why: 'Delta subsidence adds to global sea-level rise.' },
      { q: 'Which natural barrier reduces surge and erosion?', options: ['Mangroves', 'Deserts', 'Glaciers', 'Sand dunes inland'], answer: 0, why: 'Mangrove belts dissipate wave and surge energy.' },
      { q: 'A good household response to salty groundwater is...', options: ['Rooftop rainwater harvesting', 'Digging deeper only', 'Drinking pond water untreated', 'Ignoring it'], answer: 0, why: 'Collected rainwater provides a fresh supply.' },
    ],
  },
  {
    id: 'landslides', title: 'Landslides', category: 'Land', minutes: 2, icon: '⛰️',
    summary: 'In the Darjeeling and Kalimpong hills, intense monsoon rain can trigger slope failures.',
    sections: [
      { h: 'Why slopes fail', p: 'Water fills soil pores, adds weight and reduces friction. Road cutting, loss of trees and blocked drainage make slopes weaker.' },
      { h: 'Warning signs', p: 'New cracks in walls or ground, tilting trees or poles, sudden muddy water in streams, and rumbling sounds are signs to move away.' },
      { h: 'Stay safe', p: 'Avoid travel on hill roads during very heavy rain alerts and keep drains above your home clear.' },
    ],
    keyPoints: ['Heavy rain saturates and weakens slopes.', 'Cracks and tilting trees are warning signs.', 'Avoid hill roads during heavy rain alerts.'],
    quiz: [
      { q: 'Which is a landslide warning sign?', options: ['New cracks in the ground', 'Clear streams', 'Cool breeze', 'Birdsong'], answer: 0, why: 'Ground and wall cracks indicate slope movement.' },
      { q: 'What weakens a slope the most during monsoon?', options: ['Water saturation', 'Sunlight', 'Snow', 'Wind'], answer: 0, why: 'Saturated soil is heavier and loses strength.' },
      { q: 'Which districts in West Bengal face the highest landslide risk?', options: ['Darjeeling and Kalimpong', 'Purulia and Bankura', 'Kolkata and Howrah', 'Nadia and Hooghly'], answer: 0, why: 'They lie in the Himalayan foothills.' },
    ],
  },
  {
    id: 'urban-heat', title: 'Urban Heat Island', category: 'Health', minutes: 2, icon: '🏙️',
    summary: 'Concrete, asphalt and few trees make cities several degrees hotter than nearby villages.',
    sections: [
      { h: 'The effect', p: 'Dark roofs and roads absorb sunlight by day and release it at night, so cities do not cool down. Air-conditioner exhaust and traffic add more heat.' },
      { h: 'Cooling the city', p: 'Street trees, water bodies, light-coloured roofs and shaded walkways can cut surface temperatures sharply and lower night-time air temperature.' },
    ],
    keyPoints: ['Cities trap heat in hard surfaces.', 'Nights stay warm, which harms sleep and health.', 'Trees, water and cool roofs reduce the effect.'],
    quiz: [
      { q: 'Why do cities stay hot at night?', options: ['Hard surfaces release stored heat', 'The moon is warm', 'There is more wind', 'Rivers boil'], answer: 0, why: 'Thermal mass of concrete and asphalt re-radiates heat after sunset.' },
      { q: 'Which roof finish stays coolest in the sun?', options: ['Black tar', 'Dark tin', 'White or light reflective coat', 'Red brick'], answer: 2, why: 'High solar reflectance means less heat absorbed.' },
      { q: 'A low-cost street-level fix is...', options: ['Planting shade trees', 'Removing parks', 'More asphalt', 'Closing ponds'], answer: 0, why: 'Trees shade surfaces and cool air through evapotranspiration.' },
    ],
  },
  {
    id: 'climate-responsive-architecture', title: 'Climate-Responsive Architecture', category: 'Architecture', minutes: 3, icon: '🏡',
    summary: 'Buildings designed with the local climate stay cooler, drier and safer with less energy.',
    sections: [
      { h: 'Design for warm-humid Bengal', p: 'Our climate is hot and humid for most of the year. The aim is to block the sun, move air through rooms, shed heavy rain and stay above flood water. Traditional Bengal homes did this with deep verandahs, sloping roofs, raised plinths and courtyards.' },
      { h: 'Key strategies', p: 'Orient long walls north-south to reduce east-west sun. Use deep overhangs (chajjas) and jaali screens for shade. Place windows on opposite walls for cross ventilation. Keep roofs light coloured or green. Raise the plinth above known flood level and lift electrical points.' },
      { h: 'Materials', p: 'In humid climates lightweight, breathable materials that do not store much heat help night cooling. Local options include bamboo, lime plaster, terracotta tiles and rat-trap bond brickwork, which uses fewer bricks and adds an insulating air gap.' },
      { h: 'Water as a resource', p: 'Rainwater harvesting tanks, permeable paving and rain gardens reduce waterlogging and store water for dry months.' },
    ],
    keyPoints: ['Shade, ventilate, shed rain and stay above flood level.', 'Overhangs, jaalis, courtyards and cool roofs reduce indoor heat.', 'Raised plinths and lifted switches protect against floods.'],
    quiz: [
      { q: 'In a warm-humid climate, which strategy matters most for comfort?', options: ['Cross ventilation', 'Sealed small windows', 'Thick heat-storing walls everywhere', 'Black roofs'], answer: 0, why: 'Air movement is the main driver of comfort in humid heat.' },
      { q: 'Which façade orientation should get the fewest large windows?', options: ['West', 'North', 'Courtyard side', 'None of these'], answer: 0, why: 'Low afternoon western sun is hardest to shade and heats rooms.' },
      { q: 'What does a raised plinth protect against?', options: ['Flood water entering the home', 'Earthquakes only', 'Noise', 'Dust storms'], answer: 0, why: 'Raising the floor above flood level keeps water out.' },
    ],
  },
  {
    id: 'rainwater', title: 'Rainwater Harvesting', category: 'Water', minutes: 2, icon: '💧',
    summary: 'Capture monsoon rain from roofs to cut waterlogging and secure drinking water.',
    sections: [
      { h: 'How much can a roof give?', p: 'Every 1 mm of rain on 1 square metre gives about 1 litre. A 50 square metre roof in a 1,600 mm rainfall year can yield roughly 64,000 litres after losses.' },
      { h: 'Simple system', p: 'Gutters lead to a first-flush diverter, a mesh filter and a covered storage tank. Overflow goes to a recharge pit to refill groundwater.' },
    ],
    keyPoints: ['1 mm on 1 m² is about 1 litre.', 'First-flush diverters keep the tank clean.', 'Recharge pits reduce street flooding.'],
    quiz: [
      { q: '10 mm of rain on a 20 m² roof yields about...', options: ['20 litres', '200 litres', '2,000 litres', '2 litres'], answer: 1, why: '10 mm x 20 m² = 200 litres before losses.' },
      { q: 'What is a first-flush diverter for?', options: ['Discarding the dirtiest first rain', 'Heating water', 'Adding salt', 'Pumping sewage'], answer: 0, why: 'The first rain washes dust and debris off the roof.' },
      { q: 'Where should tank overflow go?', options: ['A recharge pit', 'The living room', 'An electrical box', 'A neighbour\'s roof'], answer: 0, why: 'Recharge pits return water to the ground and ease drains.' },
    ],
  },
  {
    id: 'lightning', title: 'Thunderstorms & Lightning', category: 'Weather', minutes: 1, icon: '⚡',
    summary: 'Pre-monsoon nor\'westers (Kalbaishakhi) bring sudden squalls and deadly lightning.',
    sections: [
      { h: 'Kalbaishakhi', p: 'From March to May, evening thunderstorms sweep in from the north-west with strong gusts, hail and lightning. Lightning is among the leading weather-related killers in India.' },
      { h: 'Stay safe', p: 'When thunder roars, go indoors. Avoid open fields, water bodies and isolated trees. If caught outside, crouch low with feet together. The government Damini app gives lightning alerts.' },
    ],
    keyPoints: ['Nor\'westers hit in the pre-monsoon season.', 'Go indoors when you hear thunder.', 'Avoid open fields, water and lone trees.'],
    quiz: [
      { q: 'Kalbaishakhi storms are most common in...', options: ['March to May', 'December', 'August only', 'January'], answer: 0, why: 'They are a pre-monsoon phenomenon.' },
      { q: 'Where is it unsafe to shelter in lightning?', options: ['Under an isolated tree', 'Inside a closed building', 'Inside a car with windows up', 'In a concrete house'], answer: 0, why: 'Tall isolated objects attract strikes.' },
      { q: 'If caught outdoors you should...', options: ['Crouch low with feet together', 'Lie flat', 'Hold an umbrella high', 'Stand in water'], answer: 0, why: 'This minimises height and ground-current exposure.' },
    ],
  },
];

// IMD colour-coded impact-based warnings.
export const IMD_LEVELS = {
  green: { label: 'Green', meaning: 'No warning. No action needed.', color: '#16a34a' },
  yellow: { label: 'Yellow', meaning: 'Watch. Be aware and stay updated.', color: '#eab308' },
  orange: { label: 'Orange', meaning: 'Alert. Be prepared to act.', color: '#f97316' },
  red: { label: 'Red', meaning: 'Warning. Take action now.', color: '#dc2626' },
};

export const WARNINGS = [
  {
    id: 'heavy-rain-orange', hazard: 'rainfall', level: 'orange', title: 'Heavy rainfall likely in next 48 hours',
    detail: 'Heavy to very heavy rainfall (64.5 to 204.4 mm) likely at isolated places. Waterlogging in low-lying urban areas possible.',
    local: [
      { icon: '💧', text: 'Water may accumulate in low-lying areas.' },
      { icon: '🏠', text: 'Short-term flooding possible near drains and canals.' },
      { icon: '👨‍👩‍👧', text: 'Elderly, children and outdoor workers are vulnerable.' },
    ],
    watch: ['Rainfall', 'Flood', 'Wind'],
    questions: [
      { q: 'What does an ORANGE alert ask you to do?', options: ['Nothing', 'Be prepared to act', 'Evacuate immediately', 'Ignore unless red'], answer: 1 },
      { q: 'How much rain does "very heavy" mean in 24 hours?', options: ['2.5-15.5 mm', '15.6-64.4 mm', '115.6-204.4 mm', 'Over 500 mm'], answer: 2 },
      { q: 'Which is the best first action today?', options: ['Clear the drain outside your home and move valuables up', 'Plan a picnic by the river', 'Park the car in an underpass', 'Switch off your phone'], answer: 0 },
    ],
  },
  {
    id: 'heatwave-yellow', hazard: 'heat', level: 'yellow', title: 'Heatwave conditions likely at isolated places',
    detail: 'Maximum temperature 40-42°C with hot and humid discomfort. Departure from normal 4.5°C or more.',
    local: [
      { icon: '🥵', text: 'Heat stress risk for outdoor workers between 12 pm and 4 pm.' },
      { icon: '👵', text: 'Elderly and infants need extra fluids and shade.' },
      { icon: '🐄', text: 'Livestock need shade and water.' },
    ],
    watch: ['Heat', 'Humidity'],
    questions: [
      { q: 'A YELLOW alert means...', options: ['Watch, stay updated', 'Take action now', 'All clear', 'Evacuate'], answer: 0 },
      { q: 'Who is most vulnerable here?', options: ['Outdoor workers, elderly and infants', 'Only athletes', 'Nobody', 'Only people in the hills'], answer: 0 },
      { q: 'Best way to reduce indoor heat this afternoon?', options: ['Shade west windows and ventilate at night', 'Close all windows at night', 'Cook on gas at noon', 'Use dark curtains on the outside'], answer: 0 },
    ],
  },
  {
    id: 'cyclone-red', hazard: 'cyclone', level: 'red', title: 'Severe Cyclonic Storm approaching the coast',
    detail: 'Sustained winds 100-110 km/h gusting to 120 km/h. Storm surge of 2-3 m above astronomical tide likely in coastal South 24 Parganas and Purba Medinipur.',
    local: [
      { icon: '🌊', text: 'Storm surge may flood low coastal blocks and islands.' },
      { icon: '🏚️', text: 'Kutcha houses and tin roofs at risk of damage.' },
      { icon: '🚤', text: 'Fishermen must not venture into the sea.' },
    ],
    watch: ['Wind', 'Surge', 'Rainfall'],
    questions: [
      { q: 'A RED alert means...', options: ['Take action now', 'Be aware', 'No warning', 'Weather is fine'], answer: 0 },
      { q: 'Sustained winds of 89-117 km/h correspond to...', options: ['Depression', 'Cyclonic Storm', 'Severe Cyclonic Storm', 'Super Cyclone'], answer: 2 },
      { q: 'If your block is told to evacuate, you should...', options: ['Go to the cyclone shelter early', 'Wait for the eye to pass', 'Go to the beach to watch', 'Stay in a kutcha house'], answer: 0 },
    ],
  },
  {
    id: 'thunderstorm-yellow', hazard: 'cyclone', level: 'yellow', title: 'Thunderstorm with lightning and gusty winds',
    detail: 'Thunderstorm with lightning and gusty wind 40-50 km/h likely in the evening hours.',
    local: [
      { icon: '⚡', text: 'Lightning risk in open fields and water bodies.' },
      { icon: '🌳', text: 'Weak trees and hoardings may fall.' },
      { icon: '🔌', text: 'Short power cuts possible.' },
    ],
    watch: ['Wind', 'Lightning'],
    questions: [
      { q: 'When you hear thunder you should...', options: ['Go indoors', 'Shelter under a lone tree', 'Swim', 'Fly a kite'], answer: 0 },
      { q: 'Gusts of 40-50 km/h can...', options: ['Bring down weak branches and hoardings', 'Cause a tsunami', 'Freeze ponds', 'Do nothing'], answer: 0 },
      { q: 'A yellow alert asks you to...', options: ['Stay aware and updated', 'Evacuate', 'Ignore it', 'Panic'], answer: 0 },
    ],
  },
];

export const CHECKLIST = [
  { id: 'contacts', text: 'Emergency contacts saved' },
  { id: 'water', text: 'Drinking water stored' },
  { id: 'firstaid', text: 'First aid kit ready' },
  { id: 'documents', text: 'Important documents safe' },
];

export const ACTIONS = [
  { id: 'alerts', icon: '🔔', text: 'Stay updated with official alerts.', hazards: ['all'] },
  { id: 'avoid-water', icon: '🚫', text: 'Avoid waterlogged areas.', hazards: ['rainfall', 'flood'] },
  { id: 'protect-vulnerable', icon: '🧓', text: 'Protect elderly and children.', hazards: ['heat', 'flood', 'cyclone'] },
  { id: 'kit', icon: '🎒', text: 'Keep emergency kit ready.', hazards: ['cyclone', 'flood', 'landslide'] },
  { id: 'neighbours', icon: '🤝', text: 'Check on neighbours and community.', hazards: ['all'] },
  { id: 'hydrate', icon: '🥤', text: 'Drink water every hour, avoid 12-4 pm sun.', hazards: ['heat'] },
  { id: 'secure', icon: '🪟', text: 'Secure loose roof sheets and objects.', hazards: ['cyclone'] },
  { id: 'slopes', icon: '⛰️', text: 'Avoid hill roads and steep slopes.', hazards: ['landslide'] },
  { id: 'freshwater', icon: '🚰', text: 'Protect freshwater stores from salt water.', hazards: ['salinity'] },
];

export const TIPS = [
  { icon: '🌱', text: 'Plant trees around your home to reduce runoff and heat.' },
  { icon: '💦', text: 'Store clean drinking water, aim for 3 litres per person per day.' },
  { icon: '🔋', text: 'Charge all devices and power banks before a storm.' },
  { icon: '🏥', text: 'Know your nearest shelter, hospital and evacuation route.' },
  { icon: '🏠', text: 'Paint the roof white or add a green roof to cut indoor heat.' },
  { icon: '⚡', text: 'Raise switches and the meter board above flood level.' },
];

// Architecture lab strategies. Effects are heuristic, indicative values
// drawn from passive design literature for warm-humid climates.
export const LAB_STRATEGIES = [
  { id: 'orientation', label: 'North-south orientation', icon: '🧭', cool: 1.2, flood: 0, energy: 6, info: 'Long walls face north and south, cutting low east and west sun.' },
  { id: 'overhang', label: 'Deep chajja overhangs', icon: '⛱️', cool: 1.5, flood: 0, energy: 8, info: 'Overhangs of about 0.6 to 0.9 m shade windows from high summer sun.' },
  { id: 'jaali', label: 'Jaali screens', icon: '🔳', cool: 0.9, flood: 0, energy: 4, info: 'Perforated screens shade while letting breeze and diffuse light in.' },
  { id: 'crossvent', label: 'Cross ventilation', icon: '🌬️', cool: 2.0, flood: 0, energy: 12, info: 'Openings on opposite walls let air sweep through rooms.' },
  { id: 'coolroof', label: 'Cool / green roof', icon: '🌿', cool: 2.2, flood: 6, energy: 12, info: 'Reflective or planted roofs absorb far less heat than dark roofs.' },
  { id: 'courtyard', label: 'Courtyard', icon: '⬜', cool: 1.0, flood: 0, energy: 5, info: 'A shaded courtyard draws hot air up and out by stack effect.' },
  { id: 'plinth', label: 'Raised plinth (+0.9 m)', icon: '⬆️', cool: 0, flood: 45, energy: 0, info: 'Lifts the floor above typical flood water levels.' },
  { id: 'rwh', label: 'Rainwater harvesting', icon: '🛢️', cool: 0, flood: 15, energy: 2, info: 'Captures roof runoff, easing street drains and storing water.' },
  { id: 'trees', label: 'Shade trees (S-W)', icon: '🌳', cool: 1.4, flood: 8, energy: 7, info: 'Trees on the south-west shade walls and cool air by evapotranspiration.' },
];

export function scoreQuiz(questions, answers) {
  if (!Array.isArray(questions) || !Array.isArray(answers) || !questions.length) return 0;
  let right = 0;
  questions.forEach((q, i) => { if (Number(answers[i]) === q.answer) right += 1; });
  return Math.round((right / questions.length) * 100);
}

export function labMetrics(config = {}) {
  const on = LAB_STRATEGIES.filter((s) => config[s.id]);
  // Diminishing returns on stacked cooling measures.
  const coolRaw = on.reduce((a, s) => a + s.cool, 0);
  const cooling = Math.round((7 * (1 - Math.exp(-coolRaw / 6))) * 10) / 10;
  const flood = Math.min(95, 20 + on.reduce((a, s) => a + s.flood, 0));
  const energy = Math.min(60, on.reduce((a, s) => a + s.energy, 0));
  const comfort = Math.round(Math.min(100, 30 + cooling * 7 + (config.crossvent ? 8 : 0)));
  return { cooling, flood, energy, comfort, count: on.length };
}
