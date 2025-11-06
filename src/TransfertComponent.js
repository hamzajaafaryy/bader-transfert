import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

// --- CONFIGURATION ---
const API_URL = 'https://rest.livo.ma/transfers?status=pending&products.refr=not_exists&_limit=1000&_sort=-timestamps.updated';
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const WORKER_CITY_MAP = {
  Bader: ['tanger'],
  Abderrazak: ['oujda', 'guelmim', 'azemmour', 'kelaa des sraghna'],
  Yassine: ['agadir', 'marrakech', 'sale', 'sidi sliman'],
  Salah: ['deroua', 'casablanca', 'midelt', 'beni melal', 'khouribga', 'safi'],
};

const UNASSIGNED_WORKER = 'Other / Unassigned';
const ALL_WORKERS = ['Bader', 'Yassine', 'Abderrazak', 'Salah', UNASSIGNED_WORKER];

// --- HELPER FUNCTIONS ---
const getTimeSlot = (transferDate, cutoffTimeStr) => {
  try {
    const [cutoffHour, cutoffMinute] = cutoffTimeStr.split(':').map(Number);
    if (isNaN(cutoffHour) || isNaN(cutoffMinute)) throw new Error('Invalid Time Format');
    
    const transferHour = transferDate.getHours(); 
    const transferMinute = transferDate.getMinutes(); 

    if (transferHour < cutoffHour || (transferHour === cutoffHour && transferMinute < cutoffMinute)) {
      return `Morning Transfers (Before ${cutoffTimeStr})`;
    }
    return `Evening Transfers (After ${cutoffTimeStr})`;
  } catch (e) {
    return `Grouping Error (Check Time Input)`;
  }
};

const formatDateForDisplay = (date) => {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// --- GLOBAL STYLES (Inline CSS) ---
const globalStyles = `
  .transfers-app {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background-color: #f9fafb;
    min-height: 100vh;
    padding: 1.5rem;
    color: #111827;
  }

  .header {
    font-size: 1.875rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: #1e293b;
  }

  .tabs-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    padding: 1rem;
    margin-bottom: 2.5rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .tabs {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .tab-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    background: transparent;
    color: #7c3aed;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .tab-btn.active {
    background: #7c3aed;
    color: white;
    font-weight: 600;
  }

  .tab-btn:hover:not(.active) {
    background: #f3f4f6;
  }

  /* ✨ ENHANCED: Attention-Grabbing Small Circular Badge */
  .worker-count-badge {
    background: linear-gradient(135deg, #d80000af, #ff3030ff);
    color: white;
    font-weight: 700;
    font-size: 0.65rem;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-shrink: 0;
    box-shadow: 0 2px 4px rgba(107, 70, 193, 0.3);
    margin-left: 4px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .worker-count-badge:hover {
    transform: scale(1.1);
    box-shadow: 0 3px 6px rgba(107, 70, 193, 0.4);
  }

  .tab-btn.active .worker-count-badge {
    background: linear-gradient(135deg, #ffffff, #f0f0ff);
    color: #6366f1;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  }

  .controls-group {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .time-input-group {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  
  .time-label {
    font-size: 0.875rem;
    color: #4b5563;
    font-weight: 500;
  }

  .time-input {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 0.875rem;
    color: #1f2937;
    width: 70px; 
    text-align: center;
  }

  .refresh-group {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    min-width: 120px;
  }

  .process-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 8px;
    background: #3b82f6; 
    color: white;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: background 0.2s;
    min-width: 120px;
  }

  .process-btn:hover:not(:disabled) {
    background: #2563eb;
  }

  .process-btn:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .slot-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    margin-bottom: 2rem;
    overflow: hidden;
  }

  .slot-header {
    padding: 1rem 1.5rem;
    margin-bottom: 1.25rem;
    font-size: 1.25rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .slot-header.morning {
    background: #fffbeb;
    border-left: 4px solid #f59e0b;
    color: #d97706;
  }

  .slot-header.evening {
    background: #f0f9ff;
    border-left: 4px solid #3b82f6;
    color: #1d4ed8;
  }

  .clients-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1.25rem;
    padding: 0 1.5rem 1.5rem;
  }

  @media (max-width: 640px) {
    .clients-grid {
      grid-template-columns: 1fr;
      padding: 0 1rem 1rem;
    }
  }

  .client-card {
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 1rem;
    background: #fafafa;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    cursor: pointer;
  }

  .client-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px -2px rgba(0,0,0,0.1);
    background: white;
  }

  .client-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
  }

  .client-title {
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .client-count {
    background: #7c3aed;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
    margin-left: 0.5rem;
  }

  .product-item {
    display: flex;
    flex-direction: column; 
    padding: 0.375rem 0;
    background: #f9fafb;
    border-radius: 4px;
    margin-top: 0.25rem;
    font-size: 0.875rem;
  }

  .product-line {
    display: flex;
    justify-content: space-between;
    padding: 0 0.5rem;
  }

  .product-name {
    color: #4b5563;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .product-qty {
    font-weight: 700;
    color: #ef4444;
    margin-left: 0.5rem;
    min-width: 20px;
    text-align: right;
  }

  .product-timestamp {
    font-size: 0.65rem;
    color: #9ca3af;
    padding: 0 0.5rem 0.25rem;
    text-align: right;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: #6b7280;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    background: white;
    margin: 0 1.5rem;
  }

  .skeleton {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: loading 1.5s infinite;
    border-radius: 4px;
  }

  @keyframes loading {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .error-message {
    text-align: center;
    padding: 2.5rem 1.5rem;
    color: #b91c1c;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 12px;
    margin: 2rem;
  }
`;

// --- MAIN COMPONENT ---
function TransfertComponent() {
  const [transfers, setTransfers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeWorker, setActiveWorker] = useState(ALL_WORKERS[0]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [timeCutoff, setTimeCutoff] = useState('18:07');

  // Inject styles once
  useEffect(() => {
    if (!document.getElementById('transfers-custom-styles')) {
      const style = document.createElement('style');
      style.id = 'transfers-custom-styles';
      style.textContent = globalStyles;
      document.head.appendChild(style);
    }
    fetchTransfers();
  }, []);

  // Auto-refresh
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!isLoading) fetchTransfers();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [isLoading]);

  const handleTimeCutoffChange = (event) => {
    const newValue = event.target.value;
    if (/^\d{0,2}:?\d{0,2}$/.test(newValue)) {
      setTimeCutoff(newValue);
    }
  };

  const fetchTransfers = async () => {
    if (!isLoading) setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get(API_URL, { withCredentials: true });
      const transferData = response.data?.data?.data || [];
      setTransfers(transferData);
      setLastUpdated(new Date());
    } catch (err) {
      setError('Failed to fetch data. Ensure you are logged into your Livo account in this browser/session.');
      console.error('API Fetch Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const groupedTransfersByWorkerTimeAndClient = useMemo(() => {
    const allGroups = {};
    transfers.forEach((transfer) => {
      const city = transfer.to_city.toLowerCase();
      const transferDate = new Date(transfer.timestamps.updated);
      let workerName = UNASSIGNED_WORKER;
      for (const [worker, cities] of Object.entries(WORKER_CITY_MAP)) {
        if (cities.includes(city)) {
          workerName = worker;
          break;
        }
      }
      const timeSlot = getTimeSlot(transferDate, timeCutoff);
      const clientBrand = transfer.client?.brand?.name || 'Unknown Client';

      if (!allGroups[workerName]) {
        allGroups[workerName] = { totalTransfers: 0, slots: {} };
      }
      allGroups[workerName].totalTransfers += 1;

      if (!allGroups[workerName].slots[timeSlot]) {
        allGroups[workerName].slots[timeSlot] = {};
      }
      if (!allGroups[workerName].slots[timeSlot][clientBrand]) {
        allGroups[workerName].slots[timeSlot][clientBrand] = [];
      }
      allGroups[workerName].slots[timeSlot][clientBrand].push(transfer);
    });
    return allGroups;
  }, [transfers, timeCutoff]);

  const activeWorkerGroup = groupedTransfersByWorkerTimeAndClient[activeWorker] || { totalTransfers: 0, slots: {} };
  const activeWorkerData = activeWorkerGroup.slots;

  // --- LOADING STATE ---
  if (isLoading && transfers.length === 0) {
    return (
      <div className="transfers-app">
        <h1 className="header">📦 Pending Transfers by Destination Store</h1>
        <div className="tabs-container">
          <div className="tabs">
            {ALL_WORKERS.map((_, i) => (
              <div key={i} className="tab-btn skeleton" style={{ width: '80px', height: '36px' }}></div>
            ))}
          </div>
          <div className="controls-group">
            <div className="time-input-group">
              <div className="time-label skeleton" style={{ width: '80px', height: '18px' }}></div>
              <div className="time-input skeleton" style={{ width: '70px', height: '36px' }}></div>
            </div>
            <div className="process-btn skeleton" style={{ width: '120px', height: '36px' }}></div>
          </div>
        </div>
        <div className="empty-state" style={{ marginTop: '2rem' }}>Loading Transfers...</div>
      </div>
    );
  }

  // --- ERROR STATE ---
  if (error && transfers.length === 0) {
    return (
      <div className="transfers-app">
        <div className="error-message">
          <h2 style={{ margin: 0, fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 600 }}>Error Loading Data ❌</h2>
          <p>{error}</p>
          <button onClick={fetchTransfers} className="process-btn" disabled={isLoading} style={{ marginTop: '1rem' }}>
            Try Refreshing 🔄
          </button>
        </div>
      </div>
    );
  }

  // --- SUCCESS STATE ---
  return (
    <div className="transfers-app">
      <h1 className="header">📦 Pending Transfers by Destination Store</h1>

      <div className="tabs-container">
        <div className="tabs">
          {ALL_WORKERS.map((worker) => (
            <button
              key={worker}
              onClick={() => setActiveWorker(worker)}
              className={`tab-btn ${activeWorker === worker ? 'active' : ''}`}
            >
              {worker}
              <span className="worker-count-badge">
                {groupedTransfersByWorkerTimeAndClient[worker]?.totalTransfers || 0}
              </span>
            </button>
          ))}
        </div>

        <div className="controls-group">
          <div className="time-input-group">
            <label htmlFor="time-cutoff" className="time-label">Group Cutoff Time:</label>
            <input
              id="time-cutoff"
              type="text"
              value={timeCutoff}
              onChange={handleTimeCutoffChange}
              className="time-input"
              placeholder="HH:MM"
              maxLength="5"
            />
          </div>
          <div className="refresh-group">
            <button onClick={fetchTransfers} className="process-btn" disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Refresh Data 🔄'}
            </button>
            {lastUpdated && (
              <span style={{ fontSize: '0.75rem', color: '#6b7280', width: '100%', textAlign: 'right' }}>
                Last updated: {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ paddingLeft: '0.5rem' }}>
        <p style={{ fontSize: '1rem', color: '#6b7280', marginBottom: '1.5rem' }}>
          Showing <strong>all pending transfers</strong> ({activeWorkerGroup.totalTransfers} total for {activeWorker}), grouped by the <strong>hour of their last update</strong> (e.g., Morning is updates before <strong>{timeCutoff}</strong>).
        </p>
      </div>

      <div>
        {Object.entries(activeWorkerData)
          .sort(([slotA]) => (slotA.includes('Morning') ? -1 : 1))
          .map(([timeSlot, clientGroups]) => {
            const isMorning = timeSlot.includes('Morning');
            const clientEntries = Object.entries(clientGroups);
            return (
              <div key={timeSlot} className="slot-card">
                <div className={`slot-header ${isMorning ? 'morning' : 'evening'}`}>
                  🕒 {timeSlot}
                </div>
                {clientEntries.length === 0 ? (
                  <p className="empty-state">No transfers for {activeWorker} in this time slot.</p>
                ) : (
                  <div className="clients-grid">
                    {clientEntries.map(([clientBrand, transfersList]) => {
                      const productCounts = {};
                      let latestUpdate = null;
                      transfersList.forEach(transfer => {
                        const currentUpdate = new Date(transfer.timestamps.updated);
                        if (!latestUpdate || currentUpdate > latestUpdate) {
                          latestUpdate = currentUpdate;
                        }
                        transfer.products.forEach(item => {
                          const productName = item.product?.name || 'Unknown Product';
                          productCounts[productName] = (productCounts[productName] || 0) + (item.quantity || 1);
                        });
                      });
                      return (
                        <div key={clientBrand} className="client-card">
                          <div className="client-header">
                            <span className="client-title">{clientBrand}</span>
                            <span className="client-count">{transfersList.length} total</span>
                          </div>
                          <div>
                            {Object.entries(productCounts).length === 0 ? (
                              <div className="product-item" style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                                No products listed
                              </div>
                            ) : (
                              Object.entries(productCounts).map(([name, count]) => (
                                <div key={name} className="product-item">
                                  <div className="product-line">
                                    <span className="product-name">{name}</span>
                                    <span className="product-qty">{count}</span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                          {latestUpdate && (
                            <p className="product-timestamp">
                              Last update: {formatDateForDisplay(latestUpdate)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

        {Object.keys(activeWorkerData).length === 0 && activeWorkerGroup.totalTransfers > 0 && (
          <div className="empty-state">
            📭 Transfers found for <strong>{activeWorker}</strong>, but none were assigned to a time slot. (This usually indicates a bad cutoff time format.)
          </div>
        )}
        {activeWorkerGroup.totalTransfers === 0 && transfers.length > 0 && (
          <div className="empty-state">📭 No transfers currently pending for <strong>{activeWorker}</strong>.</div>
        )}
        {transfers.length === 0 && !isLoading && (
          <div className="empty-state">🎉 No pending transfers found!</div>
        )}
      </div>
    </div>
  );
}

export default TransfertComponent;