import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

// --- CONFIGURATION ---
const API_URL = 'https://rest.livo.ma/transfers?status=pending&products.refr=not_exists&_limit=1000&_sort=-timestamps.updated';

// Worker Assignments (Keep logic consistent)
const WORKER_CITY_MAP = {
  Bader: ['tanger'],
  Abderrazak: ['oujda', 'guelmim', 'azemmour', 'kelaa des sraghna'],
  Yassine: ['agadir', 'marrakech', 'sale', 'sidi sliman'],
  Salah: ['deroua', 'casablanca', 'midelt', 'beni melal', 'khouribga', 'safi'],
};
const UNASSIGNED_WORKER = 'Other / Unassigned';
const ALL_WORKERS = ['Bader', 'Yassine', 'Abderrazak', 'Salah', UNASSIGNED_WORKER];

// Time Slot Config
const TIME_CUTOFF_HOUR = 18; 
const TIME_CUTOFF_MINUTE = 7; 

// --- AUTHENTICATION FIX: Use Environment Variable (Secure Mobile Access) ---
// We read the secret cookie string from the environment variable set in Vercel/Netlify.
// Variable name is REACT_APP_LIVO_AUTH_COOKIE
const LIVO_AUTH_COOKIE = process.env.REACT_APP_LIVO_AUTH_COOKIE || "";


// --- STYLES (Externalized for Clarity and Reusability & Responsiveness) ---
const styles = {
    // Main Container
    dashboard: { 
        padding: 0, 
        fontFamily: 'system-ui, sans-serif', 
        backgroundColor: '#f9fafb', 
        minHeight: '100vh',
    },
    // Header Bar (Dark, fixed height)
    header: {
        backgroundColor: '#1f2937', 
        color: 'white',
        padding: '20px 20px', // Adjusted padding for mobile
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
    },
    // Content Area
    content: {
        padding: '20px 20px 40px', // Adjusted padding for mobile
        maxWidth: '1400px', 
        margin: '0 auto',
    },
    // Worker Tabs Container
    tabsContainer: {
        display: 'flex', 
        gap: '10px',
        flexWrap: 'wrap',
        marginBottom: '15px',
    },
    // Time Slot Header
    timeSlotHeader: (isMorning) => ({
        padding: '15px 20px', 
        marginBottom: '20px',
        backgroundColor: isMorning ? '#fef3c7' : '#eef2ff', 
        borderRadius: '8px',
    }),
    // Client Card Grid (Responsive)
    clientGrid: {
        display: 'grid',
        // Responsive grid: minimum card width is 220px, auto-fills the space
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', 
        gap: '20px',
        marginBottom: '40px',
    },
    // Individual Client Card
    clientCard: {
        border: '1px solid #e5e7eb', 
        borderRadius: '12px', 
        padding: '15px', 
        backgroundColor: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        position: 'relative',
        transition: 'transform 0.2s ease',
    },
    // Product List inside card
    productList: {
        display: 'flex', 
        flexDirection: 'column', 
        gap: '5px',
        marginTop: '10px',
    }
};

// --- HELPER FUNCTIONS ---
const getTimeSlot = (transferDate) => {
    const now = new Date();
    const cutoffToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), TIME_CUTOFF_HOUR, TIME_CUTOFF_MINUTE, 0);
    const isToday = transferDate.toDateString() === now.toDateString();
    
    if (isToday && transferDate < cutoffToday) {
        return 'Morning Transfers (Today Before 18:07)';
    }
    return 'Evening Transfers (Today After 18:07)';
};

function TransfertComponent() {
  // --- STATE MANAGEMENT ---
  const [transfers, setTransfers] = useState([]); 
  const [isLoading, setIsLoading] = useState(true); 
  const [error, setError] = useState(null); 
  const [activeWorker, setActiveWorker] = useState(ALL_WORKERS[0]); 

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchTransfers = async () => {
        // 1. Check if the secure variable is set
        if (LIVO_AUTH_COOKIE.length < 50) { 
            // Display an error that guides the user to the fix
            setError('Auth Error: Please set the LIVO_AUTH_COOKIE environment variable in Vercel/Netlify.');
            setIsLoading(false);
            return;
        }

      try {
        const response = await axios.get(API_URL, {
          headers: {
            // 2. Send the cookie string explicitly as a header
            'Cookie': LIVO_AUTH_COOKIE,
          },
          // 3. DO NOT use withCredentials: true
        });
        
        const transferData = response.data?.data?.data || []; 
        setTransfers(transferData);
        setIsLoading(false);
      } catch (err) {
        setError('Failed to fetch data. Authentication cookie is likely expired or invalid.');
        setIsLoading(false);
        console.error('API Fetch Error:', err);
      }
    };
    fetchTransfers();
  }, []); 


  // --- MULTI-LEVEL GROUPING LOGIC (same as before) ---
  const groupedTransfersByWorkerTimeAndClient = useMemo(() => {
    const allGroups = {};
    transfers.forEach(transfer => {
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


  // --- RENDER LOGIC ---
  if (isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontSize: '1.2em' }}>
        <h2>Loading Transfers... ⏳</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: '#ff4d4d', backgroundColor: '#fff0f0', border: '1px solid #ff4d4d', margin: '20px', borderRadius: '8px' }}>
        <h2>Error Loading Data ❌</h2>
        <p>{error}</p>
        {LIVO_AUTH_COOKIE.length < 50 && (
            <p><strong>Action Required:</strong> Please set the `REACT_APP_LIVO_AUTH_COOKIE` variable in your hosting platform.</p>
        )}
      </div>
    );
  }

  const activeWorkerData = groupedTransfersByWorkerTimeAndClient[activeWorker] || {};

  return (
    <div style={styles.dashboard}>
      
      {/* HEADER & TABS CONTAINER */}
      <div style={styles.header}>
        <h1 style={{ margin: '0 0 15px 0', fontSize: '1.8em', fontWeight: 600 }}>
          📦 Pending Transfers Dashboard
        </h1>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '15px' }}>
          
          {/* WORKER TABS */}
          <div style={styles.tabsContainer}>
            {ALL_WORKERS.map(worker => (
              <button
                key={worker}
                onClick={() => setActiveWorker(worker)}
                style={{
                  padding: '10px 15px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1em',
                  fontWeight: activeWorker === worker ? 'bold' : 'normal',
                  backgroundColor: activeWorker === worker ? '#3b82f6' : 'transparent', 
                  color: activeWorker === worker ? 'white' : '#9ca3af',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap', 
                }}
              >
                {worker}
              </button>
            ))}
          </div>
          
          {/* MARK AS PROCESSED BUTTON */}
          <button style={{
              padding: '10px 18px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: '#10b981', 
              color: 'white',
              fontWeight: 'bold',
              fontSize: '0.9em',
              whiteSpace: 'nowrap',
          }}>
              Mark as Processed <span style={{ backgroundColor: 'white', color: '#10b981', padding: '1px 7px', borderRadius: '4px', marginLeft: '8px' }}>1</span>
          </button>
        </div>
      </div>
      
      {/* MAIN CONTENT AREA */}
      <div style={styles.content}>
        
        {/* TRANSFER GROUPS BY TIME SLOT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {Object.entries(activeWorkerData)
              .sort(([slotA]) => slotA.includes('Morning') ? -1 : 1)
              .map(([timeSlot, clientGroups]) => {
                  const isMorning = timeSlot.includes('Morning');
                  
                  return (
                      <div key={timeSlot}>
                          
                          {/* Time Slot Header */}
                          <div style={styles.timeSlotHeader(isMorning)}>
                              <h2 style={{ 
                                  margin: '0', 
                                  fontSize: '1.3em', 
                                  fontWeight: 600,
                                  color: isMorning ? '#d97706' : '#6366f1', 
                              }}>
                                  {timeSlot}
                              </h2>
                          </div>

                          {/* Client Cards Grid */}
                          <div style={styles.clientGrid}>
                              {Object.entries(clientGroups).map(([clientBrand, transfersList]) => {
                                  // Calculate total products per unique product for this client
                                  const productCounts = transfersList.reduce((acc, transfer) => {
                                      transfer.products.forEach(item => {
                                          const productName = item.product?.name || 'Unknown Product';
                                          acc[productName] = (acc[productName] || 0) + (item.quantity || 1);
                                      });
                                      return acc;
                                  }, {});

                                  const totalTransfers = transfersList.length;

                                  return (
                                      <div key={clientBrand} style={styles.clientCard}>
                                          
                                          {/* Client Brand Header */}
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                              <h3 style={{ margin: '0', fontSize: '1.1em', fontWeight: 600, color: '#1f2937' }}>
                                                  {clientBrand}
                                              </h3>
                                              <span style={{ 
                                                  backgroundColor: '#3b82f6', 
                                                  color: 'white', 
                                                  padding: '2px 8px', 
                                                  borderRadius: '9999px', 
                                                  fontSize: '0.75em',
                                                  fontWeight: 'bold'
                                              }}>
                                                  {totalTransfers} total
                                              </span>
                                          </div>
                                          
                                          <hr style={{ border: 'none', height: '1px', backgroundColor: '#e5e7eb', margin: '10px 0' }} />

                                          {/* Products List */}
                                          <div style={styles.productList}>
                                              {Object.entries(productCounts).map(([productName, count]) => (
                                                  <div key={productName} style={{ 
                                                      display: 'flex',
                                                      justifyContent: 'space-between',
                                                      alignItems: 'center',
                                                      padding: '2px 0'
                                                  }}>
                                                      <p style={{ margin: '0', fontSize: '0.9em', color: '#4b5563' }}>{productName}</p>
                                                      <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '1em' }}>{count}</span>
                                                  </div>
                                              ))}
                                          </div>

                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  );
              })}
          
          {/* No transfers message */}
          {Object.keys(activeWorkerData).length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px', border: '2px dashed #d1d5db', borderRadius: '12px', backgroundColor: '#fff' }}>
                  <p style={{ margin: '0', fontSize: '1.4em', color: '#6b7280', fontWeight: 500 }}>
                      No transfers found for **{activeWorker}**.
                  </p>
              </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TransfertComponent;