import React, { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Html } from '@react-three/drei';
import * as THREE from 'three';
import { loadData, getUnitData } from './data';
import './App.css';

const BuildingFloor = ({ level, units, selectedUnit, onSelectUnit, yPosition }) => {
  const floorHeight = 0.3;
  const buildingWidth = 20;
  const buildingDepth = 12;

  return (
    <group position={[0, yPosition, 0]}>
      <mesh>
        <boxGeometry args={[buildingWidth, floorHeight, buildingDepth]} />
        <meshStandardMaterial color={selectedUnit?.floors?.includes(level) ? '#4CAF50' : '#757575'} opacity={0.7} transparent />
      </mesh>
      
      {units.map((unit, idx) => {
        if (!unit.floors.includes(level)) return null;
        
        const unitsOnFloor = units.filter(u => u.floors.includes(level));
        const unitIndex = unitsOnFloor.indexOf(unit);
        const totalUnits = unitsOnFloor.length;
        
        const xPos = (unitIndex - totalUnits / 2) * (buildingWidth / totalUnits) + (buildingWidth / totalUnits / 2);
        
        return (
          <group key={unit.key} position={[xPos, 0.3, 0]}>
            <mesh
              onClick={() => onSelectUnit(unit)}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'default';
              }}
            >
              <boxGeometry args={[buildingWidth / totalUnits - 0.5, 0.2, buildingDepth - 1]} />
              <meshStandardMaterial 
                color={selectedUnit?.key === unit.key ? '#2196F3' : '#90CAF9'} 
                opacity={0.8} 
                transparent 
              />
            </mesh>
            <Html center distanceFactor={20}>
              <div style={{
                color: 'white',
                fontSize: '12px',
                fontWeight: 'bold',
                pointerEvents: 'none',
                whiteSpace: 'nowrap'
              }}>
                {unit.key}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};

const Building3D = ({ data, selectedUnit, onSelectUnit, selectedFloor }) => {
  const floors = data.floors.filter(f => selectedFloor === null || f.level === selectedFloor);
  
  return (
    <>
      <PerspectiveCamera makeDefault position={[30, 20, 30]} />
      <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
      
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, 10, -10]} intensity={0.5} />
      
      {floors.map((floor, idx) => (
        <BuildingFloor
          key={floor.level}
          level={floor.level}
          units={data.units}
          selectedUnit={selectedUnit}
          onSelectUnit={onSelectUnit}
          yPosition={floor.level * 3}
        />
      ))}
      
      <gridHelper args={[50, 50]} />
    </>
  );
};

const UnitDetailsPanel = ({ unit, data, language, onClose }) => {
  if (!unit) return null;

  const unitData = getUnitData(unit.key, data);
  const listing = unitData?.listing;
  const sales = unitData?.salesHistory || [];
  const epc = unitData?.epc;

  const floorPlanSvg = language === 'zh' 
    ? `/data/merino-court/plans/zh/${unit.key.replace('/', '-')}-${unit.floors[0]}.svg`
    : `/data/merino-court/plans/${unit.key.replace('/', '-')}-${unit.floors[0]}.svg`;

  return (
    <div className="unit-panel">
      <div className="panel-header">
        <h2>{unit.name || unit.key}</h2>
        <button onClick={onClose} className="close-btn">×</button>
      </div>
      
      <div className="panel-content">
        <div className="unit-basics">
          <div className="info-row">
            <span className="label">{language === 'zh' ? '类型' : 'Type'}:</span>
            <span>{unit.kind?.replace('_', ' ')}</span>
          </div>
          <div className="info-row">
            <span className="label">{language === 'zh' ? '卧室' : 'Bedrooms'}:</span>
            <span>{unit.beds}</span>
          </div>
          <div className="info-row">
            <span className="label">{language === 'zh' ? '面积' : 'Area'}:</span>
            <span>{unit.gross?.m2} m² ({unit.gross?.sqft} sq ft)</span>
          </div>
          <div className="info-row">
            <span className="label">{language === 'zh' ? '楼层' : 'Floors'}:</span>
            <span>{unit.floors.join(', ')}</span>
          </div>
        </div>

        {epc && (
          <div className="epc-section">
            <h3>{language === 'zh' ? '能效等级' : 'EPC Rating'}</h3>
            <div className="epc-badge" data-rating={epc.current_rating}>
              {epc.current_rating || 'N/A'}
            </div>
          </div>
        )}

        {sales.length > 0 && (
          <div className="sales-section">
            <h3>{language === 'zh' ? '销售历史' : 'Sales History'}</h3>
            <div className="sales-list">
              {sales.map((sale, idx) => (
                <div key={idx} className="sale-item">
                  <span className="sale-date">{sale.date}</span>
                  <span className="sale-price">£{sale.price.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {listing && listing.photos && listing.photos.length > 0 && (
          <div className="photos-section">
            <h3>{language === 'zh' ? '照片' : 'Photos'}</h3>
            <div className="photo-grid">
              {listing.photos.slice(0, 4).map((photo, idx) => (
                <img key={idx} src={photo} alt={`${unit.key} photo ${idx + 1}`} />
              ))}
            </div>
          </div>
        )}

        <div className="floorplan-section">
          <h3>{language === 'zh' ? '户型图' : 'Floor Plan'}</h3>
          <img 
            src={floorPlanSvg} 
            alt={`${unit.key} floor plan`}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [data, setData] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
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
    return <div className="loading">Loading Merino Court data...</div>;
  }

  if (!data) {
    return <div className="error">Failed to load data</div>;
  }

  return (
    <div className="app">
      <div className="header">
        <div className="header-left">
          <h1>Merino Court 3D Viewer</h1>
          <p>152-154 Lever Street, London EC1V 8BG</p>
        </div>
        <div className="header-right">
          <button 
            className={`lang-btn ${language === 'en' ? 'active' : ''}`}
            onClick={() => setLanguage('en')}
          >
            English
          </button>
          <button 
            className={`lang-btn ${language === 'zh' ? 'active' : ''}`}
            onClick={() => setLanguage('zh')}
          >
            中文
          </button>
        </div>
      </div>

      <div className="controls">
        <div className="floor-selector">
          <button 
            className={selectedFloor === null ? 'active' : ''}
            onClick={() => setSelectedFloor(null)}
          >
            All Floors
          </button>
          {data.floors.map(floor => (
            <button
              key={floor.level}
              className={selectedFloor === floor.level ? 'active' : ''}
              onClick={() => setSelectedFloor(floor.level)}
            >
              {floor.name}
            </button>
          ))}
        </div>
      </div>

      <div className="viewer-container">
        <Canvas>
          <Suspense fallback={null}>
            <Building3D 
              data={data}
              selectedUnit={selectedUnit}
              onSelectUnit={setSelectedUnit}
              selectedFloor={selectedFloor}
            />
          </Suspense>
        </Canvas>
      </div>

      {selectedUnit && (
        <UnitDetailsPanel
          unit={selectedUnit}
          data={data}
          language={language}
          onClose={() => setSelectedUnit(null)}
        />
      )}

      <div className="instructions">
        {language === 'zh' ? '点击单元查看详情 | 使用鼠标旋转、缩放建筑' : 'Click on a unit to view details | Use mouse to orbit, zoom the building'}
      </div>
    </div>
  );
};

export default App;
