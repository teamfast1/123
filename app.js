// Мини-хостинг презентаций с исправленной Firebase Authentication
class PresentationHosting {
    constructor() {
        // Встроенная конфигурация Firebase
        this.firebaseConfig = {
            apiKey: "AIzaSyCFpnlhrD0XYoFX0gSTYuntqp5luEAMY-w",
            authDomain: "werwer5555.firebaseapp.com",
            projectId: "werwer5555",
            storageBucket: "werwer5555.firebasestorage.app",
            messagingSenderId: "25398297460",
            appId: "1:25398297460:web:ac9832da4c53b6f3f42221",
            measurementId: "G-PBF39XWP8K"
        };
        
        this.currentUser = null;
        this.userRole = 'guest';
        this.currentPage = 'home';
        this.currentPresentation = null;
        this.pdfDoc = null;
        this.pageNum = 1;
        this.scale = 1.5;
        this.isFirebaseConnected = false;
        this.isAuthEnabled = false;
        this.demoMode = false;
        this.isInitialized = false;
        
        // Fallback данные только если Firebase недоступен
        this.fallbackData = {
            presentations: [
                {
                    id: 'sample1',
                    title: 'Основы веб-разработки',
                    description: 'Введение в современную веб-разработку с использованием HTML, CSS и JavaScript',
                    category: 'tech',
                    author: 'Преподаватель',
                    ownerName: 'Преподаватель',
                    createdAt: new Date('2024-01-15'),
                    isPublic: true,
                    viewCount: 125
                },
                {
                    id: 'sample2',
                    title: 'Цифровая стратегия',
                    description: 'Эффективные методы развития бизнеса в цифровую эпоху',
                    category: 'business',
                    author: 'Бизнес-консультант',
                    ownerName: 'Бизнес-консультант',
                    createdAt: new Date('2024-02-10'),
                    isPublic: true,
                    viewCount: 89
                },
                {
                    id: 'sample3',
                    title: 'Современное образование',
                    description: 'Инновационные подходы в обучении и развитии навыков',
                    category: 'education',
                    author: 'Педагог-методист',
                    ownerName: 'Педагог-методист',
                    createdAt: new Date('2024-03-05'),
                    isPublic: true,
                    viewCount: 156
                }
            ],
            users: [
                { id: 'admin1', email: 'admin@example.com', role: 'admin', displayName: 'Администратор', createdAt: new Date('2024-01-01') },
                { id: 'user1', email: 'user@example.com', role: 'user', displayName: 'Пользователь', createdAt: new Date('2024-01-15') }
            ]
        };
    }
    
    async init() {
        if (this.isInitialized) return;
        
        console.log('🚀 Инициализация приложения...');
        
        // СРАЗУ показываем статус подключения
        this.updateConnectionStatus('connecting');
        
        // Привязываем события
        this.bindEvents();
        
        // Показываем главную страницу сразу
        this.showPage('home');
        
        // Пытаемся подключиться к Firebase
        let connectionSuccess = false;
        
        try {
            await this.initFirebaseCore();
            connectionSuccess = true;
            this.updateConnectionStatus('connected');
            console.log('✅ Firebase Firestore подключен успешно');
            
            // ПОСЛЕ успешного Firestore пытаемся подключить Auth (необязательно)
            this.initFirebaseAuth();
            
        } catch (error) {
            console.error('❌ Ошибка подключения к Firebase Firestore:', error);
            this.updateConnectionStatus('error');
            // Включаем fallback режим только при ошибке Firestore
            this.demoMode = true;
            connectionSuccess = false;
        }
        
        // Загружаем презентации в любом случае
        await this.loadPresentations();
        
        // Обновляем UI
        this.updateUI();
        
        this.isInitialized = true;
        console.log('✅ Приложение готово к работе');
        
        // Обновляем статус системы в админ-панели
        this.updateSystemStatus();
    }
    
    async initFirebaseCore() {
        console.log('🔗 Подключение к Firebase Firestore...');
        
        // Проверяем доступность Firebase SDK
        if (typeof firebase === 'undefined') {
            throw new Error('Firebase SDK не загружен');
        }
        
        // Проверяем, не инициализирован ли уже Firebase
        if (firebase.apps.length > 0) {
            console.log('Firebase уже инициализирован');
            this.db = firebase.firestore();
            this.storage = firebase.storage();
        } else {
            // Инициализируем Firebase приложение
            firebase.initializeApp(this.firebaseConfig);
            this.db = firebase.firestore();
            this.storage = firebase.storage();
        }
        
        // КРИТИЧНАЯ ПРОВЕРКА: тестируем только Firestore
        console.log('🧪 Тестирование подключения к Firestore...');
        const testPromise = this.db.collection('presentations').where('isPublic', '==', true).limit(1).get();
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Firestore connection timeout')), 8000)
        );
        
        await Promise.race([testPromise, timeoutPromise]);
        
        // Если дошли сюда, значит Firestore работает
        this.isFirebaseConnected = true;
        this.demoMode = false;
        
        console.log('✅ Firestore подключен и работает');
    }
    
    async initFirebaseAuth() {
        console.log('🔐 Подключение Firebase Authentication...');
        
        try {
            this.auth = firebase.auth();
            
            // Тестируем Authentication с таймаутом
            const authTestPromise = new Promise((resolve) => {
                const unsubscribe = this.auth.onAuthStateChanged((user) => {
                    unsubscribe();
                    resolve(user);
                });
            });
            
            const authTimeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Auth timeout')), 5000)
            );
            
            await Promise.race([authTestPromise, authTimeoutPromise]);
            
            this.isAuthEnabled = true;
            
            // Устанавливаем слушатель изменений авторизации
            this.auth.onAuthStateChanged((user) => {
                this.handleAuthStateChange(user);
            });
            
            console.log('✅ Firebase Authentication подключен');
            
        } catch (error) {
            console.warn('⚠️ Firebase Authentication недоступен:', error.message);
            this.isAuthEnabled = false;
            // НЕ влияет на основную работу приложения
        }
        
        // Обновляем UI независимо от результата Auth
        this.updateUI();
    }
    
    updateConnectionStatus(status = 'connecting') {
        const indicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        
        if (indicator && statusText) {
            // Удаляем все классы и добавляем нужный
            indicator.className = `status-indicator ${status}`;
            
            switch(status) {
                case 'connecting':
                    statusText.textContent = 'Подключение к Firebase...';
                    break;
                case 'connected':
                    // ИСПРАВЛЕНО: показываем успех если Firestore работает
                    statusText.textContent = '✅ Подключено к Firebase';
                    break;
                case 'error':
                    statusText.textContent = '⚠️ Ограниченный режим';
                    break;
                default:
                    statusText.textContent = 'Подключение...';
            }
            
            console.log('Статус подключения обновлен:', status, statusText.textContent);
        }
    }
    
    updateSystemStatus() {
        // Обновляем статус в админ-панели
        const firestoreStatus = document.getElementById('firestoreStatus');
        const authStatus = document.getElementById('authStatus');
        
        if (firestoreStatus) {
            if (this.isFirebaseConnected) {
                firestoreStatus.textContent = 'Подключено';
                firestoreStatus.className = 'status status--success';
            } else {
                firestoreStatus.textContent = 'Недоступно';
                firestoreStatus.className = 'status status--error';
            }
        }
        
        if (authStatus) {
            if (this.isAuthEnabled) {
                authStatus.textContent = 'Активен';
                authStatus.className = 'status status--success';
            } else {
                authStatus.textContent = 'Недоступен';
                authStatus.className = 'status status--warning';
            }
        }
    }
    
    async handleAuthStateChange(user) {
        console.log('Изменение статуса аутентификации:', user ? user.email : 'не авторизован');
        this.currentUser = user;
        
        if (user && !this.demoMode && this.isAuthEnabled) {
            // Получаем или создаем профиль пользователя в Firebase
            try {
                const userDoc = await this.db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    this.userRole = userDoc.data().role || 'user';
                } else {
                    // Создаем новый профиль пользователя
                    await this.createUserProfile(user);
                }
            } catch (error) {
                console.error('Ошибка получения роли пользователя:', error);
                this.userRole = 'user';
            }
        } else if (user && this.demoMode) {
            // В fallback режиме проверяем по email
            const fallbackUser = this.fallbackData.users.find(u => u.email === user.email);
            this.userRole = fallbackUser ? fallbackUser.role : 'user';
        } else {
            this.userRole = 'guest';
        }
        
        this.updateUI();
    }
    
    async createUserProfile(user) {
        try {
            // Проверяем, первый ли это пользователь (автоматический админ)
            const settingsDoc = await this.db.collection('settings').doc('global').get();
            const isFirstUser = !settingsDoc.exists || !settingsDoc.data()?.firstAdminCreated;
            
            const role = isFirstUser ? 'admin' : 'user';
            
            await this.db.collection('users').doc(user.uid).set({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                role: role,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            this.userRole = role;
            
            if (isFirstUser) {
                // Отмечаем, что первый админ создан
                await this.db.collection('settings').doc('global').set({
                    firstAdminCreated: true
                });
                
                this.showToast('success', 'Добро пожаловать!', 'Вы первый пользователь и получили права администратора');
            }
            
        } catch (error) {
            console.error('Ошибка создания профиля пользователя:', error);
            this.userRole = 'user';
        }
    }
    
    updateUI() {
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const userInfo = document.getElementById('userInfo');
        const userDisplayName = document.getElementById('userDisplayName');
        const uploadBtn = document.getElementById('uploadBtn');
        const profileBtn = document.getElementById('profileBtn');
        const adminBtn = document.getElementById('adminBtn');
        
        // ИСПРАВЛЕНО: показываем кнопку входа только если Auth доступен
        if (this.currentUser) {
            if (loginBtn) loginBtn.classList.add('hidden');
            if (userInfo) userInfo.classList.remove('hidden');
            if (userDisplayName) {
                userDisplayName.textContent = this.currentUser.displayName || this.currentUser.email;
            }
            
            if (this.userRole === 'user' || this.userRole === 'admin') {
                if (uploadBtn) uploadBtn.classList.remove('hidden');
                if (profileBtn) profileBtn.classList.remove('hidden');
            }
            
            if (this.userRole === 'admin') {
                if (adminBtn) adminBtn.classList.remove('hidden');
            }
        } else {
            if (loginBtn) {
                // Показываем кнопку входа только если Auth доступен ИЛИ в demo режиме
                if (this.isAuthEnabled || this.demoMode) {
                    loginBtn.classList.remove('hidden');
                } else {
                    loginBtn.classList.add('hidden');
                }
            }
            if (userInfo) userInfo.classList.add('hidden');
            if (uploadBtn) uploadBtn.classList.add('hidden');
            if (profileBtn) profileBtn.classList.add('hidden');
            if (adminBtn) adminBtn.classList.add('hidden');
        }
    }
    
    bindEvents() {
        console.log('Привязка событий...');
        
        // Навигация
        this.bindNavigation();
        
        // Аутентификация (только если доступна)
        this.bindAuthentication();
        
        // Загрузка презентаций
        this.bindUpload();
        
        // Админ-панель
        this.bindAdminPanel();
        
        // Модальные окна
        this.bindModals();
        
        // PDF навигация
        this.bindPDFNavigation();
        
        // Фильтры
        this.bindFilters();
        
        console.log('События привязаны');
    }
    
    bindNavigation() {
        const homeBtn = document.getElementById('homeBtn');
        const loginBtn = document.getElementById('loginBtn');
        const uploadBtn = document.getElementById('uploadBtn');
        const adminBtn = document.getElementById('adminBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        
        if (homeBtn) {
            homeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Клик по кнопке "Главная"');
                this.showPage('home');
            });
        }
        
        if (loginBtn) {
            loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Клик по кнопке "Войти"');
                if (this.isAuthEnabled || this.demoMode) {
                    this.showPage('auth');
                } else {
                    this.showToast('warning', 'Недоступно', 'Аутентификация временно недоступна');
                }
            });
        }
        
        if (uploadBtn) {
            uploadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Клик по кнопке "Загрузить"');
                this.showPage('upload');
            });
        }
        
        if (adminBtn) {
            adminBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Клик по кнопке "Админ-панель"');
                this.showPage('admin');
            });
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Клик по кнопке "Выйти"');
                this.logout();
            });
        }
    }
    
    bindAuthentication() {
        const authForm = document.getElementById('authForm');
        const registerBtn = document.getElementById('registerBtn');
        const googleSignInBtn = document.getElementById('googleSignInBtn');
        
        if (authForm) {
            authForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('Отправка формы входа');
                this.handleAuth(e);
            });
        }
        
        if (registerBtn) {
            registerBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Клик по кнопке "Регистрация"');
                this.handleRegister();
            });
        }
        
        if (googleSignInBtn) {
            googleSignInBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Клик по кнопке "Google"');
                this.signInWithGoogle();
            });
        }
    }
    
    bindUpload() {
        const uploadForm = document.getElementById('uploadForm');
        if (uploadForm) {
            uploadForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleUpload(e);
            });
        }
    }
    
    bindAdminPanel() {
        const adminTabs = document.querySelectorAll('.admin-tab');
        adminTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                this.showAdminSection(e.target.dataset.tab);
            });
        });
    }
    
    bindModals() {
        const closeRoleModal = document.getElementById('closeRoleModal');
        const cancelRole = document.getElementById('cancelRole');
        const roleForm = document.getElementById('roleForm');
        
        if (closeRoleModal) {
            closeRoleModal.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideModal('roleModal');
            });
        }
        
        if (cancelRole) {
            cancelRole.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideModal('roleModal');
            });
        }
        
        if (roleForm) {
            roleForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRoleChange(e);
            });
        }
    }
    
    bindPDFNavigation() {
        const backToHome = document.getElementById('backToHome');
        const prevPage = document.getElementById('prevPage');
        const nextPage = document.getElementById('nextPage');
        const zoomOut = document.getElementById('zoomOut');
        const zoomIn = document.getElementById('zoomIn');
        
        if (backToHome) {
            backToHome.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Возврат на главную страницу');
                this.showPage('home');
            });
        }
        
        if (prevPage) {
            prevPage.addEventListener('click', (e) => {
                e.preventDefault();
                this.changePage(-1);
            });
        }
        
        if (nextPage) {
            nextPage.addEventListener('click', (e) => {
                e.preventDefault();
                this.changePage(1);
            });
        }
        
        if (zoomOut) {
            zoomOut.addEventListener('click', (e) => {
                e.preventDefault();
                this.changeZoom(-0.25);
            });
        }
        
        if (zoomIn) {
            zoomIn.addEventListener('click', (e) => {
                e.preventDefault();
                this.changeZoom(0.25);
            });
        }
    }
    
    bindFilters() {
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => {
                console.log('Изменение фильтра категории');
                this.loadPresentations();
            });
        }
    }
    
    async handleAuth(e) {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();
        
        if (!email || !password) {
            this.showToast('error', 'Ошибка', 'Заполните все поля');
            return;
        }
        
        console.log('Попытка входа:', email);
        
        if (!this.isAuthEnabled) {
            // В demo режиме или если Auth недоступен
            this.handleFallbackAuth(email, password);
            return;
        }
        
        try {
            await this.auth.signInWithEmailAndPassword(email, password);
            this.showToast('success', 'Вход выполнен', 'Добро пожаловать!');
            this.showPage('home');
        } catch (error) {
            console.error('Ошибка входа:', error);
            this.showToast('error', 'Ошибка входа', this.getAuthErrorMessage(error));
        }
    }
    
    handleFallbackAuth(email, password) {
        console.log('Fallback вход для:', email);
        const fallbackUser = this.fallbackData.users.find(u => u.email === email);
        if (fallbackUser && password === 'demo123') {
            this.currentUser = { 
                email, 
                displayName: fallbackUser.displayName, 
                uid: fallbackUser.id 
            };
            this.userRole = fallbackUser.role;
            this.updateUI();
            this.showToast('success', 'Вход выполнен', `Добро пожаловать, ${fallbackUser.displayName}!`);
            this.showPage('home');
        } else {
            this.showToast('error', 'Ошибка входа', 'Неверные данные для входа');
        }
    }
    
    async handleRegister() {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();
        
        if (!email || !password) {
            this.showToast('error', 'Ошибка', 'Заполните все поля');
            return;
        }
        
        if (!this.isAuthEnabled) {
            this.showToast('warning', 'Недоступно', 'Регистрация временно недоступна');
            return;
        }
        
        try {
            await this.auth.createUserWithEmailAndPassword(email, password);
            this.showToast('success', 'Регистрация завершена', 'Добро пожаловать!');
            this.showPage('home');
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            this.showToast('error', 'Ошибка регистрации', this.getAuthErrorMessage(error));
        }
    }
    
    async signInWithGoogle() {
        if (!this.isAuthEnabled) {
            this.showToast('warning', 'Недоступно', 'Аутентификация временно недоступна');
            return;
        }
        
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await this.auth.signInWithPopup(provider);
            this.showToast('success', 'Вход выполнен', 'Добро пожаловать!');
            this.showPage('home');
        } catch (error) {
            console.error('Ошибка входа через Google:', error);
            this.showToast('error', 'Ошибка входа', 'Не удалось войти через Google');
        }
    }
    
    async logout() {
        if (!this.demoMode && this.auth && this.isAuthEnabled) {
            await this.auth.signOut();
        } else {
            this.currentUser = null;
            this.userRole = 'guest';
            this.updateUI();
        }
        this.showToast('info', 'Выход', 'До свидания!');
        this.showPage('home');
    }
    
    async handleUpload(e) {
        e.preventDefault();
        
        if (!this.currentUser) {
            this.showToast('warning', 'Требуется вход', 'Для загрузки файлов необходимо войти в систему');
            return;
        }
        
        if (this.demoMode) {
            this.showToast('warning', 'Недоступно', 'Загрузка файлов недоступна в ограниченном режиме');
            return;
        }
        
        const file = document.getElementById('presentationFile').files[0];
        const title = document.getElementById('title').value.trim();
        const description = document.getElementById('description').value.trim();
        const category = document.getElementById('category').value;
        const isPublic = document.getElementById('isPublic').checked;
        
        if (!file || !title) {
            this.showToast('error', 'Ошибка', 'Заполните обязательные поля');
            return;
        }
        
        if (file.size > 1024 * 1024) { // 1MB лимит
            this.showToast('error', 'Ошибка', 'Файл слишком большой (максимум 1MB)');
            return;
        }
        
        try {
            this.showToast('info', 'Загрузка', 'Загружаем презентацию...');
            
            // Конвертируем файл в base64
            const base64 = await this.fileToBase64(file);
            
            // Сохраняем презентацию в Firestore
            await this.db.collection('presentations').add({
                title,
                description,
                category,
                isPublic,
                fileType: file.type,
                fileSize: file.size,
                fileData: base64,
                fileName: file.name,
                ownerId: this.currentUser.uid,
                ownerName: this.currentUser.displayName || this.currentUser.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                views: 0
            });
            
            this.showToast('success', 'Успешно загружено', 'Презентация добавлена в каталог');
            document.getElementById('uploadForm').reset();
            this.showPage('home');
            this.loadPresentations();
            
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            this.showToast('error', 'Ошибка загрузки', 'Не удалось загрузить презентацию');
        }
    }
    
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }
    
    async loadPresentations() {
        console.log('📋 Загрузка презентаций...');
        const grid = document.getElementById('presentationsGrid');
        const loading = document.getElementById('loadingIndicator');
        const categoryFilter = document.getElementById('categoryFilter');
        
        if (!grid) {
            console.error('Не найден элемент presentationsGrid');
            return;
        }
        
        const selectedCategory = categoryFilter ? categoryFilter.value : '';
        
        if (loading) loading.classList.remove('hidden');
        grid.innerHTML = '';
        
        try {
            let presentations = [];
            
            if (this.demoMode) {
                console.log('📋 Загрузка презентаций из fallback данных...');
                presentations = this.fallbackData.presentations.filter(p => 
                    p.isPublic && (!selectedCategory || p.category === selectedCategory)
                );
            } else {
                console.log('📋 Загрузка презентаций из Firestore...');
                let query = this.db.collection('presentations').where('isPublic', '==', true);
                
                if (selectedCategory) {
                    query = query.where('category', '==', selectedCategory);
                }
                
                const snapshot = await query.orderBy('createdAt', 'desc').get();
                presentations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log(`📋 Загружено ${presentations.length} презентаций из Firestore`);
            }
            
            if (presentations.length === 0) {
                grid.innerHTML = `
                    <div class="text-center" style="grid-column: 1/-1; padding: 2rem; color: var(--color-text-secondary);">
                        <h3>Презентации не найдены</h3>
                        <p>В выбранной категории пока нет презентаций.</p>
                        ${this.demoMode ? '<p><small>Работаем в ограниченном режиме</small></p>' : ''}
                        ${!this.currentUser && (this.isAuthEnabled || this.demoMode) ? '<p><small><strong>Войдите в систему</strong> для загрузки презентаций</small></p>' : ''}
                    </div>
                `;
            } else {
                presentations.forEach(presentation => {
                    const card = this.createPresentationCard(presentation);
                    grid.appendChild(card);
                });
                console.log(`📋 Отображено ${presentations.length} презентаций`);
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки презентаций:', error);
            grid.innerHTML = `
                <div class="text-center" style="grid-column: 1/-1; padding: 2rem; color: var(--color-error);">
                    <h3>Ошибка загрузки презентаций</h3>
                    <p>Не удалось загрузить презентации. Проверьте подключение к интернету.</p>
                    <button class="btn btn--outline btn--sm" onclick="app.loadPresentations()">Попробовать снова</button>
                </div>
            `;
        }
        
        if (loading) loading.classList.add('hidden');
    }
    
    createPresentationCard(presentation) {
        const card = document.createElement('div');
        card.className = 'presentation-card';
        card.addEventListener('click', () => this.openPresentation(presentation));
        
        const date = presentation.createdAt ? 
            (presentation.createdAt.toDate ? presentation.createdAt.toDate() : presentation.createdAt) : 
            new Date();
        
        card.innerHTML = `
            <div class="presentation-thumbnail">📄</div>
            <div class="presentation-content">
                <h3>${this.escapeHtml(presentation.title)}</h3>
                <p>${this.escapeHtml(presentation.description || 'Описание отсутствует')}</p>
                <div class="presentation-meta">
                    <span class="status status--info">${this.getCategoryName(presentation.category)}</span>
                    <span class="presentation-author">👤 ${this.escapeHtml(presentation.ownerName || presentation.author || 'Автор')}</span>
                </div>
                <div class="presentation-meta" style="margin-top: 8px;">
                    <small>📅 ${date.toLocaleDateString('ru-RU')}</small>
                    <small>👁 ${presentation.views || presentation.viewCount || 0}</small>
                </div>
            </div>
        `;
        
        return card;
    }
    
    escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') {
            return '';
        }
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    getCategoryName(category) {
        const categories = {
            business: 'Бизнес',
            education: 'Образование', 
            tech: 'Технологии'
        };
        return categories[category] || category;
    }
    
    async openPresentation(presentation) {
        console.log('👁 Открытие презентации:', presentation.title);
        this.currentPresentation = presentation;
        
        if (!this.demoMode && presentation.id && this.isFirebaseConnected) {
            // Увеличиваем счетчик просмотров только если Firestore доступен
            try {
                await this.db.collection('presentations').doc(presentation.id).update({
                    views: firebase.firestore.FieldValue.increment(1)
                });
            } catch (error) {
                console.warn('Не удалось обновить счетчик просмотров:', error);
            }
        }
        
        this.showPage('presentation');
        this.displayPresentationInfo();
        
        // Загружаем образец презентации
        this.loadSamplePresentation();
    }
    
    displayPresentationInfo() {
        const presentation = this.currentPresentation;
        const date = presentation.createdAt ? 
            (presentation.createdAt.toDate ? presentation.createdAt.toDate() : presentation.createdAt) : 
            new Date();
        
        const titleEl = document.getElementById('presentationTitle');
        const descEl = document.getElementById('presentationDescription');
        const categoryEl = document.getElementById('presentationCategory');
        const authorEl = document.getElementById('presentationAuthor');
        const dateEl = document.getElementById('presentationDate');
        
        if (titleEl) titleEl.textContent = presentation.title;
        if (descEl) descEl.textContent = presentation.description || 'Описание отсутствует';
        if (categoryEl) {
            categoryEl.textContent = this.getCategoryName(presentation.category);
            categoryEl.className = 'status status--info';
        }
        if (authorEl) authorEl.textContent = `👤 Автор: ${presentation.ownerName || presentation.author || 'Неизвестно'}`;
        if (dateEl) dateEl.textContent = `📅 Дата: ${date.toLocaleDateString('ru-RU')}`;
    }
    
    loadSamplePresentation() {
        setTimeout(() => this.renderSamplePresentation(), 100);
    }
    
    renderSamplePresentation() {
        const canvas = document.getElementById('pdfCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        canvas.width = 800;
        canvas.height = 600;
        
        // Белый фон
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Заголовок
        ctx.fillStyle = '#1f343b';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.currentPresentation.title, canvas.width / 2, 120);
        
        // Подзаголовок
        ctx.font = '24px Arial';
        ctx.fillText('Образец презентации', canvas.width / 2, 170);
        
        // Контент
        ctx.font = '20px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('• Просмотр презентаций доступен всем пользователям', 60, 250);
        ctx.fillText('• Загрузка требует авторизации', 60, 290);
        ctx.fillText('• Поддержка PDF-файлов до 1MB', 60, 330);
        ctx.fillText('• Категории: Бизнес, Образование, Технологии', 60, 370);
        ctx.fillText('• Интеграция с Firebase Firestore', 60, 410);
        
        // Статус подключения
        ctx.font = '18px Arial';
        const statusText = this.isFirebaseConnected ? '✅ Firebase подключен' : '⚠️ Ограниченный режим';
        ctx.fillText(`Статус: ${statusText}`, 60, 460);
        
        // Информация о демо
        if (this.demoMode) {
            ctx.fillStyle = '#e67e22';
            ctx.fillText('Демо-режим: Используются тестовые данные', 60, 500);
        }
        
        // Обновляем информацию о странице
        const pageInfo = document.getElementById('pageInfo');
        if (pageInfo) pageInfo.textContent = 'Образец презентации';
    }
    
    changePage(delta) {
        // Заглушка для навигации по страницам
        console.log('Навигация по страницам:', delta);
        this.showToast('info', 'Навигация', 'Это демонстрационная презентация');
    }
    
    changeZoom(delta) {
        this.scale = Math.max(0.5, Math.min(3, this.scale + delta));
        console.log('Изменение масштаба:', this.scale);
        this.showToast('info', 'Масштаб', `Масштаб: ${Math.round(this.scale * 100)}%`);
    }
    
    showPage(pageName) {
        console.log('📄 Показ страницы:', pageName);
        
        // Скрываем все страницы
        const pages = document.querySelectorAll('.page');
        pages.forEach(page => {
            page.classList.add('hidden');
        });
        
        // Показываем нужную страницу
        const targetPage = document.getElementById(pageName + 'Page');
        if (targetPage) {
            targetPage.classList.remove('hidden');
            this.currentPage = pageName;
            console.log('📄 Страница', pageName, 'показана');
        } else {
            console.error('Страница не найдена:', pageName + 'Page');
        }
        
        // Специальная логика для админ-панели
        if (pageName === 'admin' && this.userRole === 'admin') {
            setTimeout(() => this.loadAdminData(), 100);
        }
    }
    
    async loadAdminData() {
        if (!this.currentUser || this.userRole !== 'admin') {
            this.showToast('error', 'Доступ запрещен', 'Только администраторы могут просматривать эти данные');
            this.showPage('home');
            return;
        }
        
        console.log('🔧 Загрузка данных админ-панели...');
        this.showAdminSection('users');
        await this.loadAdminUsers();
        await this.loadAdminPresentations(); 
        await this.loadAdminStats();
        
        // Обновляем статус системы
        this.updateSystemStatus();
    }
    
    showAdminSection(section) {
        // Обновляем табы
        const tabs = document.querySelectorAll('.admin-tab');
        tabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tab === section) {
                tab.classList.add('active');
            }
        });
        
        // Показываем нужную секцию
        const sections = document.querySelectorAll('.admin-section');
        sections.forEach(sectionEl => {
            sectionEl.classList.add('hidden');
        });
        
        const targetSection = document.getElementById('admin' + section.charAt(0).toUpperCase() + section.slice(1));
        if (targetSection) {
            targetSection.classList.remove('hidden');
        }
    }
    
    async loadAdminUsers() {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        try {
            let users;
            
            if (this.demoMode) {
                users = this.fallbackData.users;
            } else {
                const snapshot = await this.db.collection('users').get();
                users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
            
            users.forEach(user => {
                const row = document.createElement('tr');
                const createdDate = user.createdAt ? 
                    (user.createdAt.toDate ? user.createdAt.toDate() : user.createdAt) : 
                    new Date();
                
                row.innerHTML = `
                    <td>${this.escapeHtml(user.email)}</td>
                    <td>${this.escapeHtml(user.displayName || 'Не указано')}</td>
                    <td><span class="status status--${user.role === 'admin' ? 'error' : 'info'}">${this.getRoleName(user.role)}</span></td>
                    <td>${createdDate.toLocaleDateString('ru-RU')}</td>
                    <td>
                        <button class="btn btn--sm btn--outline" onclick="app.showRoleModal('${user.id}', '${this.escapeHtml(user.email)}', '${user.role}')">
                            Изменить роль
                        </button>
                        ${user.role !== 'admin' ? `<button class="btn btn--sm btn--outline" style="color: var(--color-error);" onclick="app.deleteUser('${user.id}')">Удалить</button>` : ''}
                    </td>
                `;
                tbody.appendChild(row);
            });
            
        } catch (error) {
            console.error('Ошибка загрузки пользователей:', error);
            tbody.innerHTML = '<tr><td colspan="5">Ошибка загрузки данных</td></tr>';
        }
    }
    
    async loadAdminPresentations() {
        const tbody = document.getElementById('presentationsTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        try {
            let presentations;
            
            if (this.demoMode) {
                presentations = this.fallbackData.presentations;
            } else {
                const snapshot = await this.db.collection('presentations').orderBy('createdAt', 'desc').get();
                presentations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
            
            presentations.forEach(presentation => {
                const row = document.createElement('tr');
                const date = presentation.createdAt ? 
                    (presentation.createdAt.toDate ? presentation.createdAt.toDate() : presentation.createdAt) : 
                    new Date();
                
                row.innerHTML = `
                    <td>${this.escapeHtml(presentation.title)}</td>
                    <td>${this.escapeHtml(presentation.ownerName || presentation.author || 'Неизвестно')}</td>
                    <td><span class="status status--info">${this.getCategoryName(presentation.category)}</span></td>
                    <td><span class="status status--${presentation.isPublic ? 'success' : 'warning'}">${presentation.isPublic ? 'Публичная' : 'Приватная'}</span></td>
                    <td>${date.toLocaleDateString('ru-RU')}</td>
                    <td>
                        <button class="btn btn--sm btn--outline" onclick="app.viewPresentation('${presentation.id}')">Просмотр</button>
                        <button class="btn btn--sm btn--outline" style="color: var(--color-error);" onclick="app.deletePresentation('${presentation.id}')">Удалить</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
        } catch (error) {
            console.error('Ошибка загрузки презентаций:', error);
            tbody.innerHTML = '<tr><td colspan="6">Ошибка загрузки данных</td></tr>';
        }
    }
    
    viewPresentation(presentationId) {
        let presentation = null;
        
        if (this.demoMode) {
            presentation = this.fallbackData.presentations.find(p => p.id === presentationId);
        }
        
        if (presentation) {
            this.openPresentation(presentation);
        }
    }
    
    async loadAdminStats() {
        try {
            let totalUsers, totalPresentations, totalViews;
            
            if (this.demoMode) {
                totalUsers = this.fallbackData.users.length;
                totalPresentations = this.fallbackData.presentations.length;
                totalViews = this.fallbackData.presentations.reduce((sum, p) => sum + (p.viewCount || 0), 0);
            } else {
                const usersSnapshot = await this.db.collection('users').get();
                const presentationsSnapshot = await this.db.collection('presentations').get();
                
                totalUsers = usersSnapshot.size;
                totalPresentations = presentationsSnapshot.size;
                totalViews = 0;
                
                presentationsSnapshot.docs.forEach(doc => {
                    totalViews += doc.data().views || 0;
                });
            }
            
            const totalUsersEl = document.getElementById('totalUsers');
            const totalPresentationsEl = document.getElementById('totalPresentations');
            const totalViewsEl = document.getElementById('totalViews');
            
            if (totalUsersEl) totalUsersEl.textContent = totalUsers;
            if (totalPresentationsEl) totalPresentationsEl.textContent = totalPresentations;
            if (totalViewsEl) totalViewsEl.textContent = totalViews;
            
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    }
    
    getRoleName(role) {
        const roles = {
            guest: 'Гость',
            user: 'Пользователь',
            admin: 'Администратор'
        };
        return roles[role] || role;
    }
    
    showRoleModal(userId, email, currentRole) {
        if (this.demoMode) {
            this.showToast('warning', 'Недоступно', 'Изменение ролей недоступно в ограниченном режиме');
            return;
        }
        
        const userEmailEl = document.getElementById('roleUserEmail');
        const newRoleEl = document.getElementById('newRole');
        const modalEl = document.getElementById('roleModal');
        const formEl = document.getElementById('roleForm');
        
        if (userEmailEl) userEmailEl.textContent = email;
        if (newRoleEl) newRoleEl.value = currentRole;
        if (modalEl) modalEl.classList.remove('hidden');
        if (formEl) formEl.dataset.userId = userId;
    }
    
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('hidden');
    }
    
    async handleRoleChange(e) {
        e.preventDefault();
        
        if (this.demoMode) {
            this.showToast('warning', 'Недоступно', 'Изменение ролей недоступно в ограниченном режиме');
            this.hideModal('roleModal');
            return;
        }
        
        const userId = e.target.dataset.userId;
        const newRole = document.getElementById('newRole').value;
        
        try {
            await this.db.collection('users').doc(userId).update({ role: newRole });
            this.showToast('success', 'Роль изменена', 'Роль пользователя успешно обновлена');
            this.hideModal('roleModal');
            await this.loadAdminUsers();
        } catch (error) {
            console.error('Ошибка изменения роли:', error);
            this.showToast('error', 'Ошибка', 'Не удалось изменить роль пользователя');
        }
    }
    
    async deleteUser(userId) {
        if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) {
            return;
        }
        
        if (this.demoMode) {
            this.showToast('warning', 'Недоступно', 'Удаление пользователей недоступно в ограниченном режиме');
            return;
        }
        
        try {
            await this.db.collection('users').doc(userId).delete();
            this.showToast('success', 'Пользователь удален', 'Пользователь успешно удален из системы');
            await this.loadAdminUsers();
        } catch (error) {
            console.error('Ошибка удаления пользователя:', error);
            this.showToast('error', 'Ошибка', 'Не удалось удалить пользователя');
        }
    }
    
    async deletePresentation(presentationId) {
        if (!confirm('Вы уверены, что хотите удалить эту презентацию?')) {
            return;
        }
        
        if (this.demoMode) {
            this.showToast('warning', 'Недоступно', 'Удаление презентаций недоступно в ограниченном режиме');
            return;
        }
        
        try {
            await this.db.collection('presentations').doc(presentationId).delete();
            this.showToast('success', 'Презентация удалена', 'Презентация успешно удалена');
            await this.loadAdminPresentations();
            this.loadPresentations();
        } catch (error) {
            console.error('Ошибка удаления презентации:', error);
            this.showToast('error', 'Ошибка', 'Не удалось удалить презентацию');
        }
    }
    
    showToast(type, title, message) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-title">${this.escapeHtml(title)}</div>
                <div class="toast-message">${this.escapeHtml(message)}</div>
            </div>
            <button class="toast-close">&times;</button>
        `;
        
        container.appendChild(toast);
        
        // Автоматическое удаление через 5 секунд
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 5000);
        
        // Кнопка закрытия
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                toast.remove();
            });
        }
    }
    
    getAuthErrorMessage(error) {
        const errorMessages = {
            'auth/user-not-found': 'Пользователь не найден',
            'auth/wrong-password': 'Неверный пароль',
            'auth/email-already-in-use': 'Email уже используется',
            'auth/weak-password': 'Слишком простой пароль',
            'auth/invalid-email': 'Неверный формат email',
            'auth/popup-closed-by-user': 'Окно входа было закрыто'
        };
        
        return errorMessages[error.code] || 'Произошла ошибка при входе';
    }
}

// Глобальная переменная для приложения
let app = null;

// Инициализация приложения при загрузке DOM
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM загружен, запуск приложения...');
    
    // Создаем экземпляр приложения
    app = new PresentationHosting();
    
    // Экспортируем в window для глобального доступа
    window.app = app;
    
    // Инициализируем приложение
    await app.init();
    
    console.log('✅ Приложение готово к работе');
});

/*
ИСПРАВЛЕННЫЕ Firestore Security Rules для работы БЕЗ Authentication:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Функция проверки админа (только для авторизованных)
    function isAdmin(uid) {
      return exists(/databases/$(database)/documents/users/$(uid)) &&
             get(/databases/$(database)/documents/users/$(uid)).data.role == "admin";
    }
    
    // Презентации: читать могут все публичные, писать только авторизованные
    match /presentations/{id} {
      allow read: if resource.data.isPublic == true ||
                     (request.auth != null && 
                      (request.auth.uid == resource.data.ownerId ||
                       isAdmin(request.auth.uid)));
      allow write: if request.auth != null &&
                      (request.auth.uid == resource.data.ownerId ||
                       isAdmin(request.auth.uid));
      allow create: if request.auth != null;
    }
    
    // Пользователи: только для авторизованных
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
                      (request.auth.uid == uid || isAdmin(request.auth.uid));
    }
    
    // Настройки: читать могут все, писать только авторизованные админы
    match /settings/{doc} {
      allow read: if true;
      allow write: if request.auth != null && isAdmin(request.auth.uid);
    }
  }
}
*/