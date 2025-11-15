const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Используем SQLite для простоты (не требует установки PostgreSQL)
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false
});

// Модели базы данных
const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false }
});

const BankData = sequelize.define('BankData', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  data: { type: DataTypes.JSON, allowNull: false }
});

const TaxiData = sequelize.define('TaxiData', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  data: { type: DataTypes.JSON, allowNull: false }
});

// Middleware для проверки JWT токена
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Токен доступа отсутствует' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Неверный токен' });
    }
    req.user = user;
    next();
  });
};

// Регистрация пользователя
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
    }

    // Проверяем, существует ли пользователь
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Создаем пользователя
    const user = await User.create({
      email,
      password: hashedPassword,
      name
    });

    // Создаем начальные данные для банка и такси
    await BankData.create({
      userId: user.id,
      data: { players: [], adminPassword: "121212" }
    });

    await TaxiData.create({
      userId: user.id,
      data: { shifts: [], calls: [], activeDrivers: [], dispatcherPassword: "121212" }
    });

    // Генерируем JWT токен
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});

// Вход пользователя
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    // Ищем пользователя
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Пользователь не найден' });
    }

    // Проверяем пароль
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Неверный пароль' });
    }

    // Генерируем JWT токен
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
});

// Получение банковских данных пользователя
app.get('/api/bank-data', authenticateToken, async (req, res) => {
  try {
    const bankData = await BankData.findOne({ 
      where: { userId: req.user.userId } 
    });
    
    if (!bankData) {
      // Создаем начальные данные, если их нет
      const newBankData = await BankData.create({
        userId: req.user.userId,
        data: { players: [], adminPassword: "121212" }
      });
      return res.json(newBankData.data);
    }

    res.json(bankData.data);
  } catch (error) {
    console.error('Ошибка получения банковских данных:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Сохранение банковских данных
app.post('/api/bank-data', authenticateToken, async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'Данные обязательны' });
    }

    const [bankData, created] = await BankData.upsert({
      userId: req.user.userId,
      data: data
    }, {
      returning: true
    });

    res.json({ success: true, message: 'Банковские данные сохранены' });
  } catch (error) {
    console.error('Ошибка сохранения банковских данных:', error);
    res.status(500).json({ error: 'Ошибка сервера при сохранении' });
  }
});

// Получение данных такси
app.get('/api/taxi-data', authenticateToken, async (req, res) => {
  try {
    const taxiData = await TaxiData.findOne({ 
      where: { userId: req.user.userId } 
    });
    
    if (!taxiData) {
      // Создаем начальные данные, если их нет
      const newTaxiData = await TaxiData.create({
        userId: req.user.userId,
        data: { shifts: [], calls: [], activeDrivers: [], dispatcherPassword: "121212" }
      });
      return res.json(newTaxiData.data);
    }

    res.json(taxiData.data);
  } catch (error) {
    console.error('Ошибка получения данных такси:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Сохранение данных такси
app.post('/api/taxi-data', authenticateToken, async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'Данные обязательны' });
    }

    const [taxiData, created] = await TaxiData.upsert({
      userId: req.user.userId,
      data: data
    }, {
      returning: true
    });

    res.json({ success: true, message: 'Данные такси сохранены' });
  } catch (error) {
    console.error('Ошибка сохранения данных такси:', error);
    res.status(500).json({ error: 'Ошибка сервера при сохранении' });
  }
});

// Проверка здоровья сервера
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Сервер банк-такси работает!'
  });
});

// Инициализация базы данных и запуск сервера
const PORT = process.env.PORT || 3000;
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ Подключение к базе данных установлено');
    
    await sequelize.sync({ force: false });
    console.log('✅ База данных синхронизирована');
    
    app.listen(PORT, () => {
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`📊 API доступно по адресу: http://localhost:${PORT}/api`);
      console.log(`❤️  Проверить здоровье: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Ошибка запуска сервера:', error);
    process.exit(1);
  }
}

startServer();