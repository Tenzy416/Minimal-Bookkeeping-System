document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const form = document.getElementById('transaction-form');
    const amountInput = document.getElementById('amount');
    const dateInput = document.getElementById('date');
    const categoryInput = document.getElementById('category');
    const noteInput = document.getElementById('note');
    const typeRadios = document.getElementsByName('type');
    const transactionList = document.getElementById('transaction-list');
    
    const balanceEl = document.getElementById('total-balance');
    const incomeEl = document.getElementById('total-income');
    const expenseEl = document.getElementById('total-expense');

    // Default Date to Today
    dateInput.valueAsDate = new Date();

    // Categories Configuration
    const categoriesConfig = {
        expense: [
            { name: '飲食', icon: 'fa-utensils' },
            { name: '交通', icon: 'fa-car' },
            { name: '購物', icon: 'fa-shopping-bag' },
            { name: '娛樂', icon: 'fa-film' },
            { name: '生活', icon: 'fa-home' },
            { name: '其他', icon: 'fa-ellipsis-h' }
        ],
        income: [
            { name: '薪資', icon: 'fa-wallet' },
            { name: '獎金', icon: 'fa-gift' },
            { name: '投資', icon: 'fa-chart-line' },
            { name: '零用錢', icon: 'fa-coins' },
            { name: '其他', icon: 'fa-ellipsis-h' }
        ]
    };

    // Change category options based on type
    const updateCategories = (type) => {
        const categories = categoriesConfig[type];
        categoryInput.innerHTML = categories.map(cat => 
            `<option value="${cat.name}">${cat.name}</option>`
        ).join('');
    };

    // Listen to type changes
    typeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            updateCategories(e.target.value);
        });
    });

    // Initialize categories with default selected type (expense)
    updateCategories('expense');

    // State (Load from Local Storage)
    let transactions = JSON.parse(localStorage.getItem('expenseTrackerTransactions')) || [];

    // Formatters
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('zh-TW', { 
            style: 'currency', 
            currency: 'TWD', 
            minimumFractionDigits: 0 
        }).format(amount);
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('zh-TW', { 
            month: 'short', 
            day: 'numeric' 
        }).format(date);
    };

    // Get Icon for Category
    const getIcon = (categoryName, type) => {
        const cat = categoriesConfig[type].find(c => c.name === categoryName);
        return cat ? cat.icon : 'fa-circle';
    };

    // Update UI
    const updateUI = () => {
        // Calculate totals
        const income = transactions
            .filter(item => item.type === 'income')
            .reduce((acc, item) => (acc += item.amount), 0);
            
        const expense = transactions
            .filter(item => item.type === 'expense')
            .reduce((acc, item) => (acc += item.amount), 0);

        const total = income - expense;

        // Update Dashboard text
        balanceEl.innerText = formatCurrency(total);
        incomeEl.innerText = formatCurrency(income);
        expenseEl.innerText = formatCurrency(expense);

        // Render List
        transactionList.innerHTML = '';
        
        // Sort by date descending
        const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (sortedTransactions.length === 0) {
            transactionList.innerHTML = '<div class="empty-state">尚無歷史紀錄</div>';
            return;
        }

        sortedTransactions.forEach(transaction => {
            const isIncome = transaction.type === 'income';
            const sign = isIncome ? '+' : '-';
            
            const li = document.createElement('li');
            li.classList.add('transaction-item');
            
            li.innerHTML = `
                <div class="item-left">
                    <div class="item-icon ${transaction.type}">
                        <i class="fas ${getIcon(transaction.category, transaction.type)}"></i>
                    </div>
                    <div class="item-details">
                        <span class="item-title">${transaction.category}</span>
                        <span class="item-date-note">
                            ${formatDate(transaction.date)} 
                            ${transaction.note ? ` · ${transaction.note}` : ''}
                        </span>
                    </div>
                </div>
                <div class="item-right">
                    <div class="item-amount ${transaction.type}">
                        ${sign} ${formatCurrency(transaction.amount)}
                    </div>
                    <button class="delete-btn" data-id="${transaction.id}" title="刪除紀錄">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `;
            transactionList.appendChild(li);
        });
    };

    // Add Transaction
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const type = document.querySelector('input[name="type"]:checked').value;
        const amount = +amountInput.value;
        const date = dateInput.value;
        const category = categoryInput.value;
        const note = noteInput.value.trim();

        if (amount <= 0 || !date) {
            alert('請輸入有效的金額與日期');
            return;
        }

        const transaction = {
            id: generateID(),
            type,
            amount,
            date,
            category,
            note
        };

        transactions.push(transaction);
        updateLocalStorage();
        updateUI();

        // Reset form for quick consecutive entry
        amountInput.value = '';
        noteInput.value = '';
        amountInput.focus();
    });

    // Generate random ID
    const generateID = () => {
        return Math.floor(Math.random() * 100000000).toString(16);
    };

    // Update Local Storage
    const updateLocalStorage = () => {
        localStorage.setItem('expenseTrackerTransactions', JSON.stringify(transactions));
    };

    // Delete Transaction
    transactionList.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            const id = deleteBtn.getAttribute('data-id');
            transactions = transactions.filter(t => t.id !== id);
            updateLocalStorage();
            updateUI();
        }
    });

    // Initial render
    updateUI();
});
