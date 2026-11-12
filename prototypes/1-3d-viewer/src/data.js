export const loadData = async () => {
  const [listings, sales, epc, buildingYaml] = await Promise.all([
    fetch('/data/merino-court/listings/rightmove_listings.json').then(r => r.json()),
    fetch('/data/merino-court/listings/sales.json').then(r => r.json()),
    fetch('/data/merino-court/listings/epc_certs.json').then(r => r.json()),
    fetch('/data/merino-court/building/building.yaml').then(r => r.text())
  ]);

  const units = parseUnitsFromYaml(buildingYaml);
  
  return {
    listings,
    sales: sales.sales || [],
    epc,
    units,
    floors: [
      { level: -1, name: 'Lower Ground', short: 'LG' },
      { level: 0, name: 'Ground Floor', short: 'G' },
      { level: 1, name: 'Mezzanine', short: 'M' },
      { level: 2, name: 'First Floor', short: '1' },
      { level: 3, name: 'Second Floor', short: '2' },
      { level: 4, name: 'Third Floor', short: '3' },
      { level: 5, name: 'Fourth Floor', short: '4' }
    ]
  };
};

const parseUnitsFromYaml = (yaml) => {
  const units = [];
  const lines = yaml.split('\n');
  let currentUnit = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('- key:') && line.includes('LW')) {
      currentUnit = { key: line.split('key:')[1].trim(), floors: [] };
    } else if (line.includes('key:') && /key:\s+(LW|M\d|F\d+|H\d)/.test(line)) {
      const match = line.match(/key:\s+(\S+)/);
      if (match) {
        currentUnit = { key: match[1], floors: [] };
      }
    }
    
    if (currentUnit && line.includes('name:')) {
      const match = line.match(/name:\s+(.+)/);
      if (match) currentUnit.name = match[1];
    }
    
    if (currentUnit && line.includes('kind:')) {
      const match = line.match(/kind:\s+(\w+)/);
      if (match) currentUnit.kind = match[1];
    }
    
    if (currentUnit && line.includes('beds:')) {
      const match = line.match(/beds:\s+(\d+)/);
      if (match) currentUnit.beds = parseInt(match[1]);
    }
    
    if (currentUnit && line.includes('gross:')) {
      const m2Match = line.match(/m2:\s+([\d.]+)/);
      const sqftMatch = line.match(/sqft:\s+([\d.]+)/);
      if (m2Match || sqftMatch) {
        currentUnit.gross = {
          m2: m2Match ? parseFloat(m2Match[1]) : null,
          sqft: sqftMatch ? parseFloat(sqftMatch[1]) : null
        };
      }
    }
    
    if (currentUnit && line.includes('- {level:')) {
      const levelMatch = line.match(/level:\s+(-?\d+)/);
      if (levelMatch) {
        currentUnit.floors.push(parseInt(levelMatch[1]));
      }
    }
    
    if (currentUnit && line.match(/^-\s+{?key:/)) {
      if (currentUnit.key) {
        units.push(currentUnit);
      }
      const match = line.match(/key:\s+(\S+)/);
      currentUnit = match ? { key: match[1], floors: [] } : null;
    }
  }
  
  if (currentUnit && currentUnit.key) {
    units.push(currentUnit);
  }
  
  return units;
};

export const getUnitData = (unitKey, data) => {
  const unit = data.units.find(u => u.key === unitKey);
  if (!unit) return null;

  const flatMapping = {
    'LW1': '152 Lever Street',
    'LW2': 'Flat 21',
    'M1': 'Flat 2',
    'M2': 'Flat 3',
    'M3': 'Flat 4',
    'H1': 'Flat 1',
    'MZ1': 'Flat 5',
    'MZ2': 'Flat 6',
    'MZ3': 'Flat 7',
    'MZ4': 'Flat 8',
    'F1': 'Flat 9',
    'F2': 'Flat 10',
    'F3': 'Flat 11',
    'F4': 'Flat 12',
    'F5': 'Flat 13',
    'F6': 'Flat 14',
    'F7': 'Flat 15',
    'F8': 'Flat 16',
    'F9': 'Flat 17',
    'F10': 'Flat 18',
    'F11': 'Flat 19',
    'F12': 'Flat 20'
  };

  const flatKey = flatMapping[unitKey];
  const listing = flatKey ? data.listings[flatKey] : null;
  const salesHistory = data.sales.filter(s => s.saon === flatKey || s.paon.includes(flatKey));
  const epcData = data.epc[flatKey];

  return {
    ...unit,
    flatKey,
    listing,
    salesHistory,
    epc: epcData,
    floorPlanPath: `/data/merino-court/plans/${unitKey.replace('/', '-')}-${unit.floors[0]}.svg`
  };
};
