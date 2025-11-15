// Добавьте этот код в ваш HTML файл перед закрывающим тегом </script>

const SYNC_API_URL = 'http://localhost:3000/api'; // Измените на ваш URL сервера

// Переменные для синхронизации
let currentUser = null;
let authToken = null;

// Функции для работы с аутентификацией
function showAuthModal() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; width: 400px; max-width: 90%;">
            <h3>Вход / Регистрация</h3>
            <div style="margin-bottom: 15px;">
                <label>Имя:</label>
                <input type="text" id="authName" style="width: 100%; padding: 8px; margin: 5px 0;" placeholder="Ваше имя">
            </div>
            <div style="margin-bottom: 15px;">
                <label>Email:</label>
                <input type="email" id="authEmail" style="width: 100%; padding: 8px; margin: 5px 0;" placeholder="Ваш email">
            </div>
            <div style="margin-bottom: 20px;">
                <label>Пароль:</label>
                <input type="password" id="authPassword" style="width: 100%; padding: 8px; margin: 5px 0;" placeholder="Пароль">
            </div>
            <div style="display: flex; gap: 10px;">
                <button onclick="login()" style="flex: 1; padding: 10px; background: #3498db; color: white; border: none; border-radius: 5px;">Войти</button>
                <button onclick="register()" style="flex: 1; padding: 10px; background: #2ecc71; color: white; border: none; border-radius: 5px;">Регистрация</button>
            </div>
            <div style="margin-top: 15px; text-align: center;">
                <small>Для синхронизации данных между устройствами</small>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

async function register() {
    const name = document.getElementById('authName').value;
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    
    if (!name || !email || !password) {
        alert('Заполните все поля');
        return;
    }
    
    try {
        const response = await fetch(`${SYNC_API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            authToken = data.token;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            document.querySelector('div[style*="position: fixed"]').remove();
            await loadDataFromServer();
            showSyncStatus('Регистрация успешна! Данные синхронизированы.');
        } else {
            alert(data.error || 'Ошибка регистрации');
        }
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        alert('Ошибка соединения с сервером');
    }
}

async function login() {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    
    if (!email || !password) {
        alert('Заполните все поля');
        return;
    }
    
    try {
        const response = await fetch(`${SYNC_API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            authToken = data.token;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            document.querySelector('div[style*="position: fixed"]').remove();
            await loadDataFromServer();
            showSyncStatus('Вход выполнен! Данные загружены.');
        } else {
            alert(data.error || 'Ошибка входа');
        }
    } catch (error) {
        console.error('Ошибка входа:', error);
        alert('Ошибка соединения с сервером');
    }
}

// Функции синхронизации данных
async function loadDataFromServer() {
    if (!authToken) return;
    
    try {
        // Загружаем банковские данные
        const bankResponse = await fetch(`${SYNC_API_URL}/bank-data`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (bankResponse.ok) {
            const bankData = await bankResponse.json();
            if (bankData.players) {
                players = bankData.players;
                savePlayers(); // Сохраняем в localStorage для обратной совместимости
            }
            if (bankData.adminPassword) {
                // Можно синхронизировать пароль администратора
            }
        }
        
        // Загружаем данные такси
        const taxiResponse = await fetch(`${SYNC_API_URL}/taxi-data`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (taxiResponse.ok) {
            const taxiServerData = await taxiResponse.json();
            if (taxiServerData.shifts) taxiData.shifts = taxiServerData.shifts;
            if (taxiServerData.calls) taxiData.calls = taxiServerData.calls;
            if (taxiServerData.activeDrivers) taxiData.activeDrivers = taxiServerData.activeDrivers;
            saveTaxiData(); // Сохраняем в localStorage
        }
        
        // Обновляем интерфейс
        renderPlayers();
        renderActiveShifts();
        updatePlayerDropdown();
        updateDriverDropdown();
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        showSyncStatus('Ошибка синхронизации', true);
    }
}

async function saveDataToServer() {
    if (!authToken) return;
    
    try {
        // Сохраняем банковские данные
        await fetch(`${SYNC_API_URL}/bank-data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                data: {
                    players: players,
                    adminPassword: "121212" // или синхронизированный пароль
                }
            })
        });
        
        // Сохраняем данные такси
        await fetch(`${SYNC_API_URL}/taxi-data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                data: taxiData
            })
        });
        
        showSyncStatus('Данные сохранены на сервере');
        
    } catch (error) {
        console.error('Ошибка сохранения данных:', error);
        showSyncStatus('Ошибка сохранения', true);
    }
}

// Модифицируем существующие функции сохранения
const originalSavePlayers = savePlayers;
savePlayers = function() {
    originalSavePlayers();
    saveDataToServer();
};

const originalSaveTaxiData = saveTaxiData;
saveTaxiData = function() {
    originalSaveTaxiData();
    saveDataToServer();
};

// Функция отображения статуса синхронизации
function showSyncStatus(message, isError = false) {
    let statusElement = document.getElementById('syncStatus');
    if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.id = 'syncStatus';
        statusElement.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 10px 15px;
            border-radius: 5px;
            z-index: 1000;
            font-weight: bold;
        `;
        document.body.appendChild(statusElement);
    }
    
    statusElement.textContent = message;
    statusElement.style.background = isError ? '#e74c3c' : '#2ecc71';
    statusElement.style.color = 'white';
    
    setTimeout(() => {
        statusElement.style.display = 'none';
    }, 3000);
}

// Проверка аутентификации при загрузке
function checkAuth() {
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('currentUser');
    
    if (savedToken && savedUser) {
        authToken = savedToken;
        currentUser = JSON.parse(savedUser);
        loadDataFromServer();
    } else {
        showAuthModal();
    }
}

// Добавляем кнопку синхронизации в интерфейс
function addSyncButton() {
    const header = document.querySelector('header');
    const syncButton = document.createElement('button');
    syncButton.textContent = 'Синхронизировать';
    syncButton.className = 'edit-btn';
    syncButton.style.marginLeft = '10px';
    syncButton.onclick = loadDataFromServer;
    
    header.appendChild(syncButton);
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        checkAuth();
        addSyncButton();
    }, 1000);
});