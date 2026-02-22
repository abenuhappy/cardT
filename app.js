// app.js
const API_URL = '/api/data';

// State definition
const state = {
    data: {
        cards: [],
        installments: [],
        lumpSums: []
    },
    currentDate: new Date(2026, 1, 1), // Starting Feb 2026 as per data
    activeFilter: 'all', // all, lumpSums, installments
    isLoading: true
};

// DOM Elements
const elements = {
    loader: document.getElementById('loader'),
    dashboard: document.getElementById('dashboard'),
    grandTotal: document.getElementById('grandTotal'),
    totalInsights: document.getElementById('totalInsights'),
    cardsContainer: document.getElementById('cardsContainer'),
    detailsList: document.getElementById('detailsListContainer'),
    prevBtn: document.getElementById('prevMonthBtn'),
    nextBtn: document.getElementById('nextMonthBtn'),
    yearDisplay: document.getElementById('currentYear'),
    monthDisplay: document.getElementById('currentMonthStr'),
    filterBtns: document.querySelectorAll('.filter-btn')
};

// Initialization
async function init() {
    setupEventListeners();
    updateDateDisplay();
    await fetchData();
}

function setupEventListeners() {
    elements.prevBtn.addEventListener('click', () => changeMonth(-1));
    elements.nextBtn.addEventListener('click', () => changeMonth(1));

    elements.filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            elements.filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.activeFilter = e.target.dataset.filter;
            renderDetails();
        });
    });
}

function updateDateDisplay() {
    const options = { month: 'short' };
    elements.yearDisplay.textContent = state.currentDate.getFullYear();
    elements.monthDisplay.textContent = state.currentDate.toLocaleDateString('en-US', options).toUpperCase();
}

function changeMonth(delta) {
    state.currentDate.setMonth(state.currentDate.getMonth() + delta);
    updateDateDisplay();
    renderDashboard();
}

// Data Fetching
async function fetchData() {
    try {
        elements.loader.classList.remove('hidden');
        elements.dashboard.classList.add('hidden');

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'read' })
        });

        const data = await response.json();
        if (data.status === 'success') {
            state.data = data;
            renderDashboard();
        } else {
            showError("Failed to parse data from API.");
        }
    } catch (error) {
        console.error("Error fetching data:", error);
        showError("Could not connect to Google Sheets.");
    } finally {
        elements.loader.classList.add('hidden');
        elements.dashboard.classList.remove('hidden');
    }
}

// Core Logic & Rendering
function renderDashboard() {
    const targetYear = state.currentDate.getFullYear();
    const targetMonth = state.currentDate.getMonth() + 1; // 1-12

    // 1. Calculate Bills
    let grandTotal = 0;
    const cardTotals = {};
    const cardLumpSumTotals = {};
    const cardInstallmentTotals = {};

    state.data.cards.forEach(c => {
        cardTotals[c.id] = 0;
        cardLumpSumTotals[c.id] = 0;
        cardInstallmentTotals[c.id] = 0;
    });

    const relevantTransactions = [];

    // 1a. Process Lump Sums
    state.data.lumpSums.forEach(ls => {
        if (ls.year === targetYear && ls.month === targetMonth) {
            if (cardTotals[ls.cardId] !== undefined) {
                cardTotals[ls.cardId] += ls.amount;
                cardLumpSumTotals[ls.cardId] += ls.amount;
                grandTotal += ls.amount;
                relevantTransactions.push({ type: 'lump', data: ls });
            }
        }
    });

    // 1b. Process Installments
    state.data.installments.forEach(inst => {
        const start = new Date(inst.paymentStartDate);
        const startYear = start.getFullYear();
        const startMonth = start.getMonth() + 1;

        // Calculate difference in months from start date to target date
        const monthDiff = (targetYear - startYear) * 12 + (targetMonth - startMonth);

        // If current month is within the installment period (0-indexed to months-1)
        if (monthDiff >= 0 && monthDiff < inst.months) {
            const monthlyAmount = Math.floor(inst.totalAmount / inst.months);

            if (cardTotals[inst.cardId] !== undefined) {
                cardTotals[inst.cardId] += monthlyAmount;
                cardInstallmentTotals[inst.cardId] += monthlyAmount;
                grandTotal += monthlyAmount;
                relevantTransactions.push({
                    type: 'installment',
                    data: inst,
                    amount: monthlyAmount,
                    currentN: monthDiff + 1
                });
            }
        }
    });

    state.currentTransactions = relevantTransactions;

    // 2. Render Grand Total
    animateValue(elements.grandTotal, grandTotal);
    elements.totalInsights.textContent = `Includes ${relevantTransactions.length} items for this cycle.`;

    // 3. Render Cards
    elements.cardsContainer.innerHTML = state.data.cards.map(card => {
        const total = cardTotals[card.id] || 0;
        const lumpSumTotal = cardLumpSumTotals[card.id] || 0;
        const instTotal = cardInstallmentTotals[card.id] || 0;

        // Process transactions for this specific card
        const cardTxs = relevantTransactions.filter(tx => tx.data.cardId === card.id);
        cardTxs.sort((a, b) => {
            const amtA = a.type === 'lump' ? a.data.amount : a.amount;
            const amtB = b.type === 'lump' ? b.data.amount : b.amount;
            return amtB - amtA;
        });

        let txHtml = '';
        if (cardTxs.length === 0) {
            txHtml = `<div class="empty-state">No transactions</div>`;
        } else {
            cardTxs.forEach(tx => {
                if (tx.type === 'lump') {
                    txHtml += `
            <div class="transaction-item compact">
              <div class="tx-left">
                <div class="tx-icon">💰</div>
                <div class="tx-info">
                  <h4>일시불 결제</h4>
                </div>
              </div>
              <div class="tx-right">
                <span class="tx-amount">₩${tx.data.amount.toLocaleString()}</span>
              </div>
            </div>
          `;
                } else {
                    txHtml += `
            <div class="transaction-item compact">
              <div class="tx-left">
                <div class="tx-icon installment">🔄</div>
                <div class="tx-info">
                  <h4>${tx.data.item}</h4>
                  <div class="tx-meta"><span>🛒 ${tx.data.merchant}</span></div>
                </div>
              </div>
              <div class="tx-right">
                <span class="tx-amount">₩${tx.amount.toLocaleString()}</span>
                <span class="tx-progress">${tx.currentN} / ${tx.data.months}</span>
              </div>
            </div>
          `;
                }
            });
        }

        return `
      <div class="credit-card-item" onclick="toggleCardDetails('${card.id}')">
        <h3 class="cc-name">${card.name}</h3>
        <span class="cc-payday">Pay Date: ${card.payDay}th</span>
        <div class="cc-breakdown">
          <div class="cc-breakdown-row">
            <span class="cc-breakdown-label">통합 결제액:</span>
            <span class="cc-amount">₩${total.toLocaleString()}</span>
          </div>
          <div class="cc-breakdown-row sub">
            <span class="cc-breakdown-label">일시불:</span>
            <span class="cc-breakdown-val">₩${lumpSumTotal.toLocaleString()}</span>
          </div>
          <div class="cc-breakdown-row sub">
            <span class="cc-breakdown-label">할부:</span>
            <span class="cc-breakdown-val">₩${instTotal.toLocaleString()}</span>
          </div>
        </div>
        
        <div class="expand-indicator">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chevron-down"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>

        <div class="cc-details-layer" id="details-${card.id}">
             <div class="cc-details-inner">
               ${txHtml}
             </div>
        </div>

      </div>
    `;
    }).join('');

    // 4. Render Details List - REMOVED, now integrated into cards
    // renderDetails();
}

window.toggleCardDetails = function (cardId) {
    const detailsEl = document.getElementById(`details-${cardId}`);
    const parentCard = detailsEl.closest('.credit-card-item');
    if (detailsEl.classList.contains('expanded')) {
        detailsEl.classList.remove('expanded');
        parentCard.classList.remove('active');
    } else {
        detailsEl.classList.add('expanded');
        parentCard.classList.add('active');
    }
}

// renderDetails function is no longer needed
// function renderDetails() {
//     const listContainer = elements.detailsList;
//     let html = '';
//     const txs = state.currentTransactions;

//     const filtered = txs.filter(tx => {
//         if (state.activeFilter === 'all') return true;
//         if (state.activeFilter === 'lumpSums') return tx.type === 'lump';
//         if (state.activeFilter === 'installments') return tx.type === 'installment';
//         return true;
//     });

//     if (filtered.length === 0) {
//         listContainer.innerHTML = `<div class="empty-state">No transactions found for this month.</div>`;
//         return;
//     }

//     // Sort by amount descending
//     filtered.sort((a, b) => {
//         const amtA = a.type === 'lump' ? a.data.amount : a.amount;
//         const amtB = b.type === 'lump' ? b.data.amount : b.amount;
//         return amtB - amtA;
//     });

//     filtered.forEach(tx => {
//         const card = state.data.cards.find(c => c.id === tx.data.cardId);
//         const cardName = card ? card.name : 'Unknown';

//         if (tx.type === 'lump') {
//             html += `
//         <div class="transaction-item">
//           <div class="tx-left">
//             <div class="tx-icon">💰</div>
//             <div class="tx-info">
//               <h4>Lump Sum Payment</h4>
//               <div class="tx-meta">
//                 <span>💳 ${cardName}</span>
//               </div>
//             </div>
//           </div>
//           <div class="tx-right">
//             <span class="tx-amount">₩${tx.data.amount.toLocaleString()}</span>
//           </div>
//         </div>
//       `;
//         } else {
//             html += `
//         <div class="transaction-item">
//           <div class="tx-left">
//             <div class="tx-icon installment">🔄</div>
//             <div class="tx-info">
//               <h4>${tx.data.item}</h4>
//               <div class="tx-meta">
//                 <span>🛒 ${tx.data.merchant}</span>
//                 <span>💳 ${cardName}</span>
//               </div>
//             </div>
//           </div>
//           <div class="tx-right">
//             <span class="tx-amount">₩${tx.amount.toLocaleString()}</span>
//             <span class="tx-progress">${tx.currentN} / ${tx.data.months}</span>
//           </div>
//         </div>
//       `;
//         }
//     });

//     listContainer.innerHTML = html;
// }

function animateValue(obj, end, duration = 1000) {
    let startTimestamp = null;
    const start = parseInt(obj.textContent.replace(/,/g, '')) || 0;

    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);

        // Easing function: easeOutQuart
        const easeProgress = 1 - Math.pow(1 - progress, 4);
        const currentNum = Math.floor(easeProgress * (end - start) + start);

        obj.innerHTML = currentNum.toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = end.toLocaleString();
        }
    };
    window.requestAnimationFrame(step);
}

function showError(msg) {
    elements.dashboard.innerHTML = `<div class="empty-state" style="color:#ef4444;">🚨 ${msg}</div>`;
    elements.dashboard.classList.remove('hidden');
}

// Start app
document.addEventListener('DOMContentLoaded', init);
