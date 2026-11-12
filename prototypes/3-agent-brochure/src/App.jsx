import React, { useState, useEffect } from 'react';
import './App.css';

const UNIT_FLAT_MAP = {
  'LW1': '152 Lever Street', 'LW2': 'Flat 21', 'M1': 'Flat 2', 'M2': 'Flat 3', 'M3': 'Flat 4',
  'H1': 'Flat 1', 'MZ1': 'Flat 5', 'MZ2': 'Flat 6', 'MZ3': 'Flat 7', 'MZ4': 'Flat 8',
  'F1': 'Flat 9', 'F2': 'Flat 10', 'F3': 'Flat 11', 'F4': 'Flat 12', 'F5': 'Flat 13',
  'F6': 'Flat 14', 'F7': 'Flat 15', 'F8': 'Flat 16', 'F9': 'Flat 17', 'F10': 'Flat 18',
  'F11': 'Flat 19', 'F12': 'Flat 20'
};

const loadData = async () => {
  const [listingsRes, salesRes, epcRes, factsRes, buildingYamlRes] = await Promise.all([
    fetch('/data/merino-court/listings/rightmove_listings.json'),
    fetch('/data/merino-court/listings/sales.json'),
    fetch('/data/merino-court/listings/epc_certs.json'),
    fetch('/data/merino-court/listings/building_facts.json'),
    fetch('/data/merino-court/building/building.yaml')
  ]);

  const listings = await listingsRes.json();
  const sales = await salesRes.json();
  const epc = await epcRes.json();
  const facts = await factsRes.json();
  const yamlText = await buildingYamlRes.text();

  const units = parseUnits(yamlText);
  
  return {
    units: units.map(unit => {
      const flatKey = UNIT_FLAT_MAP[unit.key];
      const unitSales = sales.sales.filter(s => 
        s.saon === flatKey || s.paon.includes(flatKey.replace('Flat ', ''))
      );

      return {
        ...unit,
        flatKey,
        listing: listings[flatKey],
        sales: unitSales,
        epc: epc[flatKey]
      };
    }),
    facts
  };
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

const Hero = ({ language }) => {
  return (
    <section className="hero">
      <div className="hero-content">
        <div className="hero-badge">{language === 'zh' ? '豪华发展' : 'LUXURY DEVELOPMENT'}</div>
        <h1 className="hero-title">Merino Court</h1>
        <p className="hero-subtitle">
          {language === 'zh' 
            ? '伦敦EC1V，利弗街152-154号' 
            : '152-154 Lever Street, London EC1V 8BG'}
        </p>
        <div className="hero-features">
          <div className="feature">
            <span className="feature-number">22</span>
            <span className="feature-label">{language === 'zh' ? '单元' : 'UNITS'}</span>
          </div>
          <div className="feature">
            <span className="feature-number">7</span>
            <span className="feature-label">{language === 'zh' ? '楼层' : 'FLOORS'}</span>
          </div>
          <div className="feature">
            <span className="feature-number">2007</span>
            <span className="feature-label">{language === 'zh' ? '完工' : 'COMPLETED'}</span>
          </div>
        </div>
      </div>
      <div className="hero-overlay"></div>
    </section>
  );
};

const BuildingInfo = ({ facts, language }) => {
  return (
    <section className="building-info">
      <div className="container">
        <h2 className="section-title">{language === 'zh' ? '关于开发' : 'About The Development'}</h2>
        <div className="info-grid">
          <div className="info-card">
            <h3>{language === 'zh' ? '位置' : 'Location'}</h3>
            <p>
              {language === 'zh' 
                ? '位于克拉肯威尔中心，靠近老街，拥有优越的交通连接和充满活力的城市生活方式。'
                : 'Situated in the heart of Clerkenwell, close to Old Street, with excellent transport links and vibrant urban lifestyle.'}
            </p>
          </div>
          <div className="info-card">
            <h3>{language === 'zh' ? '建筑' : 'Architecture'}</h3>
            <p>
              {language === 'zh'
                ? '改建的仓库与新建的联排别墅、城市住宅和顶层公寓相结合，创造了一个独特的住宅社区。'
                : 'Converted warehouse combined with new-build mews houses, town house, and penthouses, creating a unique residential community.'}
            </p>
          </div>
          <div className="info-card">
            <h3>{language === 'zh' ? '设施' : 'Amenities'}</h3>
            <p>
              {language === 'zh'
                ? '公共花园、地下停车场、电梯通道和现代规格的所有单元。'
                : 'Communal garden, secure underground parking, lift access, and modern specifications throughout all units.'}
            </p>
          </div>
          <div className="info-card">
            <h3>{language === 'zh' ? '产权' : 'Tenure'}</h3>
            <p>
              {language === 'zh'
                ? '租赁产权，约108年租赁期（截至2021年12月）。由Islington Properties管理。'
                : 'Leasehold, approximately 108 years remaining (as of December 2021). Managed by Islington Properties.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

const UnitShowcase = ({ units, language }) => {
  const [selectedType, setSelectedType] = useState('all');
  const [lightbox, setLightbox] = useState(null);

  const types = [
    { value: 'all', label: language === 'zh' ? '所有单元' : 'All Units' },
    { value: 'penthouse', label: language === 'zh' ? '顶层公寓' : 'Penthouses' },
    { value: 'flat', label: language === 'zh' ? '公寓' : 'Flats' },
    { value: 'town_house', label: language === 'zh' ? '联排住宅' : 'Town House' },
    { value: 'mews', label: language === 'zh' ? '联排别墅' : 'Mews Houses' },
    { value: 'live_work', label: language === 'zh' ? '居住工作室' : 'Live/Work' }
  ];

  const filteredUnits = selectedType === 'all' 
    ? units 
    : units.filter(u => u.kind === selectedType);

  return (
    <section className="unit-showcase">
      <div className="container">
        <h2 className="section-title">{language === 'zh' ? '可用单元' : 'Available Units'}</h2>
        
        <div className="type-filters">
          {types.map(type => (
            <button
              key={type.value}
              className={`type-btn ${selectedType === type.value ? 'active' : ''}`}
              onClick={() => setSelectedType(type.value)}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="units-showcase-grid">
          {filteredUnits.map(unit => (
            <div key={unit.key} className="showcase-unit">
              <div className="showcase-image-container">
                {unit.listing?.photos?.[0] && (
                  <>
                    <img 
                      src={unit.listing.photos[0]} 
                      alt={unit.name}
                      className="showcase-image"
                      onClick={() => setLightbox({ unit, photoIndex: 0 })}
                    />
                    <div className="showcase-overlay">
                      <span className="view-gallery">
                        {language === 'zh' ? '查看图库' : 'View Gallery'}
                      </span>
                    </div>
                  </>
                )}
              </div>
              
              <div className="showcase-details">
                <h3 className="showcase-title">{unit.name || unit.key}</h3>
                <p className="showcase-type">{unit.flatKey}</p>
                
                <div className="showcase-specs">
                  <div className="spec">
                    <span className="spec-value">{unit.beds}</span>
                    <span className="spec-label">{language === 'zh' ? '卧室' : 'Bedrooms'}</span>
                  </div>
                  <div className="spec">
                    <span className="spec-value">{Math.round(unit.m2)}</span>
                    <span className="spec-label">m²</span>
                  </div>
                  {unit.sales.length > 0 && (
                    <div className="spec">
                      <span className="spec-value">
                        £{(Math.max(...unit.sales.map(s => s.price)) / 1000).toFixed(0)}k
                      </span>
                      <span className="spec-label">{language === 'zh' ? '最新' : 'Latest'}</span>
                    </div>
                  )}
                </div>

                {unit.epc?.current_rating && (
                  <div className="showcase-epc">
                    EPC: <strong>{unit.epc.current_rating}</strong>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setLightbox(null)}>×</button>
            <img 
              src={lightbox.unit.listing.photos[lightbox.photoIndex]} 
              alt={lightbox.unit.name}
            />
            <div className="lightbox-nav">
              {lightbox.unit.listing.photos.map((_, idx) => (
                <button
                  key={idx}
                  className={idx === lightbox.photoIndex ? 'active' : ''}
                  onClick={() => setLightbox({ ...lightbox, photoIndex: idx })}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const MarketData = ({ units, language }) => {
  const allSales = units.flatMap(u => u.sales);
  const avgPrice = allSales.length > 0
    ? Math.round(allSales.reduce((sum, s) => sum + s.price, 0) / allSales.length)
    : 0;
  const maxPrice = allSales.length > 0 ? Math.max(...allSales.map(s => s.price)) : 0;
  const totalSales = allSales.length;

  return (
    <section className="market-data">
      <div className="container">
        <h2 className="section-title">{language === 'zh' ? '市场洞察' : 'Market Insights'}</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">£{(avgPrice / 1000).toFixed(0)}k</div>
            <div className="stat-label">{language === 'zh' ? '平均售价' : 'Average Sale Price'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">£{(maxPrice / 1000).toFixed(0)}k</div>
            <div className="stat-label">{language === 'zh' ? '最高售价' : 'Highest Sale Price'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{totalSales}</div>
            <div className="stat-label">{language === 'zh' ? '总销售记录' : 'Total Sales Records'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{units.length}</div>
            <div className="stat-label">{language === 'zh' ? '总单元数' : 'Total Units'}</div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Footer = ({ language }) => {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <h4>Merino Court</h4>
            <p>152-154 Lever Street</p>
            <p>London EC1V 8BG</p>
          </div>
          <div className="footer-section">
            <h4>{language === 'zh' ? '联系方式' : 'Contact'}</h4>
            <p>{language === 'zh' ? '预约参观' : 'For viewing appointments'}</p>
            <p>{language === 'zh' ? '和更多信息' : 'and further information'}</p>
          </div>
          <div className="footer-section">
            <h4>{language === 'zh' ? '管理' : 'Management'}</h4>
            <p>Islington Properties</p>
            <p>Merino Court Management Co.</p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 Merino Court. {language === 'zh' ? '保留所有权利。' : 'All rights reserved.'}</p>
        </div>
      </div>
    </footer>
  );
};

const App = () => {
  const [data, setData] = useState(null);
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData().then(loadedData => {
      setData(loadedData);
      setLoading(false);
    }).catch(error => {
      console.error('Error loading data:', error);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <h1>Merino Court</h1>
          <p>Loading luxury property details...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="error">Failed to load property data</div>;
  }

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-content">
          <div className="nav-logo">
            <span className="logo-text">MERINO COURT</span>
            <span className="logo-subtitle">Clerkenwell, London</span>
          </div>
          <div className="nav-actions">
            <button 
              className={`lang-btn ${language === 'en' ? 'active' : ''}`}
              onClick={() => setLanguage('en')}
            >
              EN
            </button>
            <button 
              className={`lang-btn ${language === 'zh' ? 'active' : ''}`}
              onClick={() => setLanguage('zh')}
            >
              中文
            </button>
          </div>
        </div>
      </nav>

      <Hero language={language} />
      <BuildingInfo facts={data.facts} language={language} />
      <MarketData units={data.units} language={language} />
      <UnitShowcase units={data.units} language={language} />
      <Footer language={language} />
    </div>
  );
};

export default App;
