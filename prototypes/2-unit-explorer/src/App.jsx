import React, { useState, useEffect } from 'react';
import './App.css';

const UNIT_FLAT_MAP = {
  'LW1': '152 Lever Street', 'LW2': 'Flat 21', 'M1': 'Flat 2', 'M2': 'Flat 3', 'M3': 'Flat 4',
  'H1': 'Flat 1', 'MZ1': 'Flat 5', 'MZ2': 'Flat 6', 'MZ3': 'Flat 7', 'MZ4': 'Flat 8',
  'F1': 'Flat 9', 'F2': 'Flat 10', 'F3': 'Flat 11', 'F4': 'Flat 12', 'F5': 'Flat 13',
  'F6': 'Flat 14', 'F7': 'Flat 15', 'F8': 'Flat 16', 'F9': 'Flat 17', 'F10': 'Flat 18',
  'F11': 'Flat 19', 'F12': 'Flat 20'
};

const FLOOR_NAMES = {
  '-1': 'Lower Ground', '0': 'Ground', '1': 'Mezzanine', 
  '2': 'First', '3': 'Second', '4': 'Third', '5': 'Fourth'
};

const loadData = async () => {
  const [listingsRes, salesRes, epcRes, buildingYamlRes] = await Promise.all([
    fetch('/data/merino-court/listings/rightmove_listings.json'),
    fetch('/data/merino-court/listings/sales.json'),
    fetch('/data/merino-court/listings/epc_certs.json'),
    fetch('/data/merino-court/building/building.yaml')
  ]);

  const listings = await listingsRes.json();
  const sales = await salesRes.json();
  const epc = await epcRes.json();
  const yamlText = await buildingYamlRes.text();

  const units = parseUnits(yamlText);
  
  return units.map(unit => {
    const flatKey = UNIT_FLAT_MAP[unit.key];
    const unitSales = sales.sales.filter(s => 
      s.saon === flatKey || s.paon.includes(flatKey.replace('Flat ', ''))
    );
    const latestPrice = unitSales.length > 0 
      ? Math.max(...unitSales.map(s => s.price))
      : null;

    return {
      ...unit,
      flatKey,
      listing: listings[flatKey],
      sales: unitSales,
      latestPrice,
      epc: epc[flatKey]
    };
  });
};

const parseUnits = (yaml) => {
  const units = [];
  const lines = yaml.split('\n');
  let unit = null;

  for (const line of lines) {
    if (line.match(/^- key:\s+\w/) || line.match(/^-\s+\{key:/)) {
      if (unit) units.push(unit);
      const keyMatch = line.match(/key:\s+(\w+)/);
      unit = keyMatch ? { key: keyMatch[1], floors: [] } : null;
    }
    
    if (unit) {
      const nameMatch = line.match(/name:\s+(.+)/);
      if (nameMatch) unit.name = nameMatch[1];
      
      const kindMatch = line.match(/kind:\s+(\w+)/);
      if (kindMatch) unit.kind = kindMatch[1];
      
      const bedsMatch = line.match(/beds:\s+(\d+)/);
      if (bedsMatch) unit.beds = parseInt(bedsMatch[1]);
      
      const m2Match = line.match(/m2:\s+([\d.]+)/);
      if (m2Match) unit.m2 = parseFloat(m2Match[1]);
      
      const sqftMatch = line.match(/sqft:\s+([\d.]+)/);
      if (sqftMatch) unit.sqft = parseFloat(sqftMatch[1]);
      
      const levelMatch = line.match(/\{level:\s+(-?\d+)/);
      if (levelMatch) unit.floors.push(parseInt(levelMatch[1]));
    }
  }
  if (unit) units.push(unit);
  
  return units;
};

const UnitCard = ({ unit, isSelected, onSelect, onCompare, isComparing, language }) => {
  const firstFloor = unit.floors[0];
  const svgPath = language === 'zh'
    ? `/data/merino-court/plans/zh/${unit.key.replace('/', '-')}-${firstFloor}.svg`
    : `/data/merino-court/plans/${unit.key.replace('/', '-')}-${firstFloor}.svg`;

  return (
    <div className={`unit-card ${isSelected ? 'selected' : ''}`} onClick={() => onSelect(unit)}>
      <div className="card-header">
        <div>
          <h3>{unit.name || unit.key}</h3>
          <p className="flat-key">{unit.flatKey}</p>
        </div>
        <button 
          className={`compare-btn ${isComparing ? 'comparing' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onCompare(unit);
          }}
        >
          {isComparing ? '✓' : '+'}
        </button>
      </div>

      <div className="card-image">
        {unit.listing?.photos?.[0] ? (
          <img src={unit.listing.photos[0]} alt={unit.name} />
        ) : (
          <div className="no-image">No Image</div>
        )}
      </div>

      <div className="card-content">
        <div className="unit-stats">
          <div className="stat">
            <span className="stat-label">{language === 'zh' ? '卧室' : 'Beds'}</span>
            <span className="stat-value">{unit.beds}</span>
          </div>
          <div className="stat">
            <span className="stat-label">{language === 'zh' ? '面积' : 'Area'}</span>
            <span className="stat-value">{Math.round(unit.m2)} m²</span>
          </div>
          <div className="stat">
            <span className="stat-label">{language === 'zh' ? '楼层' : 'Floor'}</span>
            <span className="stat-value">{FLOOR_NAMES[unit.floors[0]]}</span>
          </div>
        </div>

        {unit.latestPrice && (
          <div className="price">
            £{unit.latestPrice.toLocaleString()}
          </div>
        )}

        {unit.epc?.current_rating && (
          <div className="epc-mini" data-rating={unit.epc.current_rating}>
            EPC: {unit.epc.current_rating}
          </div>
        )}
      </div>
    </div>
  );
};

const ComparisonView = ({ units, onClose, language }) => {
  return (
    <div className="comparison-modal">
      <div className="comparison-content">
        <div className="comparison-header">
          <h2>{language === 'zh' ? '单元比较' : 'Unit Comparison'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="comparison-grid">
          {units.map(unit => {
            const firstFloor = unit.floors[0];
            const svgPath = language === 'zh'
              ? `/data/merino-court/plans/zh/${unit.key.replace('/', '-')}-${firstFloor}.svg`
              : `/data/merino-court/plans/${unit.key.replace('/', '-')}-${firstFloor}.svg`;

            return (
              <div key={unit.key} className="comparison-unit">
                <h3>{unit.name || unit.key}</h3>
                <p className="flat-key">{unit.flatKey}</p>

                {unit.listing?.photos?.[0] && (
                  <img src={unit.listing.photos[0]} alt={unit.name} className="comparison-photo" />
                )}

                <div className="comparison-details">
                  <div className="detail-row">
                    <span>{language === 'zh' ? '类型' : 'Type'}:</span>
                    <strong>{unit.kind?.replace('_', ' ')}</strong>
                  </div>
                  <div className="detail-row">
                    <span>{language === 'zh' ? '卧室' : 'Bedrooms'}:</span>
                    <strong>{unit.beds}</strong>
                  </div>
                  <div className="detail-row">
                    <span>{language === 'zh' ? '面积' : 'Area'}:</span>
                    <strong>{Math.round(unit.m2)} m² ({Math.round(unit.sqft)} sq ft)</strong>
                  </div>
                  <div className="detail-row">
                    <span>{language === 'zh' ? '楼层' : 'Floors'}:</span>
                    <strong>{unit.floors.map(f => FLOOR_NAMES[f]).join(', ')}</strong>
                  </div>
                  {unit.latestPrice && (
                    <div className="detail-row">
                      <span>{language === 'zh' ? '最新价格' : 'Latest Price'}:</span>
                      <strong className="price-highlight">£{unit.latestPrice.toLocaleString()}</strong>
                    </div>
                  )}
                  {unit.epc?.current_rating && (
                    <div className="detail-row">
                      <span>EPC {language === 'zh' ? '等级' : 'Rating'}:</span>
                      <strong className={`epc-rating-${unit.epc.current_rating}`}>
                        {unit.epc.current_rating}
                      </strong>
                    </div>
                  )}
                </div>

                <div className="floorplan-preview">
                  <img src={svgPath} alt="Floor plan" onError={(e) => e.target.style.display = 'none'} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [units, setUnits] = useState([]);
  const [filteredUnits, setFilteredUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [compareUnits, setCompareUnits] = useState([]);
  const [showComparison, setShowComparison] = useState(false);
  const [filters, setFilters] = useState({ beds: 'all', floor: 'all', type: 'all' });
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData().then(data => {
      setUnits(data);
      setFilteredUnits(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let filtered = units;
    
    if (filters.beds !== 'all') {
      filtered = filtered.filter(u => u.beds === parseInt(filters.beds));
    }
    
    if (filters.floor !== 'all') {
      filtered = filtered.filter(u => u.floors.includes(parseInt(filters.floor)));
    }
    
    if (filters.type !== 'all') {
      filtered = filtered.filter(u => u.kind === filters.type);
    }
    
    setFilteredUnits(filtered);
  }, [filters, units]);

  const handleCompare = (unit) => {
    if (compareUnits.find(u => u.key === unit.key)) {
      setCompareUnits(compareUnits.filter(u => u.key !== unit.key));
    } else if (compareUnits.length < 3) {
      setCompareUnits([...compareUnits, unit]);
    }
  };

  if (loading) {
    return <div className="loading">Loading units...</div>;
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div>
            <h1>Merino Court Unit Explorer</h1>
            <p>152-154 Lever Street, London EC1V 8BG • {units.length} Units Available</p>
          </div>
          <div className="lang-toggle">
            <button 
              className={language === 'en' ? 'active' : ''}
              onClick={() => setLanguage('en')}
            >
              English
            </button>
            <button 
              className={language === 'zh' ? 'active' : ''}
              onClick={() => setLanguage('zh')}
            >
              中文
            </button>
          </div>
        </div>
      </header>

      <div className="filters">
        <select 
          value={filters.beds}
          onChange={(e) => setFilters({ ...filters, beds: e.target.value })}
        >
          <option value="all">{language === 'zh' ? '所有卧室' : 'All Bedrooms'}</option>
          <option value="1">1 {language === 'zh' ? '卧室' : 'Bed'}</option>
          <option value="2">2 {language === 'zh' ? '卧室' : 'Beds'}</option>
          <option value="3">3 {language === 'zh' ? '卧室' : 'Beds'}</option>
        </select>

        <select 
          value={filters.floor}
          onChange={(e) => setFilters({ ...filters, floor: e.target.value })}
        >
          <option value="all">{language === 'zh' ? '所有楼层' : 'All Floors'}</option>
          {Object.entries(FLOOR_NAMES).map(([level, name]) => (
            <option key={level} value={level}>{name}</option>
          ))}
        </select>

        <select 
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
        >
          <option value="all">{language === 'zh' ? '所有类型' : 'All Types'}</option>
          <option value="flat">{language === 'zh' ? '公寓' : 'Flat'}</option>
          <option value="penthouse">{language === 'zh' ? '顶层公寓' : 'Penthouse'}</option>
          <option value="mews">{language === 'zh' ? '联排别墅' : 'Mews'}</option>
          <option value="town_house">{language === 'zh' ? '联排住宅' : 'Town House'}</option>
          <option value="live_work">{language === 'zh' ? '居住工作室' : 'Live/Work'}</option>
        </select>

        {compareUnits.length > 0 && (
          <button 
            className="compare-action-btn"
            onClick={() => setShowComparison(true)}
          >
            {language === 'zh' ? '比较' : 'Compare'} ({compareUnits.length})
          </button>
        )}
      </div>

      <div className="units-grid">
        {filteredUnits.map(unit => (
          <UnitCard
            key={unit.key}
            unit={unit}
            isSelected={selectedUnit?.key === unit.key}
            onSelect={setSelectedUnit}
            onCompare={handleCompare}
            isComparing={compareUnits.some(u => u.key === unit.key)}
            language={language}
          />
        ))}
      </div>

      {filteredUnits.length === 0 && (
        <div className="no-results">
          {language === 'zh' ? '未找到匹配的单元' : 'No units match your filters'}
        </div>
      )}

      {showComparison && compareUnits.length > 0 && (
        <ComparisonView
          units={compareUnits}
          onClose={() => setShowComparison(false)}
          language={language}
        />
      )}
    </div>
  );
};

export default App;
