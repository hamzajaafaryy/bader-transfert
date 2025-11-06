import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

// --- Configuration ---
const API_URL = 'https://rest.livo.ma/transfers?status=pending&products.refr=not_exists&_limit=1000&_sort=-timestamps.updated';

const WORKER_CITY_MAP = {
  Bader: ['tanger'],
  Abderrazak: ['oujda', 'guelmim', 'azemmour', 'kelaa des sraghna'],
  Yassine: ['agadir', 'marrakech', 'sale', 'sidi sliman'],
  Salah: ['deroua', 'casablanca', 'midelt', 'beni melal', 'khouribga', 'safi'],
};

const UNASSIGNED_WORKER = 'Other / Unassigned';
const ALL_WORKERS = ['Bader', 'Yassine', 'Abderrazak', 'Salah', UNASSIGNED_WORKER];

const TIME_CUTOFF_HOUR = 18;
const TIME_CUTOFF_MINUTE = 7;

const getTimeSlot = (transferDate) => {
  const now = new Date();
  const cutoffToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), TIME_CUTOFF_HOUR, TIME_CUTOFF_MINUTE, 0);
  const isToday = transferDate.toDateString() === now.toDateString();
  if (isToday && transferDate < cutoffToday) {
    return 'Morning Transfers (Today Before 18:07)';
  }
  return 'Evening Transfers (Today After 18:07)';
};

// --- Inject global styles ---
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
  }

  .tab-btn.active {
    background: #7c3aed;
    color: white;
    font-weight: 600;
  }

  .tab-btn:hover:not(.active) {
    background: #f3f4f6;
  }

  .process-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 8px;
    background: #10b981;
    color: white;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: background 0.2s;
  }

  .process-btn:hover {
    background: #0da271;
  }

  .process-badge {
    background: white;
    color: #10b981;
    padding: 0.125rem 0.5rem;
    border-radius: 6px;
    font-weight: 700;
    font-size: 0.75rem;
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
    justify-content: space-between;
    padding: 0.375rem 0;
    background: #f9fafb;
    border-radius: 4px;
    margin-top: 0.25rem;
    font-size: 0.875rem;
  }

  .product-name {
    color: #4b5563;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .product-qty {
    font-weight: 700;
    color: #ef4444;
    margin-left: 0.5rem;
    min-width: 20px;
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

  .loading-screen {
    padding: 2rem;
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

function TransfertComponent() {
  const [transfers, setTransfers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeWorker, setActiveWorker] = useState(ALL_WORKERS[0]);

  // Inject global styles once
  useEffect(() => {
    if (!document.getElementById('transfers-custom-styles')) {
      const style = document.createElement('style');
      style.id = 'transfers-custom-styles';
      style.textContent = globalStyles;
      document.head.appendChild(style);
    }
  }, []);

  // Fetch data
  useEffect(() => {
    const fetchTransfers = async () => {
      try {
        const response = await axios.get(API_URL, { withCredentials: true });
        const transferData = response.data?.data?.data || [];
        setTransfers(transferData);
        setIsLoading(false);
      } catch (err) {
        setError('Failed to fetch data. Ensure you are logged into your Livo account in this browser.');
        setIsLoading(false);
        console.error('API Fetch Error:', err);
      }
    };

    fetchTransfers();
  }, []);

  // Group transfers
  const groupedTransfersByWorkerTimeAndClient = useMemo(() => {
    const allGroups = {};
    transfers.forEach((transfer) => {
      const city = transfer.to_city.toLowerCase();
      const transferDate = new Date(transfer.timestamps.created);
      let workerName = UNASSIGNED_WORKER;
      for (const [worker, cities] of Object.entries(WORKER_CITY_MAP)) {
        if (cities.includes(city)) {
          workerName = worker;
          break;
        }
      }
      const timeSlot = getTimeSlot(transferDate);
      const clientBrand = transfer.client?.brand?.name || 'Unknown Client';
      if (!allGroups[workerName]) allGroups[workerName] = {};
      if (!allGroups[workerName][timeSlot]) allGroups[workerName][timeSlot] = {};
      if (!allGroups[workerName][timeSlot][clientBrand]) allGroups[workerName][timeSlot][clientBrand] = [];
      allGroups[workerName][timeSlot][clientBrand].push(transfer);
    });
    return allGroups;
  }, [transfers]);

  // --- LOADING SKELETON ---
  if (isLoading) {
    return (
      <div className="transfers-app">
        <h1 className="header">📦 Pending Transfers by Destination Store</h1>
        <div className="tabs-container">
          <div className="tabs">
            {ALL_WORKERS.map((_, i) => (
              <div key={i} className="tab-btn skeleton" style={{ width: '80px', height: '36px' }}></div>
            ))}
          </div>
          <div className="process-btn skeleton" style={{ width: '140px', height: '36px' }}></div>
        </div>

        <div>
          {['Morning', 'Evening'].map((slot, idx) => (
            <div key={slot} className="slot-card">
              <div className={`slot-header ${idx === 0 ? 'morning' : 'evening'}`}>
                🕒 {slot} Transfers (Today)
              </div>
              <div className="clients-grid">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="client-card">
                    <div className="client-header">
                      <div className="skeleton" style={{ width: '100px', height: '18px' }}></div>
                      <div className="skeleton" style={{ width: '50px', height: '20px' }}></div>
                    </div>
                    <div className="space-y-2 mt-2">
                      {[1, 2].map((j) => (
                        <div key={j} className="product-item">
                          <div className="skeleton" style={{ width: '120px', height: '16px' }}></div>
                          <div className="skeleton" style={{ width: '20px', height: '16px' }}></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- ERROR STATE ---
  if (error) {
    return (
      <div className="transfers-app">
        <div className="error-message">
          <h2 style={{ margin: 0, fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 600 }}>Error Loading Data ❌</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // --- SUCCESS STATE ---
  const activeWorkerData = groupedTransfersByWorkerTimeAndClient[activeWorker] || {};

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
            </button>
          ))}
        </div>
        <button className="process-btn">
          Mark as Processed <span className="process-badge">1</span>
        </button>
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
                      const productCounts = transfersList.reduce((acc, transfer) => {
                        transfer.products.forEach((item) => {
                          const productName = item.product?.name || 'Unknown Product';
                          acc[productName] = (acc[productName] || 0) + (item.quantity || 1);
                        });
                        return acc;
                      }, {});

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
                                  <span className="product-name">{name}</span>
                                  <span className="product-qty">{count}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

        {Object.keys(activeWorkerData).length === 0 && (
          <div className="empty-state">📭 No transfers found for {activeWorker}.</div>
        )}
      </div>
    </div>
  );
}

export default TransfertComponent;