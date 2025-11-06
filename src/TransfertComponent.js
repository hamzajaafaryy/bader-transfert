import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

// --- API Configuration ---
const API_URL = 'https://rest.livo.ma/transfers?status=pending&products.refr=not_exists&_limit=1000&_sort=-timestamps.updated';

// --- Worker City Assignments ---
const WORKER_CITY_MAP = {
  Bader: ['tanger'],
  Abderrazak: ['oujda', 'guelmim', 'azemmour', 'kelaa des sraghna'],
  Yassine: ['agadir', 'marrakech', 'sale', 'sidi sliman'],
  Salah: ['deroua', 'casablanca', 'midelt', 'beni melal', 'khouribga', 'safi'],
};
const UNASSIGNED_WORKER = 'Other / Unassigned';
const ALL_WORKERS = ['Bader', 'Yassine', 'Abderrazak', 'Salah', UNASSIGNED_WORKER]; // List for navigation tabs

// --- Time Slot Configuration ---
const TIME_CUTOFF_HOUR = 18; 
const TIME_CUTOFF_MINUTE = 7; 

// Helper to determine Morning or Evening slot
const getTimeSlot = (transferDate) => {
    const now = new Date();
    const cutoffToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), TIME_CUTOFF_HOUR, TIME_CUTOFF_MINUTE, 0);

    const isToday = transferDate.toDateString() === now.toDateString();
    
    if (isToday && transferDate < cutoffToday) {
        return 'Morning Transfers (Today Before 18:07)';
    }
    
    // For simplicity, everything else (Today After 18:07, or Yesterday/Older transfers) 
    // goes into Evening, mimicking the image structure for non-morning slots.
    return 'Evening Transfers (Today After 18:07)';
};


function TransfertComponent() {
  // --- STATE MANAGEMENT ---
  const [transfers, setTransfers] = useState([]); 
  const [isLoading, setIsLoading] = useState(true); 
  const [error, setError] = useState(null); 
  const [activeWorker, setActiveWorker] = useState(ALL_WORKERS[0]); 

  // --- DATA FETCHING (useEffect) ---
  useEffect(() => {
    const fetchTransfers = async () => {
      try {
        const response = await axios.get(API_URL, {
          withCredentials: true 
        });
        
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


  // --- MULTI-LEVEL GROUPING LOGIC (useMemo) ---
  const groupedTransfersByWorkerTimeAndClient = useMemo(() => {
    const allGroups = {};

    transfers.forEach(transfer => {
      const city = transfer.to_city.toLowerCase();
      const transferDate = new Date(transfer.timestamps.created);

      // 1. Determine Worker
      let workerName = UNASSIGNED_WORKER;
      for (const [worker, cities] of Object.entries(WORKER_CITY_MAP)) {
        if (cities.includes(city)) {
          workerName = worker;
          break;
        }
      }

      // 2. Determine Time Slot
      const timeSlot = getTimeSlot(transferDate);

      // 3. Determine Client Brand
      const clientBrand = transfer.client?.brand?.name || 'Unknown Client';
      
      // Initialize groups
      if (!allGroups[workerName]) allGroups[workerName] = {};
      if (!allGroups[workerName][timeSlot]) allGroups[workerName][timeSlot] = {};
      if (!allGroups[workerName][timeSlot][clientBrand]) allGroups[workerName][timeSlot][clientBrand] = [];
      
      allGroups[workerName][timeSlot][clientBrand].push(transfer);
    });

    return allGroups;
  }, [transfers]);


  // --- RENDER LOGIC (Minimalist Design) ---
  if (isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontSize: '1.2em' }}>
        <h2>Loading Transfers... ⏳</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', color: 'darkred', backgroundColor: '#fee', border: '1px solid darkred', margin: '20px' }}>
        <h2>Error Loading Data ❌</h2>
        <p>{error}</p>
      </div>
    );
  }

  const activeWorkerData = groupedTransfersByWorkerTimeAndClient[activeWorker] || {};

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif', backgroundColor: '#f4f7f9', minHeight: '100vh' }}>
      
      {/* HEADER */}
      <h1 style={{ color: '#333', fontSize: '1.8em', marginBottom: '20px' }}>
        📦 Pending Transfers by Destination Store
      </h1>

      {/* WORKER TABS (Top Navigation Bar) */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: '10px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        padding: '10px',
        marginBottom: '40px'
      }}>
        <div style={{ display: 'flex', gap: '5px' }}>
          {ALL_WORKERS.map(worker => (
            <button
              key={worker}
              onClick={() => setActiveWorker(worker)}
              style={{
                padding: '8px 15px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9em',
                fontWeight: activeWorker === worker ? 'bold' : 'normal',
                backgroundColor: activeWorker === worker ? '#6c5ce7' : 'transparent',
                color: activeWorker === worker ? 'white' : '#6c5ce7',
                transition: 'all 0.2s ease',
              }}
            >
              {worker}
            </button>
          ))}
        </div>
        
        <button style={{
            padding: '8px 15px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            backgroundColor: '#4CAF50', 
            color: 'white',
            fontWeight: 'bold',
            fontSize: '0.9em'
        }}>
            Mark as Processed <span style={{ backgroundColor: 'white', color: '#4CAF50', padding: '1px 5px', borderRadius: '4px', marginLeft: '5px' }}>1</span>
        </button>
      </div>


      {/* TRANSFER GROUPS BY TIME SLOT */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        
        {Object.entries(activeWorkerData)
            // Sort to put Morning first
            .sort(([slotA], [slotB]) => {
                if (slotA.includes('Morning')) return -1;
                return 1;
            })
            .map(([timeSlot, clientGroups]) => {
                const isMorning = timeSlot.includes('Morning');
                
                return (
                    <div key={timeSlot} style={{ 
                        borderRadius: '10px', 
                        padding: '10px 0 20px 0', 
                        backgroundColor: '#fff',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                        {/* Time Slot Header (Clean, flat bar) */}
                        <div style={{ 
                            padding: '10px 20px', 
                            marginBottom: '15px',
                            backgroundColor: isMorning ? '#fffceb' : '#f0f0ff',
                            borderLeft: `5px solid ${isMorning ? '#FFC300' : '#6c5ce7'}`,
                        }}>
                             <h2 style={{ 
                                margin: '0', 
                                fontSize: '1.2em', 
                                color: isMorning ? '#FFC300' : '#6c5ce7',
                            }}>
                                {timeSlot}
                            </h2>
                        </div>

                        {/* Client Cards Grid */}
                        {Object.keys(clientGroups).length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#666', padding: '10px' }}>No transfers for {activeWorker} in this time slot.</p>
                        ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', padding: '0 20px', gap: '15px' }}>
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
                                        <div key={clientBrand} style={{ 
                                            width: '200px', // Fixed width for clean column layout
                                            minHeight: '150px',
                                            border: '1px solid #eee', 
                                            borderRadius: '8px', 
                                            padding: '10px', 
                                            backgroundColor: '#fefefe',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                        }}>
                                            
                                            {/* Client Brand Header */}
                                            <h3 style={{ margin: '0 0 8px 0', fontSize: '1em', color: '#333', position: 'relative' }}>
                                                {clientBrand} 
                                                <span style={{ 
                                                    position: 'absolute',
                                                    top: '-5px',
                                                    right: '-5px',
                                                    backgroundColor: '#6c5ce7', 
                                                    color: 'white', 
                                                    padding: '2px 6px', 
                                                    borderRadius: '4px', 
                                                    fontSize: '0.7em',
                                                    fontWeight: 'normal'
                                                }}>
                                                    {totalTransfers} total
                                                </span>
                                            </h3>
                                            
                                            {/* Products List (Minimalist) */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                {Object.entries(productCounts).map(([productName, count]) => (
                                                    <div key={productName} style={{ 
                                                        textAlign: 'center',
                                                        padding: '4px 0',
                                                        backgroundColor: '#f7f7f7',
                                                        borderRadius: '3px',
                                                    }}>
                                                        <p style={{ margin: '0', fontSize: '0.85em', color: '#555' }}>{productName}</p>
                                                        <span style={{ color: '#d9534f', fontWeight: 'bold', fontSize: '1em' }}>{count}</span>
                                                    </div>
                                                ))}
                                            </div>

                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        
        {/* Handle case where worker has no transfers at all */}
        {Object.keys(activeWorkerData).length === 0 && (
             <div style={{ textAlign: 'center', padding: '40px', border: '1px solid #ddd', borderRadius: '10px', backgroundColor: '#fff' }}>
                <p style={{ margin: '0', fontSize: '1.2em', color: '#8a6d3b' }}>No transfers found for {activeWorker}.</p>
            </div>
        )}
      </div>
    </div>
  );
}

export default TransfertComponent;