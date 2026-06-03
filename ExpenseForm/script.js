/**
 * ==========================================================================
 * 大學生期末專題：極簡智能記帳系統前端邏輯 (JavaScript)
 * 功能說明：
 * 1. 雙模運作機制：支援真實 Flask API 串接與單機 LocalStorage 模擬展示，保證專題簡報 100% 成功。
 * 2. 資料獲取與動態渲染：利用 fetch GET 請求讀取記帳資料，並動態生成卡片列表。
 * 3. 排序與數據摘要：依日期由新到舊排序，並即時計算總收入、總支出與本期結餘。
 * 4. 表單提交：透過 fetch POST 請求非同步提交新資料，新增成功後自動重新整理畫面。
 * ==========================================================================
 */

// ----------------------------------------------------
// 全局常數與 DOM 元素獲取
// ----------------------------------------------------
const expenseForm = document.getElementById('expense-form');
const toastMessage = document.getElementById('toast-message');
const dateInput = document.getElementById('date');
const historyList = document.getElementById('history-list');

// 數據摘要元素
const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');
const totalBalanceEl = document.getElementById('total-balance');

// 預設的模擬資料庫，當 Flask API 伺服器未運行時做為展示備用
const LOCAL_STORAGE_KEY = 'expense_fallback_data';
let isBackendConnected = false; // 是否已成功連線至 Flask API 後端

// ----------------------------------------------------
// 初始化流程
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // 1. 將日期輸入框的預設值設定為今天
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;

    // 2. 獲取記帳資料並渲染畫面
    fetchExpenses();
});

// ----------------------------------------------------
// API 串接：讀取記帳資料 (GET)
// ----------------------------------------------------
async function fetchExpenses() {
    showLoading();

    try {
        // 使用 fetch 發送 GET 請求到 Flask API 後端
        // 支援 /get_expenses 路由
        const response = await fetch('/get_expenses');
        
        if (!response.ok) {
            throw new Error(`API 錯誤: ${response.status}`);
        }
        
        const data = await response.json();
        isBackendConnected = true; // 標記連線成功
        
        // 執行歷史紀錄畫面渲染
        renderDashboard(data);

        // 異步呼叫後端 /summary API 獲取統計資料
        await fetchSummary();

    } catch (error) {
        console.warn('⚠️ 無法連線至 Flask API 後端，已自動切換為模擬展示模式。錯誤原因:', error.message);
        isBackendConnected = false; // 標記為單機模擬模式
        
        // 從 LocalStorage 載入歷史模擬資料
        const fallbackData = getFallbackData();
        renderDashboard(fallbackData);

        // 模擬模式下：直接從 LocalStorage 歷史資料本地計算統計並更新
        calculateAndRenderLocalSummary(fallbackData);
    }
}

// ----------------------------------------------------
// API 串接：讀取記帳統計摘要 (GET /summary)
// ----------------------------------------------------
async function fetchSummary() {
    try {
        // 發送 GET 請求到後端統計端點
        const response = await fetch('/summary');
        
        if (!response.ok) {
            throw new Error(`統計 API 錯誤: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 呼叫統計卡片渲染功能
        renderSummary(data.total_income, data.total_expense, data.balance);

    } catch (error) {
        console.error('⚠️ 無法讀取統計摘要 API，改由本地計算。錯誤原因:', error.message);
        // 本地降級防錯機制，計算 LocalStorage 中的資料
        const fallbackData = getFallbackData();
        calculateAndRenderLocalSummary(fallbackData);
    }
}

/**
 * 模擬模式：自 LocalStorage 資料本機計算統計結果
 * @param {Array} expenses - 本地暫存記帳紀錄
 */
function calculateAndRenderLocalSummary(expenses) {
    let totalIncome = 0;
    let totalExpense = 0;

    expenses.forEach(item => {
        if (item.type === 'income') {
            totalIncome += item.amount;
        } else if (item.type === 'expense') {
            totalExpense += item.amount;
        }
    });

    const balance = totalIncome - totalExpense;
    renderSummary(totalIncome, totalExpense, balance);
}

/**
 * 渲染統計摘要數據至前端卡片
 * @param {number} totalIncome - 總收入
 * @param {number} totalExpense - 總支出
 * @param {number} balance - 目前結餘
 */
function renderSummary(totalIncome, totalExpense, balance) {
    // 格式化為台幣貨幣形式並填入 DOM 元素 (例如 +$12,000)
    totalIncomeEl.textContent = `+$${totalIncome.toLocaleString()}`;
    totalExpenseEl.textContent = `-$${totalExpense.toLocaleString()}`;
    
    if (balance >= 0) {
        totalBalanceEl.textContent = `$${balance.toLocaleString()}`;
        // 正結餘顯示深沉科技藍
        totalBalanceEl.style.color = '#1e3a8a';
    } else {
        totalBalanceEl.textContent = `-$${Math.abs(balance).toLocaleString()}`;
        // 負結餘(超支)顯示精緻胭脂紅
        totalBalanceEl.style.color = '#ef4444';
    }
}


// ----------------------------------------------------
// API 串接：新增記帳資料 (POST)
// ----------------------------------------------------
expenseForm.addEventListener('submit', async function(event) {
    // 阻止表單預設的頁面重整行為
    event.preventDefault();

    // 取得使用者輸入的資料
    const type = document.getElementById('type').value;
    const amountVal = document.getElementById('amount').value.trim();
    const date = document.getElementById('date').value;
    const notes = document.getElementById('notes').value.trim();

    // 1. 空白與防禦性欄位驗證
    if (!type || amountVal === '' || !date) {
        showToast('<i class="fas fa-exclamation-circle"></i> 請填寫所有必填欄位 (交易類型、金額、日期)！', 'error');
        return;
    }

    const amount = parseFloat(amountVal);
    if (isNaN(amount) || amount <= 0) {
        showToast('<i class="fas fa-exclamation-circle"></i> 交易金額必須是高於 0 的有效數值！', 'error');
        return;
    }

    // 整理成標準 JSON 資料格式
    const requestData = {
        type: type,
        amount: amount,
        date: date,
        note: notes // 後端 app.py 同時相容 note 與 notes
    };

    // 取得送出按鈕以提供加載中視覺反饋
    const submitBtn = expenseForm.querySelector('.submit-btn');
    const originalBtnText = submitBtn.innerHTML;
    
    try {
        // 按鈕視覺反饋
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 處理中...';
        submitBtn.disabled = true;

        if (isBackendConnected) {
            // ---------------- API 模式：發送 POST 請求 ----------------
            const response = await fetch('/add_expense', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || '新增失敗');
            }
            
            showToast('<i class="fas fa-check-circle"></i> 新增成功！已儲存至 SQLite', 'success');
        } else {
            // ---------------- 模擬展示模式：寫入 LocalStorage ----------------
            // 模擬一個小延遲，展現 Web App 動態感
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const fallbackData = getFallbackData();
            // 模擬生成一個流水號 ID
            requestData.id = Date.now();
            fallbackData.push(requestData);
            saveFallbackData(fallbackData);
            
            showToast('<i class="fas fa-info-circle"></i> 新增成功！(模擬展示)', 'success');
        }

        // 重置表單，保留今日日期
        expenseForm.reset();
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;

        // 重新讀取 API 資料，動態更新畫面列表與統計數據
        await fetchExpenses();

    } catch (error) {
        console.error('提交失敗:', error);
        showToast(`<i class="fas fa-exclamation-triangle"></i> 新增失敗: ${error.message}`, 'error');
    } finally {
        // 恢復按鈕狀態
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
    }
});

// ----------------------------------------------------
// 數據分析與畫面渲染邏輯 (DOM Rendering)
// ----------------------------------------------------
function renderDashboard(expenses) {
    // 1. 安全排序：將資料依日期由新到舊 (Newest to Oldest) 進行二次排序
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 2. 渲染歷史卡片列表
    historyList.innerHTML = '';

    // 【重要需求】：若沒有資料，顯示「目前沒有記帳資料」空狀態
    if (expenses.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-receipt"></i>
                <div class="empty-text">目前沒有記帳資料</div>
            </div>
        `;
        return;
    }

    // 依序動態產生卡片 UI
    expenses.forEach(item => {
        const isIncome = item.type === 'income';
        const typeClass = isIncome ? 'income' : 'expense';
        const typeIcon = isIncome ? 'fa-arrow-down' : 'fa-arrow-up';
        const sign = isIncome ? '+' : '-';
        const amountFormatted = `${sign}$${item.amount.toLocaleString()}`;
        
        // 備註若為空，則顯示「無備註說明」以維持介面美感
        const noteText = item.note || item.notes || '無備註說明';

        const itemHTML = `
            <div class="history-item">
                <div class="item-left">
                    <!-- 收支圓形圖標，收入為綠、支出為紅 -->
                    <div class="item-icon ${typeClass}">
                        <i class="fas ${typeIcon}"></i>
                    </div>
                    <div class="item-details">
                        <!-- 備註說明 -->
                        <span class="item-note">${escapeHTML(noteText)}</span>
                        <!-- 記帳日期 -->
                        <span class="item-date">
                            <i class="far fa-calendar-alt"></i> ${item.date}
                            <span style="color: #cbd5e1; margin: 0 4px;">|</span>
                            <span>${isIncome ? '收入' : '支出'}</span>
                        </span>
                    </div>
                </div>
                <div class="item-right">
                    <!-- 金額金額，收入綠、支出紅 -->
                    <span class="item-amount ${typeClass}">${amountFormatted}</span>
                </div>
            </div>
        `;
        historyList.insertAdjacentHTML('beforeend', itemHTML);
    });
}

// ----------------------------------------------------
// 輔助工具函式
// ----------------------------------------------------

/**
 * 顯示載入中動畫狀態
 */
function showLoading() {
    historyList.innerHTML = `
        <div class="loading-state">
            <i class="fas fa-circle-notch fa-spin"></i>
            <div>正在讀取 API 資料...</div>
        </div>
    `;
}

/**
 * 顯示 Toast 提示訊息 (支援成功與錯誤樣式)
 * @param {string} message - 帶有 HTML 的訊息內容
 * @param {string} type - 提示類型 ('success' | 'error')
 */
function showToast(message, type = 'success') {
    toastMessage.innerHTML = message;
    
    // 動態變更樣式，避免單一綠色背景不符錯誤提示需求
    if (type === 'error') {
        toastMessage.style.backgroundColor = '#ef4444';
        toastMessage.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.2)';
    } else {
        toastMessage.style.backgroundColor = '#10b981';
        toastMessage.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.2)';
    }

    toastMessage.classList.remove('hidden');

    // 清除舊的計時器，防範連續點擊導致提早隱藏
    if (window.toastTimeout) {
        clearTimeout(window.toastTimeout);
    }

    window.toastTimeout = setTimeout(() => {
        toastMessage.classList.add('hidden');
    }, 3000);
}

/**
 * HTML 跳脫防禦，防範 XSS 攻擊
 */
function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ----------------------------------------------------
// LocalStorage 模擬資料庫輔助函式 (Fallback Mechanism)
// ----------------------------------------------------
function getFallbackData() {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    // 如果 LocalStorage 為空，回傳空陣列
    return data ? JSON.parse(data) : [];
}

function saveFallbackData(data) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
}
