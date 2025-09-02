// ========== PREMIUM AGRICULTURAL DASHBOARD JAVASCRIPT ==========

// 전역 변수 및 설정
const AppConfig = {
    DATA_URL: 'https://raw.githubusercontent.com/soonpark2/project2/main/재배동향DB.csv',
    CACHE_DURATION: 5 * 60 * 1000, // 5분
    ANIMATION_DURATION: 300,
    CHART_COLORS: {
        primary: '#14b8a6',
        secondary: '#10b981',
        accent: '#06b6d4',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#06b6d4'
    },
    GRADIENT_COLORS: [
        'rgba(20, 184, 166, 0.8)',
        'rgba(94, 234, 212, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(6, 182, 212, 0.8)',
        'rgba(15, 118, 110, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(13, 148, 136, 0.8)'
    ]
};

// 앱 상태 관리
class AppState {
    constructor() {
        this.data = {
            raw: [],
            processed: {},
            filtered: [],
            cache: new Map()
        };
        this.ui = {
            currentSection: 'dashboard',
            sidebarCollapsed: false,
            charts: new Map(),
            animations: new Map()
        };
        this.filters = {
            year: 'all',
            cropGroup: 'all',
            region: 'all',
            searchTerm: ''
        };
    }

    // 데이터 설정
    setRawData(data) {
        this.data.raw = data;
        this.processData();
    }

    // 데이터 처리
    processData() {
        const data = this.data.raw;
        
        // 필드 매핑 자동 감지
        const fieldMapping = this.detectFieldMapping(data[0] || {});
        
        // 데이터 정규화
        data.forEach(row => {
            this.normalizeDataRow(row, fieldMapping);
        });

        // 처리된 데이터 구조 생성
        this.data.processed = {
            years: [...new Set(data.map(row => row.year).filter(y => y))].sort(),
            cropGroups: [...new Set(data.map(row => row.cropGroup).filter(g => g))],
            crops: [...new Set(data.map(row => row.cropName).filter(c => c))],
            regions: [...new Set(data.map(row => row.region).filter(r => r))],
            fieldMapping
        };

        console.log('데이터 처리 완료:', this.data.processed);
    }

    // 필드 매핑 자동 감지
    detectFieldMapping(firstRow) {
        const mapping = {};
        const keys = Object.keys(firstRow);
        
        keys.forEach(key => {
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('연도') || lowerKey.includes('년') || lowerKey.includes('year')) 
                mapping.year = key;
            if (lowerKey.includes('작목군') || lowerKey.includes('구분') || lowerKey.includes('group')) 
                mapping.cropGroup = key;
            if (lowerKey.includes('작목명') || lowerKey.includes('품목') || lowerKey.includes('crop')) 
                mapping.cropName = key;
            if (lowerKey.includes('지역') || lowerKey.includes('시도') || lowerKey.includes('region')) 
                mapping.region = key;
            if (lowerKey.includes('면적') || lowerKey.includes('ha') || lowerKey.includes('area')) 
                mapping.area = key;
            if (lowerKey.includes('생산량') || lowerKey.includes('톤') || lowerKey.includes('production')) 
                mapping.production = key;
        });

        return mapping;
    }

    // 데이터 행 정규화
    normalizeDataRow(row, fieldMapping) {
        // 숫자 필드 안전 변환
        const safeParseNumber = (value) => {
            if (!value) return 0;
            if (typeof value === 'number') return value;
            return parseFloat(value.toString().replace(/,/g, '').replace(/[^\d.-]/g, '')) || 0;
        };

        // 정규화된 필드 설정
        row.year = row[fieldMapping.year];
        row.cropGroup = row[fieldMapping.cropGroup];
        row.cropName = row[fieldMapping.cropName];
        row.region = row[fieldMapping.region];
        row.area = safeParseNumber(row[fieldMapping.area]);
        row.production = safeParseNumber(row[fieldMapping.production]);
        row.productivity = row.area > 0 ? (row.production / row.area) : 0;

        // 하위 호환성을 위한 원본 필드명 유지
        row['연도'] = row.year;
        row['작목군'] = row.cropGroup;
        row['작목명'] = row.cropName;
        row['지역'] = row.region;
        row['면적(ha)'] = row.area;
        row['생산량(톤)'] = row.production;
        row['생산성'] = row.productivity;
    }

    // 필터된 데이터 가져오기
    getFilteredData() {
        return this.data.raw.filter(row => {
            return (this.filters.year === 'all' || row.year === this.filters.year) &&
                   (this.filters.cropGroup === 'all' || row.cropGroup === this.filters.cropGroup) &&
                   (this.filters.region === 'all' || row.region === this.filters.region) &&
                   (this.filters.searchTerm === '' || 
                    row.cropName?.toLowerCase().includes(this.filters.searchTerm.toLowerCase()));
        });
    }
}

// 전역 앱 상태 인스턴스
const appState = new AppState();

// DOM이 로드되면 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// ========== 앱 초기화 및 메인 로직 ==========

// 앱 초기화
async function initializeApp() {
    try {
        showLoadingOverlay(true);
        await loadData();
        setupUI();
        await renderAllSections();
        initTrendTabs(); // 데이터 로드 후 동향 분석 탭 초기화
        showLoadingOverlay(false);
        updateLastUpdatedTime();
    } catch (error) {
        console.error('앱 초기화 중 오류:', error);
        showLoadingOverlay(false);
        showToast('error', '데이터를 불러오는 중 오류가 발생했습니다.');
    }
}

// UI 설정
function setupUI() {
    setupNavigation();
    setupSidebar();
    setupHeaderActions();
    setupAdvancedFilters();
    setupChartControls();
    setupDataTableControls();
    setupKeyboardShortcuts();
}

// 모든 섹션 렌더링
async function renderAllSections() {
    await Promise.all([
        renderDashboard(),
        renderAnalytics(),
        renderComparison(),
        renderTrends(),
        renderDataTable(),
        renderReports()
    ]);
}

// ========== 데이터 관리 ==========

// 데이터 로드
async function loadData() {
    try {
        console.log('📥 데이터 로드 시작:', AppConfig.DATA_URL);
        
        // 캐시 확인
        const cacheKey = `data_${AppConfig.DATA_URL}`;
        const cachedData = getCachedData(cacheKey);
        
        if (cachedData) {
            console.log('✅ 캐시된 데이터 사용:', cachedData.length + '건');
            appState.setRawData(cachedData);
            console.log('✅ 처리된 연도:', appState.data.processed.years);
            return;
        }

        console.log('🌐 원격 데이터 가져오는 중...');
        const response = await fetch(AppConfig.DATA_URL);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const csvText = await response.text();
        const rawData = parseCSV(csvText);
        
        // 캐시에 저장
        setCachedData(cacheKey, rawData);
        
        appState.setRawData(rawData);
        console.log('데이터 로드 완료:', rawData.length, '건');
    } catch (error) {
        console.error('데이터 로드 오류:', error);
        throw new Error(`데이터 로드 실패: ${error.message}`);
    }
}

// 캐시 데이터 관리
function getCachedData(key) {
    try {
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        
        if (now - timestamp > AppConfig.CACHE_DURATION) {
            localStorage.removeItem(key);
            return null;
        }
        
        return data;
    } catch (error) {
        console.warn('캐시 데이터 읽기 실패:', error);
        return null;
    }
}

function setCachedData(key, data) {
    try {
        const cacheItem = {
            data,
            timestamp: Date.now()
        };
        localStorage.setItem(key, JSON.stringify(cacheItem));
    } catch (error) {
        console.warn('캐시 데이터 저장 실패:', error);
    }
}

// CSV 파싱 함수
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',');
    
    return lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const row = {};
        headers.forEach((header, index) => {
            row[header.trim()] = values[index] ? values[index].trim() : '';
        });
        return row;
    }).filter(row => Object.values(row).some(val => val !== ''));
}

// CSV 라인 파싱 (쉼표가 포함된 필드 처리)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

// 레거시 processData 함수 (AppState에서 이미 처리됨)
function processData() {
    console.log('processData 호출됨 - 이미 AppState에서 처리 완료');
}

// ========== UI 컨트롤러 ==========

// 네비게이션 설정
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionName = this.getAttribute('data-section');
            if (sectionName) {
                showSection(sectionName);
                updateBreadcrumb(sectionName);
                
                navLinks.forEach(nav => nav.classList.remove('active'));
                this.classList.add('active');
                
                appState.ui.currentSection = sectionName;
            }
        });
    });
}

// 사이드바 설정
function setupSidebar() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            appState.ui.sidebarCollapsed = !appState.ui.sidebarCollapsed;
        });
    }

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.add('collapsed');
            appState.ui.sidebarCollapsed = true;
        });
    }

    // 외부 클릭시 사이드바 닫기 (모바일에서만)
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && 
            !sidebar.contains(e.target) && 
            !menuToggle?.contains(e.target)) {
            sidebar.classList.add('collapsed');
        }
    });
}

// 헤더 액션 설정 (삭제된 버튼들로 인해 비워짐)
function setupHeaderActions() {
    // 모든 헤더 버튼이 제거되어 더 이상 설정할 액션이 없음
    console.log('헤더 액션 설정 완료 (버튼 없음)');
}

// 고급 필터 설정
function setupAdvancedFilters() {
    const advancedFilterBtn = document.getElementById('advanced-filter');
    const filterPanel = document.getElementById('filterPanel');
    const applyFiltersBtn = document.getElementById('apply-filters');
    const clearFiltersBtn = document.getElementById('clear-filters');

    if (advancedFilterBtn && filterPanel) {
        advancedFilterBtn.addEventListener('click', () => {
            filterPanel.classList.toggle('active');
        });
    }

    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyAdvancedFilters);
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearAllFilters);
    }

    // 필터 옵션 초기화
    populateFilterOptions();
}

// 차트 컨트롤 설정
function setupChartControls() {
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const chartType = this.getAttribute('data-chart');
            const chartContainer = this.closest('.chart-card');
            
            if (chartType === 'fullscreen') {
                toggleChartFullscreen(chartContainer);
            } else {
                changeChartType(chartContainer, chartType);
            }
        });
    });
}

// 데이터 테이블 컨트롤 설정
function setupDataTableControls() {
    const quickSearch = document.getElementById('quick-search');
    const pageSize = document.getElementById('page-size');
    
    if (quickSearch) {
        quickSearch.addEventListener('input', debounce(handleQuickSearch, 300));
    }
    
    if (pageSize) {
        pageSize.addEventListener('change', handlePageSizeChange);
    }

    // 테이블 정렬 설정
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            handleTableSort(th);
        });
    });
}

// 키보드 단축키 설정
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + 숫자로 섹션 이동
        if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '6') {
            e.preventDefault();
            const sectionIndex = parseInt(e.key) - 1;
            const sections = ['dashboard', 'analytics', 'comparison', 'trends', 'data', 'reports'];
            if (sections[sectionIndex]) {
                showSection(sections[sectionIndex]);
            }
        }
        
        // ESC로 사이드바 닫기
        if (e.key === 'Escape') {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.add('collapsed');
        }
        
        // F11로 전체화면
        if (e.key === 'F11') {
            e.preventDefault();
            toggleFullscreen();
        }
        
        // Ctrl/Cmd + R로 데이터 새로고침
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            refreshData();
        }
    });
}

// ========== 렌더링 함수들 ==========

// 섹션 표시
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        appState.ui.currentSection = sectionId;
    }
}

// 브레드크럼 업데이트
function updateBreadcrumb(sectionName) {
    const breadcrumb = document.getElementById('currentSection');
    const sectionNames = {
        dashboard: '대시보드',
        analytics: '고급 분석',
        comparison: '지역 비교',
        trends: '트렌드 분석',
        data: '데이터 테이블',
        reports: '분석 리포트'
    };
    
    if (breadcrumb) {
        breadcrumb.textContent = sectionNames[sectionName] || sectionName;
    }
}

// 대시보드 렌더링
async function renderDashboard() {
    // 데이터가 없으면 렌더링 건너뛰기
    if (!appState.data.raw || appState.data.raw.length === 0) {
        console.log('데이터가 없어 대시보드 렌더링을 건너뜁니다.');
        return;
    }
    
    // 강원도 데이터 확인, 없으면 전체 데이터 사용
    let targetData = appState.data.raw.filter(row => row.region === '강원도');
    if (targetData.length === 0) {
        console.log('강원도 데이터가 없어서 전체 데이터를 사용합니다.');
        targetData = appState.data.raw;
    }
    
    console.log('대시보드 렌더링 데이터:', targetData.length + '건');
    
    // KPI 카드 업데이트
    await updateKPICards();
    
    // 메인 차트 렌더링
    await renderMainChart();
    
    // TOP5 차트 렌더링
    await renderTop5Chart();
    
}

// KPI 카드 업데이트 (초기 버전)
async function updateKPICardsLegacy(data) {
    // 새로운 updateKPICards() 함수로 대체됨
    await updateKPICards();
}

// 메인 차트 렌더링
async function renderMainChart() {
    const ctx = document.getElementById('main-chart')?.getContext('2d');
    if (!ctx) return;
    
    // 기존 차트 제거
    if (appState.ui.charts.has('main-chart')) {
        appState.ui.charts.get('main-chart').destroy();
    }
    
    // 모든 필터 가져오기
    const selectedRegion = document.getElementById('region-dropdown')?.value;
    const selectedCropGroup = document.getElementById('crop-group-dropdown')?.value || 'all';
    const selectedYear = document.getElementById('year-dropdown')?.value;
    const selectedMetric = document.getElementById('metric-dropdown')?.value || 'area';
    
    // 데이터 필터링 (연도별 차트이므로 연도 필터는 제외)
    let targetData = appState.data.raw;
    if (selectedRegion) {
        targetData = targetData.filter(row => row.region === selectedRegion);
    }
    if (selectedCropGroup !== 'all') {
        targetData = targetData.filter(row => row.cropGroup === selectedCropGroup);
    }
    
    // 차트 제목 업데이트
    const chartTitle = document.getElementById('main-chart-title');
    const metricNames = {
        area: '재배면적',
        production: '생산량'
    };
    const metricUnits = {
        area: 'ha',
        production: '톤'
    };
    
    if (chartTitle) {
        chartTitle.textContent = `연도별 ${metricNames[selectedMetric]} 추이`;
    }
    
    const years = appState.data.processed.years;
    
    const yearlyData = years.map(year => {
        const yearData = targetData.filter(row => row.year === year);
        return yearData.reduce((sum, row) => sum + (row[selectedMetric] || 0), 0);
    });
    
    // 최대값의 1.5배로 y축 최대값 설정
    const maxValue = Math.max(...yearlyData);
    const yMaxValue = maxValue * 1.5;
    
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years.map(y => y + '년'),
            datasets: [{
                label: `${metricNames[selectedMetric]} (${metricUnits[selectedMetric]})`,
                data: yearlyData,
                borderColor: AppConfig.CHART_COLORS.primary,
                backgroundColor: AppConfig.CHART_COLORS.primary + '20',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: AppConfig.CHART_COLORS.primary,
                pointBorderColor: '#fff',
                pointBorderWidth: 3,
                pointRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 30,
                    right: 30
                }
            },
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: AppConfig.CHART_COLORS.primary,
                    borderWidth: 1
                },
                datalabels: {
                    display: true,
                    backgroundColor: 'white',
                    color: 'black',
                    borderRadius: 4,
                    padding: 4,
                    font: {
                        weight: 'bold',
                        size: 12
                    },
                    align: 'top',
                    anchor: 'end',
                    formatter: function(value) {
                        return Math.round(value).toLocaleString();
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            weight: 'bold',
                            size: 14
                        }
                    }
                },
                y: {
                    display: false,
                    beginAtZero: true,
                    max: yMaxValue,
                    grid: {
                        display: false
                    }
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            }
        },
        plugins: [ChartDataLabels]
    });
    
    appState.ui.charts.set('main-chart', chart);
}

// TOP5 작목군별 재배면적 차트
async function renderTop5Chart() {
    const ctx = document.getElementById('top5-chart')?.getContext('2d');
    if (!ctx) return;
    
    // 기존 차트 제거
    if (appState.ui.charts.has('top5-chart')) {
        appState.ui.charts.get('top5-chart').destroy();
    }
    
    // 모든 필터 가져오기
    const selectedRegion = document.getElementById('region-dropdown')?.value;
    const selectedCropGroup = document.getElementById('crop-group-dropdown')?.value || 'all';
    const selectedYear = document.getElementById('year-dropdown')?.value;
    const selectedMetric = document.getElementById('metric-dropdown')?.value || 'area';
    
    // 데이터 필터링
    let targetData = appState.data.raw;
    if (selectedRegion) {
        targetData = targetData.filter(row => row.region === selectedRegion);
    }
    if (selectedYear) {
        targetData = targetData.filter(row => row.year === selectedYear);
    }
    // 작목군 필터는 TOP5를 위해 제외
    
    // 차트 제목 업데이트
    const chartTitle = document.getElementById('top5-chart-title');
    const metricNames = {
        area: '재배면적',
        production: '생산량'
    };
    
    // 작목군이 선택된 경우 해당 작목군 내 작목명 TOP5, 그렇지 않으면 작목군별 재배면적
    let sortedData;
    if (selectedCropGroup !== 'all') {
        if (chartTitle) chartTitle.textContent = `${selectedCropGroup} 작목명 TOP5 ${metricNames[selectedMetric]}`;
        // 선택된 작목군의 작목명별 재배면적 집계
        const cropNameData = {};
        const filteredCropData = targetData.filter(row => row.cropGroup === selectedCropGroup);
        filteredCropData.forEach(row => {
            const cropName = row.cropName;
            if (cropName) {
                cropNameData[cropName] = (cropNameData[cropName] || 0) + (row[selectedMetric] || 0);
            }
        });
        
        // TOP5 추출
        sortedData = Object.entries(cropNameData)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);
    } else {
        if (chartTitle) chartTitle.textContent = `작목군별 TOP5 ${metricNames[selectedMetric]}`;
        // 작목군별 재배면적 집계
        const cropGroupData = {};
        targetData.forEach(row => {
            const group = row.cropGroup;
            if (group) {
                cropGroupData[group] = (cropGroupData[group] || 0) + (row[selectedMetric] || 0);
            }
        });
        
        // TOP5 추출
        sortedData = Object.entries(cropGroupData)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);
    }
    
    const metricUnits = {
        area: 'ha',
        production: '톤'
    };
    
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedData.map(([group]) => group),
            datasets: [{
                label: `${metricNames[selectedMetric]} (${metricUnits[selectedMetric]})`,
                data: sortedData.map(([,value]) => value),
                backgroundColor: AppConfig.GRADIENT_COLORS.slice(0, 5),
                borderWidth: 0,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.raw.toLocaleString()}${metricUnits[selectedMetric]}`;
                        }
                    }
                },
                datalabels: {
                    display: true,
                    anchor: 'center',
                    align: 'center',
                    color: 'black',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    borderRadius: 4,
                    padding: 3,
                    font: {
                        weight: 'bold',
                        size: 12
                    },
                    formatter: function(value) {
                        return Math.round(value).toLocaleString();
                    }
                }
            },
            scales: {
                x: {
                    display: false,
                    grid: {
                        display: false
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            weight: 'bold',
                            size: 12
                        }
                    }
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            }
        },
        plugins: [ChartDataLabels]
    });
    
    appState.ui.charts.set('top5-chart', chart);
}

// 작목군별 분포 차트
async function renderCropDistributionChart() {
    const ctx = document.getElementById('crop-distribution-chart')?.getContext('2d');
    if (!ctx) return;
    
    if (appState.ui.charts.has('crop-distribution-chart')) {
        appState.ui.charts.get('crop-distribution-chart').destroy();
    }
    
    // 데이터 선택 (강원도 우선, 없으면 전체)
    let targetData = appState.data.raw.filter(row => row.region === '강원도');
    if (targetData.length === 0) {
        targetData = appState.data.raw;
    }
    
    const cropGroupData = {};
    
    targetData.forEach(row => {
        const group = row.cropGroup;
        if (group) {
            cropGroupData[group] = (cropGroupData[group] || 0) + (row.area || 0);
        }
    });
    
    const sortedData = Object.entries(cropGroupData)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8);
    
    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedData.map(([group]) => group),
            datasets: [{
                data: sortedData.map(([,area]) => area),
                backgroundColor: AppConfig.GRADIENT_COLORS,
                borderWidth: 3,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return `${context.label}: ${context.raw.toLocaleString()}ha (${percentage}%)`;
                        }
                    }
                }
            },
            animation: {
                animateRotate: true,
                duration: 2000
            }
        }
    });
    
    appState.ui.charts.set('crop-distribution-chart', chart);
}

// 탭 설정
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            tabButtons.forEach(tab => tab.classList.remove('active'));
            this.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// 필터 설정
function setupFilters() {
    const yearFilter = document.getElementById('year-filter');
    const cropGroupFilter = document.getElementById('crop-group-filter');
    const cropSearch = document.getElementById('crop-search');
    const downloadBtn = document.getElementById('download-btn');
    
    // 연도 필터 옵션 추가
    processedData.years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year + '년';
        yearFilter.appendChild(option);
    });
    
    // 작목군 필터 옵션 추가
    processedData.cropGroups.forEach(group => {
        const option = document.createElement('option');
        option.value = group;
        option.textContent = group;
        cropGroupFilter.appendChild(option);
    });
    
    // 필터 이벤트 리스너
    yearFilter.addEventListener('change', updateDataTable);
    cropGroupFilter.addEventListener('change', updateDataTable);
    cropSearch.addEventListener('input', updateDataTable);
    downloadBtn.addEventListener('click', downloadData);
}

// 레거시 renderDashboard (새로운 함수로 대체됨)
// 이미 위에서 새로운 renderDashboard 함수가 구현되어 있음

// 레거시 renderMainChart (새로운 함수로 대체됨)
// 이미 위에서 새로운 renderMainChart 함수가 구현되어 있음

// 모든 차트 렌더링
function renderCharts() {
    renderCropAreaChart();
    renderTopCropsChart();
    renderRegionComparisonChart();
    renderShareChart();
    renderTrendChart();
    renderGrowthChart();
}

// 작목군별 재배면적 차트 (레거시)
function renderCropAreaChart() {
    console.log('작목군별 재배면적 차트 렌더링 - 새로운 시스템에서 처리됨');
}

// 주요 작물 TOP 10 차트 (레거시)
function renderTopCropsChart() {
    console.log('주요 작물 TOP 10 차트 렌더링 - 새로운 시스템에서 처리됨');
}

// 지역 비교 차트 (레거시)
function renderRegionComparisonChart() {
    console.log('지역 비교 차트 렌더링 - 새로운 시스템에서 처리됨');
}

// 강원도 점유율 차트 (레거시)
function renderShareChart() {
    console.log('강원도 점유율 차트 렌더링 - 새로운 시스템에서 처리됨');
}

// 트렌드 분석 차트 (레거시)
function renderTrendChart() {
    console.log('트렌드 분석 차트 렌더링 - 새로운 시스템에서 처리됨');
}

// 증감률 분석 차트 (레거시)
function renderGrowthChart() {
    console.log('증감률 분석 차트 렌더링 - 새로운 시스템에서 처리됨');
}

// 데이터 테이블 렌더링 (레거시)
function renderDataTable() {
    console.log('데이터 테이블 렌더링 - 새로운 시스템에서 처리됨');
}

// 데이터 테이블 업데이트 (레거시)
function updateDataTable() {
    console.log('데이터 테이블 업데이트 - 새로운 시스템에서 처리됨');
}

// ========== 유틸리티 함수들 ==========

// 숫자 애니메이션
function animateNumber(elementId, start, end, duration, formatter = (n) => n) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const startTime = performance.now();
    const diff = end - start;
    
    function updateNumber(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // 이징 함수 적용
        const easedProgress = easeOutQuart(progress);
        const current = start + (diff * easedProgress);
        
        element.textContent = formatter(current);
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        }
    }
    
    requestAnimationFrame(updateNumber);
}

// 이징 함수
function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
}

// 디바운스 함수
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 전체화면 토글
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.warn('전체화면 진입 실패:', err);
        });
    } else {
        document.exitFullscreen().catch(err => {
            console.warn('전체화면 종료 실패:', err);
        });
    }
}

// 데이터 새로고침
async function refreshData() {
    try {
        showLoadingOverlay(true);
        
        // 캐시 클리어
        const cacheKey = `data_${AppConfig.DATA_URL}`;
        localStorage.removeItem(cacheKey);
        
        await loadData();
        await renderAllSections();
        
        showLoadingOverlay(false);
        showToast('success', '데이터가 성공적으로 새로고침되었습니다!');
        updateLastUpdatedTime();
    } catch (error) {
        showLoadingOverlay(false);
        showToast('error', '데이터 새로고침 중 오류가 발생했습니다.');
    }
}

// 로딩 오버레이 제어
function showLoadingOverlay(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.toggle('active', show);
    }
}

// 토스트 알림 표시
function showToast(type, message) {
    const toast = document.getElementById('toast');
    const toastIcon = toast?.querySelector('.toast-icon');
    const toastMessage = toast?.querySelector('.toast-message');
    
    if (!toast || !toastIcon || !toastMessage) return;
    
    // 아이콘 설정
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    toastIcon.className = `toast-icon ${icons[type] || icons.info}`;
    toastMessage.textContent = message;
    
    // 토스트 표시
    toast.classList.add('show');
    
    // 자동 숨김
    setTimeout(() => {
        toast.classList.remove('show');
    }, 5000);
    
    // 닫기 버튼 이벤트
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
        closeBtn.onclick = () => toast.classList.remove('show');
    }
}

// 마지막 업데이트 시간 표시
function updateLastUpdatedTime() {
    const element = document.getElementById('lastUpdated');
    if (element) {
        const now = new Date();
        const timeString = now.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        element.textContent = `마지막 업데이트: ${timeString}`;
    }
}

// 데이터 내보내기
function exportData(format = 'csv') {
    const filteredData = appState.getFilteredData();
    
    if (format === 'csv') {
        exportToCSV(filteredData);
    } else if (format === 'excel') {
        exportToExcel(filteredData);
    }
}

// CSV 내보내기
function exportToCSV(data) {
    const headers = ['연도', '작목군', '작목명', '지역', '면적(ha)', '생산량(톤)', '생산성(톤/ha)'];
    const csvContent = [
        headers.join(','),
        ...data.map(row => [
            row.year,
            row.cropGroup,
            row.cropName,
            row.region,
            row.area,
            row.production,
            row.productivity
        ].join(','))
    ].join('\n');
    
    downloadFile(csvContent, `강원도_재배동향_${getCurrentDateString()}.csv`, 'text/csv');
}

// 파일 다운로드 헬퍼
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType + ';charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 현재 날짜 문자열
function getCurrentDateString() {
    return new Date().toISOString().slice(0, 10);
}

// 빈 렌더링 함수들 (추후 구현)
async function renderAnalytics() {
    console.log('Analytics 섹션 렌더링');
}

async function renderComparison() {
    console.log('Comparison 섹션 렌더링');
}

async function renderTrends() {
    console.log('Trends 섹션 렌더링');
}

async function renderDataTable() {
    console.log('DataTable 섹션 렌더링');
}

async function renderReports() {
    console.log('Reports 섹션 렌더링');
}

// 필터 옵션 초기화
function populateFilterOptions() {
    if (!appState.data.processed.years) {
        console.log('데이터가 아직 처리되지 않았습니다.');
        return;
    }
    
    // 지역 드롭다운 옵션 추가
    const regionDropdown = document.getElementById('region-dropdown');
    if (regionDropdown) {
        // 모든 기존 옵션 제거
        regionDropdown.innerHTML = '';
        
        appState.data.processed.regions.forEach((region, index) => {
            const option = new Option(region, region);
            if (index === 0) option.selected = true; // 첫 번째 옵션을 기본 선택
            regionDropdown.add(option);
        });
    }
    
    // 작목군 드롭다운 옵션 추가
    const cropGroupDropdown = document.getElementById('crop-group-dropdown');
    if (cropGroupDropdown) {
        const options = cropGroupDropdown.querySelectorAll('option:not([value="all"])');
        options.forEach(option => option.remove());
        
        appState.data.processed.cropGroups.forEach(group => {
            const option = new Option(group, group);
            cropGroupDropdown.add(option);
        });
    }
    
    // 연도 드롭다운 옵션 추가 (내림차순)
    const yearDropdown = document.getElementById('year-dropdown');
    if (yearDropdown) {
        // 모든 기존 옵션 제거
        yearDropdown.innerHTML = '';
        
        // 연도를 내림차순으로 정렬 (최신 연도가 위에)
        const sortedYears = [...appState.data.processed.years].sort((a, b) => b - a);
        
        sortedYears.forEach((year, index) => {
            const option = new Option(year + '년', year);
            if (index === 0) option.selected = true; // 첫 번째 옵션(최신 연도)을 기본 선택
            yearDropdown.add(option);
        });
    }
    
    // 드롭다운 이벤트 리스너 추가
    if (regionDropdown) {
        regionDropdown.addEventListener('change', handleFilterChange);
    }
    
    if (cropGroupDropdown) {
        cropGroupDropdown.addEventListener('change', handleFilterChange);
    }
    
    if (yearDropdown) {
        yearDropdown.addEventListener('change', handleFilterChange);
    }
    
    // 메트릭 드롭다운 이벤트 리스너 추가
    const metricDropdown = document.getElementById('metric-dropdown');
    if (metricDropdown) {
        metricDropdown.addEventListener('change', handleFilterChange);
    }
    
    console.log('필터 옵션 초기화 완료');
}

// 동향 분석 탭 기능
function initTrendTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // 모든 탭 버튼과 콘텐츠에서 active 클래스 제거
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // 클릭된 탭 버튼과 해당 콘텐츠에 active 클래스 추가
            button.classList.add('active');
            const targetContent = document.getElementById(targetTab + '-content');
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
    
    // 연도 비교 기능 초기화
    initYearComparison();
}

// 연도 비교 기능 초기화
function initYearComparison() {
    // DB에서 연도 옵션 생성
    populateYearSelectors();
    
    const yearASelect = document.getElementById('year-a');
    const yearBSelect = document.getElementById('year-b');
    const trendMetricSelect = document.getElementById('trend-metric');
    
    if (yearASelect && yearBSelect) {
        yearASelect.addEventListener('change', updateYearComparison);
        yearBSelect.addEventListener('change', updateYearComparison);
        
        // 초기 업데이트
        updateYearComparison();
    }
    
    if (trendMetricSelect) {
        trendMetricSelect.addEventListener('change', function() {
            updateYearComparison();
            updateCropGroupCardHeaders(); // 카드 헤더 및 내용 업데이트
            
            // 메인 비교 테이블과 차트도 업데이트
            const yearA = parseInt(document.getElementById('year-a')?.value);
            const yearB = parseInt(document.getElementById('year-b')?.value);
            
            setTimeout(() => {
                if (yearA && yearB) {
                    updateComparisonTable(yearA, yearB);
                }
                renderTrendChart();
                renderTop5Chart();
            }, 200);
        });
    }
    
    // 재배동향 탭 컨트롤들 설정
    setupCultivationControls();
    
    // 초기 차트 렌더링 및 카드 헤더 설정
    setTimeout(() => {
        renderComparisonCharts();
        updateCropGroupCardHeaders(); // 초기 카드 헤더 설정
    }, 100);
}

// 연도 선택기 옵션 생성
function populateYearSelectors() {
    console.log('🔧 연도 선택기 초기화 시작');
    const yearASelect = document.getElementById('year-a');
    const yearBSelect = document.getElementById('year-b');
    
    if (!yearASelect || !yearBSelect) {
        console.error('❌ 연도 선택기 요소를 찾을 수 없음');
        return;
    }
    
    if (!appState.data.processed.years) {
        console.error('❌ 처리된 연도 데이터가 없음');
        return;
    }
    
    // DB에서 연도 배열 가져오기 (정렬된 상태)
    const availableYears = [...appState.data.processed.years].sort((a, b) => a - b);
    
    console.log('📅 사용 가능한 연도:', availableYears);
    
    if (availableYears.length === 0) {
        console.error('❌ 사용 가능한 연도가 없음');
        return;
    }
    
    const minYear = availableYears[0];
    const maxYear = availableYears[availableYears.length - 1];
    
    // 기존 옵션 제거
    yearASelect.innerHTML = '';
    yearBSelect.innerHTML = '';
    
    // 연도 옵션 생성
    availableYears.forEach(year => {
        // Year A 옵션
        const optionA = new Option(`${year}년`, year);
        if (year === minYear) optionA.selected = true; // 최소값을 기본 선택
        yearASelect.add(optionA);
        
        // Year B 옵션
        const optionB = new Option(`${year}년`, year);
        if (year === maxYear) optionB.selected = true; // 최대값을 기본 선택
        yearBSelect.add(optionB);
    });
    
    console.log(`연도 선택기 초기화 완료: A=${minYear}년, B=${maxYear}년`);
}

// 연도 비교 업데이트
async function updateYearComparison() {
    const yearA = parseInt(document.getElementById('year-a')?.value);
    const yearB = parseInt(document.getElementById('year-b')?.value);
    
    if (!yearA || !yearB) return;
    
    // A > B인 경우 경고하고 B를 A보다 큰 값으로 조정
    if (yearA > yearB) {
        console.warn('⚠️ 기준연도가 비교연도보다 큽니다. 비교연도를 자동 조정합니다.');
        const yearBSelect = document.getElementById('year-b');
        const availableYears = [...appState.data.processed.years].sort((a, b) => a - b);
        const nextYear = availableYears.find(y => y > yearA) || availableYears[availableYears.length - 1];
        if (yearBSelect) {
            yearBSelect.value = nextYear;
        }
        return; // 함수 재귀 호출을 방지하기 위해 여기서 종료
    }
    
    // 테이블 헤더 업데이트
    const yearAHeader = document.getElementById('year-a-header');
    const yearBHeader = document.getElementById('year-b-header');
    
    if (yearAHeader) yearAHeader.textContent = `${yearA}년 (A)`;
    if (yearBHeader) yearBHeader.textContent = `${yearB}년 (B)`;
    
    // 비교 데이터 계산 및 테이블 업데이트
    await updateComparisonTable(yearA, yearB);
    
    // 차트 업데이트 (기존 차트들도 연도에 맞춰 업데이트)
    await updateTrendCharts(yearA, yearB);
    await renderComparisonCharts();
}

// 비교 테이블 업데이트
async function updateComparisonTable(yearA, yearB) {
    try {
        const selectedMetric = document.getElementById('trend-metric')?.value || 'area';
        console.log(`🔍 비교 테이블 업데이트: ${yearA} vs ${yearB}, 측정항목: ${selectedMetric}`);
        
        const dataA = appState.data.raw.filter(row => row.year == yearA);
        const dataB = appState.data.raw.filter(row => row.year == yearB);
        
        
        // 지역별 데이터 분리
        const gangwonDataA = dataA.filter(row => row.region === '강원도' || row.region === '강원');
        const gangwonDataB = dataB.filter(row => row.region === '강원도' || row.region === '강원');
        
        // 전국 데이터 - 여러 가지 전국 표기 방식 지원
        const nationalDataA = dataA.filter(row => {
            const region = row.region;
            return region === '전국' || region === '전체' || region === 'national' || region === 'National' || region === '합계';
        });
        const nationalDataB = dataB.filter(row => {
            const region = row.region;
            return region === '전국' || region === '전체' || region === 'national' || region === 'National' || region === '합계';
        });
        
        // 작목군별 데이터 집계
        const gangwonGroupsA = aggregateByCropGroup(gangwonDataA, selectedMetric);
        const gangwonGroupsB = aggregateByCropGroup(gangwonDataB, selectedMetric);
        const nationalGroupsA = aggregateByCropGroup(nationalDataA, selectedMetric);
        const nationalGroupsB = aggregateByCropGroup(nationalDataB, selectedMetric);
        
        // 실제 전국 및 강원도 총합 계산
        const nationalTotalA = Object.values(nationalGroupsA).reduce((sum, value) => sum + value, 0);
        const nationalTotalB = Object.values(nationalGroupsB).reduce((sum, value) => sum + value, 0);
        
        const gangwonTotalA = Object.values(gangwonGroupsA).reduce((sum, value) => sum + value, 0);
        const gangwonTotalB = Object.values(gangwonGroupsB).reduce((sum, value) => sum + value, 0);
        
        
        // 비중 계산
        const ratioA = nationalTotalA > 0 ? (gangwonTotalA / nationalTotalA * 100) : 0;
        const ratioB = nationalTotalB > 0 ? (gangwonTotalB / nationalTotalB * 100) : 0;
        
        // 증감률 계산
        const nationalChangeRate = nationalTotalA > 0 ? ((nationalTotalB - nationalTotalA) / nationalTotalA * 100) : 0;
        const gangwonChangeRate = gangwonTotalA > 0 ? ((gangwonTotalB - gangwonTotalA) / gangwonTotalA * 100) : 0;
        const ratioChange = ratioB - ratioA;
        
        // 테이블 업데이트
        updateTableRow('.total-row', {
            national: [formatNumber(nationalTotalA), formatNumber(nationalTotalB)],
            gangwon: [formatNumber(gangwonTotalA), formatNumber(gangwonTotalB)],
            ratio: [formatPercent(ratioA), formatPercent(ratioB)],
            changeRate: [formatChangeRate(nationalChangeRate), formatChangeRate(gangwonChangeRate)],
            changeValue: formatChangeValue(ratioChange)
        });
        
        // 작목군별 행 업데이트
        updateCropGroupRows(gangwonGroupsA, gangwonGroupsB, nationalGroupsA, nationalGroupsB, selectedMetric);
        
    } catch (error) {
        console.error('비교 테이블 업데이트 오류:', error);
    }
}

// 작목군별 데이터 집계
function aggregateByCropGroup(data, metric = 'area') {
    const result = {};
    data.forEach(row => {
        const group = row.cropGroup;
        if (group) {
            const value = row[metric] || 0;
            result[group] = (result[group] || 0) + value;
        }
    });
    return result;
}

// 테이블 행 업데이트
function updateTableRow(selector, data) {
    const row = document.querySelector(selector);
    if (!row) {
        console.error(`❌ 테이블 행을 찾을 수 없음: ${selector}`);
        return;
    }
    
    const cells = row.querySelectorAll('td');
    if (cells.length >= 9) {
        cells[1].textContent = data.national[0]; // 전국 A
        cells[2].textContent = data.gangwon[0];  // 강원 A
        cells[3].textContent = data.ratio[0];    // 비중 A
        cells[4].textContent = data.national[1]; // 전국 B
        cells[5].textContent = data.gangwon[1];  // 강원 B
        cells[6].textContent = data.ratio[1];    // 비중 B
        cells[7].textContent = data.changeRate[0]; // 전국 증감률
        cells[8].textContent = data.changeRate[1]; // 강원 증감률
        cells[9].textContent = data.changeValue;   // 비중 증감
        
        // 증감률 색상 적용
        cells[7].className = getChangeRateClass(data.changeRate[0]);
        cells[8].className = getChangeRateClass(data.changeRate[1]);
    }
}

// 작목군별 행 업데이트
function updateCropGroupRows(gangwonGroupsA, gangwonGroupsB, nationalGroupsA, nationalGroupsB, metric = 'area') {
    const tbody = document.querySelector('.comparison-table tbody');
    if (!tbody) return;
    
    // 기존 작목군 행 제거 (total-row 이후)
    const totalRow = tbody.querySelector('.total-row');
    if (totalRow) {
        let nextRow = totalRow.nextElementSibling;
        while (nextRow) {
            const toRemove = nextRow;
            nextRow = nextRow.nextElementSibling;
            toRemove.remove();
        }
    }
    
    // 모든 작목군 목록 생성 (고정 순서: 식량, 채소, 과수, 특약용작물)
    const fixedCropGroupOrder = ['식량', '채소', '과수', '특약용작물'];
    const availableCropGroups = new Set([
        ...Object.keys(gangwonGroupsA), 
        ...Object.keys(gangwonGroupsB),
        ...Object.keys(nationalGroupsA),
        ...Object.keys(nationalGroupsB)
    ]);
    
    // 고정된 순서로 필터링하여 실제 데이터가 있는 작목군만 선택
    const allCropGroups = fixedCropGroupOrder.filter(group => availableCropGroups.has(group));
    
    // 전국 총합 계산
    const nationalTotalA = Object.values(nationalGroupsA).reduce((sum, value) => sum + value, 0);
    const nationalTotalB = Object.values(nationalGroupsB).reduce((sum, value) => sum + value, 0);
    
    // 작목군별 행 추가
    allCropGroups.forEach(cropGroup => {
        const gangwonValueA = gangwonGroupsA[cropGroup] || 0;
        const gangwonValueB = gangwonGroupsB[cropGroup] || 0;
        
        const nationalValueA = nationalGroupsA[cropGroup] || 0;
        const nationalValueB = nationalGroupsB[cropGroup] || 0;
        
        const ratioA = nationalTotalA > 0 ? (gangwonValueA / nationalTotalA * 100) : 0;
        const ratioB = nationalTotalB > 0 ? (gangwonValueB / nationalTotalB * 100) : 0;
        
        const nationalChangeRate = nationalValueA > 0 ? ((nationalValueB - nationalValueA) / nationalValueA * 100) : 0;
        const gangwonChangeRate = gangwonValueA > 0 ? ((gangwonValueB - gangwonValueA) / gangwonValueA * 100) : 0;
        const ratioChange = ratioB - ratioA;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${cropGroup}</strong></td>
            <td class="number">${formatNumber(nationalValueA)}</td>
            <td class="number">${formatNumber(gangwonValueA)}</td>
            <td class="percent">${formatPercent(ratioA)}</td>
            <td class="number">${formatNumber(nationalValueB)}</td>
            <td class="number">${formatNumber(gangwonValueB)}</td>
            <td class="percent">${formatPercent(ratioB)}</td>
            <td class="${getChangeRateClass(nationalChangeRate)}">${formatChangeRate(nationalChangeRate)}</td>
            <td class="${getChangeRateClass(gangwonChangeRate)}">${formatChangeRate(gangwonChangeRate)}</td>
            <td class="change-value">${formatChangeValue(ratioChange)}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// 트렌드 차트 업데이트
async function updateTrendCharts(yearA, yearB) {
    // 기존 차트들을 선택된 연도 범위에 맞춰 업데이트
    // 이 부분은 기존 차트 렌더링 함수들을 호출하되, 연도 필터를 적용
    console.log(`차트 업데이트: ${yearA} vs ${yearB}`);
}

// 비교 차트 렌더링
async function renderComparisonCharts() {
    console.log('🎨 비교 차트들 렌더링 시작');
    await renderTrendChart();
    await renderRatioComparisonChart();
    console.log('🎨 비교 차트들 렌더링 완료');
}

// 작목군별 상세 카드들 렌더링
async function renderCropGroupCards() {
    console.log('🎨 작목군별 상세 카드들 렌더링 시작');
    console.log('📊 현재 데이터 상태:', appState.data.raw ? `${appState.data.raw.length}개 행` : '데이터 없음');
    
    const cropGroups = [
        { name: '식량', tableId: 'grain-comparison-table', yearHeaderAId: 'grain-year-a-header', yearHeaderBId: 'grain-year-b-header', trendChartId: 'grain-trend-chart', cropsChartId: 'grain-crops-chart' },
        { name: '채소', tableId: 'vegetable-comparison-table', yearHeaderAId: 'vegetable-year-a-header', yearHeaderBId: 'vegetable-year-b-header', trendChartId: 'vegetable-trend-chart', cropsChartId: 'vegetable-crops-chart' },
        { name: '과수', tableId: 'fruit-comparison-table', yearHeaderAId: 'fruit-year-a-header', yearHeaderBId: 'fruit-year-b-header', trendChartId: 'fruit-trend-chart', cropsChartId: 'fruit-crops-chart' },
        { name: '특약용작물', tableId: 'special-comparison-table', yearHeaderAId: 'special-year-a-header', yearHeaderBId: 'special-year-b-header', trendChartId: 'special-trend-chart', cropsChartId: 'special-crops-chart' }
    ];
    
    // 데이터 유효성 검사
    if (!appState.data.raw || appState.data.raw.length === 0) {
        console.warn('⚠️ 작목군별 카드 렌더링: 데이터가 없습니다');
        return;
    }
    
    // 모든 작목군에 대해 순차적으로 처리 (디버깅을 위해)
    for (const cropGroup of cropGroups) {
        try {
            console.log(`🔄 ${cropGroup.name} 카드 렌더링 시작...`);
            
            // HTML 요소 존재 확인
            const tableElement = document.getElementById(cropGroup.tableId);
            const trendChartElement = document.getElementById(cropGroup.trendChartId);
            const cropsChartElement = document.getElementById(cropGroup.cropsChartId);
            
            console.log(`📋 ${cropGroup.name} 요소 확인:`, {
                table: tableElement ? '존재' : '없음',
                trendChart: trendChartElement ? '존재' : '없음',
                cropsChart: cropsChartElement ? '존재' : '없음'
            });
            
            if (!tableElement) {
                console.error(`❌ ${cropGroup.name} 테이블 요소 없음: ${cropGroup.tableId}`);
                continue;
            }
            
            // 테이블 업데이트
            console.log(`📊 ${cropGroup.name} 테이블 업데이트 중...`);
            updateCropGroupTable(cropGroup.name, cropGroup.tableId, cropGroup.yearHeaderAId, cropGroup.yearHeaderBId);
            
            // 차트 렌더링
            if (trendChartElement) {
                console.log(`📈 ${cropGroup.name} 트렌드 차트 렌더링 중...`);
                await renderCropGroupTrendChart(cropGroup.name, cropGroup.trendChartId, cropGroup.trendChartId);
            }
            
            if (cropsChartElement) {
                console.log(`📊 ${cropGroup.name} 작목별 차트 렌더링 중...`);
                await renderCropGroupTop5Chart(cropGroup.name, cropGroup.cropsChartId, cropGroup.cropsChartId);
            }
            
            console.log(`✅ ${cropGroup.name} 카드 렌더링 완료`);
        } catch (error) {
            console.error(`❌ ${cropGroup.name} 카드 렌더링 중 오류:`, error);
            console.error('오류 상세:', error.message);
            console.error('스택 트레이스:', error.stack);
        }
    }
    
    console.log('🎨 작목군별 상세 카드들 렌더링 완료');
}

// 차트 1: 강원 재배면적/비중 시계열 차트
async function renderTrendChart() {
    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js가 로드되지 않았습니다');
        return;
    }
    
    const canvasElement = document.getElementById('trend-chart');
    if (!canvasElement) {
        console.error('❌ trend-chart 캔버스 요소를 찾을 수 없습니다');
        return;
    }
    
    const ctx = canvasElement.getContext('2d');
    if (!ctx) {
        console.error('❌ trend-chart 컨텍스트를 생성할 수 없습니다');
        return;
    }
    
    console.log('📊 trend-chart 렌더링 시작');
    console.log('📊 캔버스 요소:', canvasElement);
    console.log('📊 캔버스 크기:', canvasElement.width, 'x', canvasElement.height);
    
    // 기존 차트 제거
    if (appState.ui.charts.has('trend-chart')) {
        appState.ui.charts.get('trend-chart').destroy();
    }
    
    const selectedMetric = document.getElementById('trend-metric')?.value || 'area';
    const metricNames = {
        area: '재배면적',
        production: '생산량'
    };
    
    // 차트 제목 업데이트
    const chartTitle = document.getElementById('trend-chart-title');
    if (chartTitle) {
        chartTitle.innerHTML = `<i class="fas fa-chart-line"></i> ${metricNames[selectedMetric]} 및 비중`;
    }
    
    if (!appState.data.processed.years || appState.data.processed.years.length === 0) {
        console.error('❌ 처리된 연도 데이터가 없습니다');
        return;
    }
    
    // 기준연도(A)와 비교연도(B) 가져오기
    const yearA = parseInt(document.getElementById('year-a')?.value);
    const yearB = parseInt(document.getElementById('year-b')?.value);
    
    if (!yearA || !yearB) {
        console.error('❌ 연도 선택값이 없습니다');
        return;
    }
    
    // A > B인 경우 처리
    if (yearA > yearB) {
        console.warn('⚠️ 기준연도가 비교연도보다 큽니다');
        return;
    }
    
    // A <= B 범위의 연도들만 필터링
    const allYears = appState.data.processed.years.sort((a, b) => a - b);
    const years = allYears.filter(year => year >= yearA && year <= yearB);
    
    console.log(`📅 사용할 연도 범위: ${yearA}년 ~ ${yearB}년`);
    console.log('📅 필터된 연도:', years);
    
    if (years.length === 0) {
        console.warn('⚠️ 선택된 연도 범위에 데이터가 없습니다');
        return;
    }
    
    // 연도별 강원도 데이터와 전국 데이터 계산
    const gangwonData = [];
    const ratioData = [];
    
    years.forEach(year => {
        const yearData = appState.data.raw.filter(row => row.year === year);
        const gangwonYearData = yearData.filter(row => row.region === '강원도' || row.region === '강원');
        // 여러 가지 전국 표기 방식 지원
        const nationalYearData = yearData.filter(row => {
            const region = row.region;
            return region === '전국' || region === '전체' || region === 'national' || region === 'National' || region === '합계';
        });
        
        const gangwonTotal = gangwonYearData.reduce((sum, row) => sum + (row[selectedMetric] || 0), 0);
        const nationalTotal = nationalYearData.reduce((sum, row) => sum + (row[selectedMetric] || 0), 0);
        
        gangwonData.push(gangwonTotal);
        ratioData.push(nationalTotal > 0 ? (gangwonTotal / nationalTotal * 100) : 0);
    });
    
    console.log('📊 강원 데이터:', gangwonData);
    console.log('📊 비중 데이터:', ratioData);
    
    if (gangwonData.every(val => val === 0) && ratioData.every(val => val === 0)) {
        console.warn('⚠️ 모든 데이터가 0입니다. 데이터를 확인해주세요.');
    }
    
    const metricUnits = {
        area: 'ha',
        production: '톤'
    };
    
    try {
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: years.map(y => y + '년'),
                datasets: [
                    {
                        label: `강원 ${metricNames[selectedMetric]} (${metricUnits[selectedMetric]})`,
                        type: 'bar',
                        data: gangwonData,
                        backgroundColor: 'rgba(100, 116, 139, 0.7)',
                        borderColor: 'rgba(100, 116, 139, 1)',
                        borderWidth: 2,
                        yAxisID: 'y'
                    },
                    {
                        label: '강원 비중 (%)',
                        type: 'line',
                        data: ratioData,
                        backgroundColor: 'rgba(20, 184, 166, 0.2)',
                        borderColor: 'rgba(20, 184, 166, 1)',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.4,
                        pointBackgroundColor: 'rgba(20, 184, 166, 1)',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 6,
                        yAxisID: 'y1'
                    }
                ]
            },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) {
                                return `${context.dataset.label}: ${context.raw.toLocaleString()}${metricUnits[selectedMetric]}`;
                            } else {
                                return `${context.dataset.label}: ${context.raw.toFixed(1)}%`;
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: `${metricNames[selectedMetric]} (${metricUnits[selectedMetric]})`
                    },
                    beginAtZero: true,
                    max: gangwonData.length > 0 ? Math.max(...gangwonData) * 1.5 : 1000,
                    ticks: {
                        callback: function(value, index, values) {
                            // 최대값을 예쁜 숫자로 반올림하고 콤마 형식으로 표시
                            let roundedValue;
                            if (value >= 100000) {
                                roundedValue = Math.round(value / 10000) * 10000;
                            } else if (value >= 10000) {
                                roundedValue = Math.round(value / 1000) * 1000;
                            } else if (value >= 1000) {
                                roundedValue = Math.round(value / 100) * 100;
                            } else {
                                roundedValue = Math.round(value / 10) * 10;
                            }
                            return roundedValue.toLocaleString();
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: '비중 (%)'
                    },
                    beginAtZero: true,
                    max: ratioData.length > 0 ? Math.max(...ratioData) * 1.3 : 8,
                    ticks: {
                        callback: function(value, index, values) {
                            // 비중은 소수점 1자리까지만 표시하고 예쁜 숫자로 반올림
                            if (value >= 10) {
                                return Math.round(value);
                            } else {
                                return Math.round(value * 2) / 2; // 0.5 단위로 반올림
                            }
                        }
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            }
        }
    });
    
    appState.ui.charts.set('trend-chart', chart);
    console.log('✅ trend-chart 렌더링 완료');
    
    } catch (error) {
        console.error('❌ trend-chart 생성 중 오류:', error);
        console.error('오류 상세:', error.message);
        console.error('스택 트레이스:', error.stack);
    }
}

// 차트 2: 전국대비 강원 비중 비교 차트
async function renderRatioComparisonChart() {
    const ctx = document.getElementById('ratio-comparison-chart')?.getContext('2d');
    if (!ctx) return;
    
    // 기존 차트 제거
    if (appState.ui.charts.has('ratio-comparison-chart')) {
        appState.ui.charts.get('ratio-comparison-chart').destroy();
    }
    
    const yearA = document.getElementById('year-a')?.value;
    const yearB = document.getElementById('year-b')?.value;
    const selectedMetric = document.getElementById('trend-metric')?.value || 'area';
    
    if (!yearA || !yearB) return;
    
    const dataA = appState.data.raw.filter(row => row.year == yearA);
    const dataB = appState.data.raw.filter(row => row.year == yearB);
    
    const gangwonDataA = dataA.filter(row => row.region === '강원도' || row.region === '강원');
    const gangwonDataB = dataB.filter(row => row.region === '강원도' || row.region === '강원');
    
    // 여러 가지 전국 표기 방식 지원
    const nationalDataA = dataA.filter(row => {
        const region = row.region;
        return region === '전국' || region === '전체' || region === 'national' || region === 'National' || region === '합계';
    });
    const nationalDataB = dataB.filter(row => {
        const region = row.region;
        return region === '전국' || region === '전체' || region === 'national' || region === 'National' || region === '합계';
    });
    
    // 작목군별 집계
    const gangwonGroupsA = aggregateByCropGroup(gangwonDataA, selectedMetric);
    const gangwonGroupsB = aggregateByCropGroup(gangwonDataB, selectedMetric);
    const nationalGroupsA = aggregateByCropGroup(nationalDataA, selectedMetric);
    const nationalGroupsB = aggregateByCropGroup(nationalDataB, selectedMetric);
    
    // 주요 작목군 (식량, 채소, 과수, 특용작물)
    const mainCropGroups = ['식량', '채소', '과수', '특약용작물'];
    const ratioDataA = [];
    const ratioDataB = [];
    const labels = [];
    
    mainCropGroups.forEach(cropGroup => {
        if (gangwonGroupsA[cropGroup] || gangwonGroupsB[cropGroup] || 
            nationalGroupsA[cropGroup] || nationalGroupsB[cropGroup]) {
            
            const gangwonA = gangwonGroupsA[cropGroup] || 0;
            const gangwonB = gangwonGroupsB[cropGroup] || 0;
            const nationalA = nationalGroupsA[cropGroup] || 0;
            const nationalB = nationalGroupsB[cropGroup] || 0;
            
            const ratioA = nationalA > 0 ? (gangwonA / nationalA * 100) : 0;
            const ratioB = nationalB > 0 ? (gangwonB / nationalB * 100) : 0;
            
            labels.push(cropGroup);
            ratioDataA.push(ratioA);
            ratioDataB.push(ratioB);
        }
    });
    
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: `${yearA}년 (A)`,
                    data: ratioDataA,
                    backgroundColor: 'rgba(100, 116, 139, 0.7)',
                    borderColor: 'rgba(100, 116, 139, 1)',
                    borderWidth: 2
                },
                {
                    label: `${yearB}년 (B)`,
                    data: ratioDataB,
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw.toFixed(1)}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '비중 (%)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
    
    appState.ui.charts.set('ratio-comparison-chart', chart);
}

// 각 작목군별 TOP5 작목 데이터 집계 함수 (비교연도 B 기준으로 순서 결정)
function getCropGroupTop5(dataA, dataB, cropGroup, metric = 'area') {
    // 비교연도(B) 데이터를 기준으로 강원 재배면적 순위 결정
    const cropDataB = {};
    
    dataB.forEach(row => {
        // 다양한 필드명 지원 (작목군, cropGroup, crop_group)
        const rowCropGroup = row.cropGroup || row['작목군'] || row.crop_group;
        const rowCropName = row.cropName || row['작목명'] || row.crop_name;
        
        if (rowCropGroup === cropGroup) {
            const cropName = rowCropName;
            if (!cropDataB[cropName]) {
                cropDataB[cropName] = 0;
            }
            cropDataB[cropName] += row[metric] || 0;
        }
    });
    
    // 비교연도(B)에서 상위 5개 작목 선별 (강원 재배면적 기준 내림차순)
    const top5Crops = Object.entries(cropDataB)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([crop]) => crop);
    
    // A년도와 B년도 데이터를 각각 계산
    const cropDataA = {};
    dataA.forEach(row => {
        const rowCropGroup = row.cropGroup || row['작목군'] || row.crop_group;
        const rowCropName = row.cropName || row['작목명'] || row.crop_name;
        
        if (rowCropGroup === cropGroup && top5Crops.includes(rowCropName)) {
            if (!cropDataA[rowCropName]) {
                cropDataA[rowCropName] = 0;
            }
            cropDataA[rowCropName] += row[metric] || 0;
        }
    });
    
    // 결과 반환 (B년도 순위 순서로)
    return {
        cropsA: top5Crops.map(crop => ({ crop, value: cropDataA[crop] || 0 })),
        cropsB: top5Crops.map(crop => ({ crop, value: cropDataB[crop] || 0 })),
        topCrops: top5Crops
    };
}

// 작목군별 카드 헤더 및 내용 업데이트 함수
function updateCropGroupCardHeaders() {
    const selectedMetric = document.getElementById('trend-metric')?.value || 'area';
    const metricText = selectedMetric === 'area' ? '재배면적' : '생산량';
    
    // 각 카드 헤더 업데이트 (순서: 작물 전체, 식량, 채소, 과수, 특약용작물)
    // 이제 모든 카드가 crop-group-card-wrapper 구조를 사용하므로 일관된 선택자 사용 가능
    const cardHeaders = [
        { selector: '.crop-group-card-wrapper:nth-child(1) .dashboard-card-header h3', text: `작물 ${metricText} 동향` },
        { selector: '.crop-group-card-wrapper:nth-child(2) .dashboard-card-header h3', text: `식량 ${metricText} 동향` },
        { selector: '.crop-group-card-wrapper:nth-child(3) .dashboard-card-header h3', text: `채소 ${metricText} 동향` },
        { selector: '.crop-group-card-wrapper:nth-child(4) .dashboard-card-header h3', text: `과수 ${metricText} 동향` },
        { selector: '.crop-group-card-wrapper:nth-child(5) .dashboard-card-header h3', text: `특약용작물 ${metricText} 동향` }
    ];
    
    cardHeaders.forEach(header => {
        const element = document.querySelector(header.selector);
        console.log(`🔍 선택자 확인: ${header.selector} -> 요소 발견: ${element ? 'YES' : 'NO'}`);
        if (element) {
            element.textContent = header.text;
            console.log(`✅ 업데이트 완료: ${header.text}`);
        } else {
            console.log(`❌ 요소를 찾을 수 없음: ${header.selector}`);
        }
    });
    
    console.log(`📝 카드 헤더가 ${metricText} 동향으로 업데이트됨`);
    
    // 차트 제목들도 업데이트
    updateAllChartTitles(selectedMetric);
    
    // 증감 분석 표 제목과 내용 업데이트
    updateCropChangeAnalysisTable(selectedMetric);
    
    // 카드 내부 테이블과 차트도 업데이트
    updateAllCropGroupCards();
}

// 모든 차트 제목을 선택된 측정항목에 따라 업데이트하는 함수
function updateAllChartTitles(selectedMetric) {
    const metricText = selectedMetric === 'area' ? '재배면적' : '생산량';
    
    // 작목군별 트렌드 차트 제목들
    const chartTitleUpdates = [
        { id: 'grain-trend-chart-title', text: `<i class="fas fa-chart-line"></i> 식량(계) ${metricText} 및 비중` },
        { id: 'grain-crops-chart-title', text: `<i class="fas fa-chart-bar"></i> 식량 작목별 비중` },
        { id: 'vegetable-trend-chart-title', text: `<i class="fas fa-chart-line"></i> 채소(계) ${metricText} 및 비중` },
        { id: 'vegetable-crops-chart-title', text: `<i class="fas fa-chart-bar"></i> 채소 작목별 비중` },
        { id: 'fruit-trend-chart-title', text: `<i class="fas fa-chart-line"></i> 과수(계) ${metricText} 및 비중` },
        { id: 'fruit-crops-chart-title', text: `<i class="fas fa-chart-bar"></i> 과수 작목별 비중` },
        { id: 'special-trend-chart-title', text: `<i class="fas fa-chart-line"></i> 특약용작물(계) ${metricText} 및 비중` },
        { id: 'special-crops-chart-title', text: `<i class="fas fa-chart-bar"></i> 특약용작물 작목별 비중` }
    ];
    
    chartTitleUpdates.forEach(titleUpdate => {
        const element = document.getElementById(titleUpdate.id);
        if (element) {
            element.innerHTML = titleUpdate.text;
            console.log(`📊 차트 제목 업데이트: ${titleUpdate.id} -> ${titleUpdate.text}`);
        }
    });
    
    console.log(`📊 모든 차트 제목이 ${metricText}로 업데이트됨`);
}

// 작목별 증감 분석 표 업데이트 함수 (재배동향 탭용)
function updateCultivationCropChangeAnalysisTable(selectedMetric) {
    const metricText = selectedMetric === 'area' ? '재배면적' : '생산량';
    const labelText = selectedMetric === 'area' ? '면적' : '구성비';
    
    // 카드 제목 업데이트  
    const cardTitleElement = document.getElementById('cultivation-card-title');
    if (cardTitleElement) {
        cardTitleElement.textContent = `전국 농산물 ${metricText} 동향`;
    }
    
    // 표 제목 업데이트
    const titleElement = document.getElementById('cultivation-change-analysis-title');
    if (titleElement) {
        titleElement.textContent = `작목별 ${metricText} 증감 분석`;
    }
    
    // 행 레이블 업데이트
    const increaseLabel = document.getElementById('cultivation-increase-label');
    const maintainLabel = document.getElementById('cultivation-maintain-label');
    const decreaseLabel = document.getElementById('cultivation-decrease-label');
    
    if (increaseLabel) increaseLabel.textContent = `${labelText}증가`;
    if (maintainLabel) maintainLabel.textContent = `${labelText}유지`;
    if (decreaseLabel) decreaseLabel.textContent = `${labelText}감소`;
    
    // 데이터 분석 및 표 업데이트
    const yearA = parseInt(document.getElementById('cultivation-year-a')?.value);
    const yearB = parseInt(document.getElementById('cultivation-year-b')?.value);
    
    if (!yearA || !yearB) {
        console.log('📊 재배동향 탭: 년도 정보가 없어 증감 분석 표를 업데이트할 수 없습니다');
        return;
    }
    
    analyzeCultivationCropChanges(yearA, yearB, selectedMetric);
}

// 재배동향 탭용 작목별 증감 분석 함수
function analyzeCultivationCropChanges(yearA, yearB, selectedMetric) {
    console.log(`📈 재배동향 탭 작목별 ${selectedMetric} 증감 분석 시작: ${yearA}년 vs ${yearB}년`);
    
    const dataA = appState.data.raw.filter(row => row.year === yearA && (row.region === '강원도' || row.region === '강원'));
    const dataB = appState.data.raw.filter(row => row.year === yearB && (row.region === '강원도' || row.region === '강원'));
    
    console.log(`📊 재배동향 분석 데이터: A년도=${dataA.length}건, B년도=${dataB.length}건`);
    
    // 작목군별 분석 결과 저장
    const analysisResults = {
        '식량': { increase: [], maintain: [], decrease: [] },
        '채소': { increase: [], maintain: [], decrease: [] },
        '과수': { increase: [], maintain: [], decrease: [] },
        '특약용작물': { increase: [], maintain: [], decrease: [] }
    };
    
    // 작목군별로 분석
    const cropGroups = ['식량', '채소', '과수', '특약용작물'];
    
    cropGroups.forEach(cropGroup => {
        const cropGroupDataA = dataA.filter(row => {
            const rowCropGroup = row.cropGroup || row['작목군'] || row.crop_group;
            return rowCropGroup === cropGroup;
        });
        
        const cropGroupDataB = dataB.filter(row => {
            const rowCropGroup = row.cropGroup || row['작목군'] || row.crop_group;
            return rowCropGroup === cropGroup;
        });
        
        // A년도와 B년도에 공통으로 존재하는 작목명들 찾기
        const cropsA = new Set(cropGroupDataA.map(row => row.cropName || row['작목명'] || row.crop_name).filter(name => name));
        const cropsB = new Set(cropGroupDataB.map(row => row.cropName || row['작목명'] || row.crop_name).filter(name => name));
        const commonCrops = [...cropsA].filter(crop => cropsB.has(crop));
        
        console.log(`🌾 재배동향 ${cropGroup} 공통 작목: ${commonCrops.length}개`);
        
        commonCrops.forEach(cropName => {
            const cropDataA = cropGroupDataA.find(row => (row.cropName || row['작목명'] || row.crop_name) === cropName);
            const cropDataB = cropGroupDataB.find(row => (row.cropName || row['작목명'] || row.crop_name) === cropName);
            
            if (cropDataA && cropDataB) {
                const valueA = parseFloat(cropDataA[selectedMetric] || cropDataA[selectedMetric === 'area' ? '재배면적' : '생산량'] || 0);
                const valueB = parseFloat(cropDataB[selectedMetric] || cropDataB[selectedMetric === 'area' ? '재배면적' : '생산량'] || 0);
                
                if (valueA > 0) { // 0으로 나누는 것 방지
                    const changeRate = ((valueB - valueA) / valueA) * 100;
                    
                    if (changeRate >= 5) {
                        analysisResults[cropGroup].increase.push(cropName);
                    } else if (changeRate <= -5) {
                        analysisResults[cropGroup].decrease.push(cropName);
                    } else {
                        analysisResults[cropGroup].maintain.push(cropName);
                    }
                }
            }
        });
    });
    
    // 표 업데이트
    updateCultivationCropChangeTable(analysisResults);
}

// 작목별 증감 분석 함수 (기존)
function analyzeCropChanges(yearA, yearB, selectedMetric) {
    console.log(`📈 작목별 ${selectedMetric} 증감 분석 시작: ${yearA}년 vs ${yearB}년`);
    
    const dataA = appState.data.raw.filter(row => row.year === yearA && (row.region === '강원도' || row.region === '강원'));
    const dataB = appState.data.raw.filter(row => row.year === yearB && (row.region === '강원도' || row.region === '강원'));
    
    console.log(`📊 분석 데이터: A년도=${dataA.length}건, B년도=${dataB.length}건`);
    
    // 작목군별 분석 결과 저장
    const analysisResults = {
        '식량': { increase: [], maintain: [], decrease: [] },
        '채소': { increase: [], maintain: [], decrease: [] },
        '과수': { increase: [], maintain: [], decrease: [] },
        '특약용작물': { increase: [], maintain: [], decrease: [] }
    };
    
    // 작목군별로 분석
    const cropGroups = ['식량', '채소', '과수', '특약용작물'];
    
    cropGroups.forEach(cropGroup => {
        const cropGroupDataA = dataA.filter(row => {
            const rowCropGroup = row.cropGroup || row['작목군'] || row.crop_group;
            return rowCropGroup === cropGroup;
        });
        
        const cropGroupDataB = dataB.filter(row => {
            const rowCropGroup = row.cropGroup || row['작목군'] || row.crop_group;
            return rowCropGroup === cropGroup;
        });
        
        // A년도와 B년도에 공통으로 존재하는 작목명들 찾기
        const cropsA = new Set(cropGroupDataA.map(row => row.cropName || row['작목명'] || row.crop_name).filter(name => name));
        const cropsB = new Set(cropGroupDataB.map(row => row.cropName || row['작목명'] || row.crop_name).filter(name => name));
        const commonCrops = [...cropsA].filter(crop => cropsB.has(crop));
        
        console.log(`🌾 ${cropGroup} 공통 작목: ${commonCrops.length}개`);
        
        commonCrops.forEach(cropName => {
            const cropDataA = cropGroupDataA.find(row => (row.cropName || row['작목명'] || row.crop_name) === cropName);
            const cropDataB = cropGroupDataB.find(row => (row.cropName || row['작목명'] || row.crop_name) === cropName);
            
            if (cropDataA && cropDataB) {
                const valueA = parseFloat(cropDataA[selectedMetric] || cropDataA[selectedMetric === 'area' ? '재배면적' : '생산량'] || 0);
                const valueB = parseFloat(cropDataB[selectedMetric] || cropDataB[selectedMetric === 'area' ? '재배면적' : '생산량'] || 0);
                
                if (valueA > 0) { // 0으로 나누는 것 방지
                    const changeRate = ((valueB - valueA) / valueA) * 100;
                    
                    if (changeRate >= 5) {
                        analysisResults[cropGroup].increase.push(cropName);
                    } else if (changeRate <= -5) {
                        analysisResults[cropGroup].decrease.push(cropName);
                    } else {
                        analysisResults[cropGroup].maintain.push(cropName);
                    }
                }
            }
        });
    });
    
    // 표 업데이트
    updateCropChangeTable(analysisResults);
}

// 재배동향 탭용 증감 분석 표 데이터 업데이트
function updateCultivationCropChangeTable(analysisResults) {
    console.log('📊 재배동향 탭 증감 분석 표 업데이트 중...', analysisResults);
    
    // 전체 집계
    let totalIncrease = 0, totalMaintain = 0, totalDecrease = 0;
    
    Object.keys(analysisResults).forEach(cropGroup => {
        const groupKey = cropGroup === '식량' ? 'grain' : 
                        cropGroup === '채소' ? 'vegetable' :
                        cropGroup === '과수' ? 'fruit' : 'special';
        
        // 증가
        const increaseCount = analysisResults[cropGroup].increase.length;
        const increaseCell = document.querySelector(`.cultivation-${groupKey}-increase`);
        if (increaseCell) {
            increaseCell.textContent = increaseCount > 0 ? 
                `${increaseCount}개: ${analysisResults[cropGroup].increase.slice(0, 3).join(', ')}${increaseCount > 3 ? ' 등' : ''}` : 
                '0개';
        }
        totalIncrease += increaseCount;
        
        // 유지
        const maintainCount = analysisResults[cropGroup].maintain.length;
        const maintainCell = document.querySelector(`.cultivation-${groupKey}-maintain`);
        if (maintainCell) {
            maintainCell.textContent = maintainCount > 0 ? 
                `${maintainCount}개: ${analysisResults[cropGroup].maintain.slice(0, 3).join(', ')}${maintainCount > 3 ? ' 등' : ''}` : 
                '0개';
        }
        totalMaintain += maintainCount;
        
        // 감소
        const decreaseCount = analysisResults[cropGroup].decrease.length;
        const decreaseCell = document.querySelector(`.cultivation-${groupKey}-decrease`);
        if (decreaseCell) {
            decreaseCell.textContent = decreaseCount > 0 ? 
                `${decreaseCount}개: ${analysisResults[cropGroup].decrease.slice(0, 3).join(', ')}${decreaseCount > 3 ? ' 등' : ''}` : 
                '0개';
        }
        totalDecrease += decreaseCount;
    });
    
    // 전체 집계 업데이트
    const totalIncreaseCell = document.querySelector('.cultivation-total-increase');
    const totalMaintainCell = document.querySelector('.cultivation-total-maintain');
    const totalDecreaseCell = document.querySelector('.cultivation-total-decrease');
    
    if (totalIncreaseCell) totalIncreaseCell.textContent = `${totalIncrease}개`;
    if (totalMaintainCell) totalMaintainCell.textContent = `${totalMaintain}개`;
    if (totalDecreaseCell) totalDecreaseCell.textContent = `${totalDecrease}개`;
    
    console.log(`📈 재배동향 증감 분석 완료: 증가=${totalIncrease}, 유지=${totalMaintain}, 감소=${totalDecrease}`);
}

// 재배동향 탭 컨트롤들 설정 함수
function setupCultivationControls() {
    console.log('🌱 재배동향 탭 컨트롤들 설정 시작');
    
    const cultivationYearA = document.getElementById('cultivation-year-a');
    const cultivationYearB = document.getElementById('cultivation-year-b');
    const cultivationTrendMetric = document.getElementById('cultivation-trend-metric');
    
    // 년도 선택기에 옵션 추가
    if (cultivationYearA && cultivationYearB && appState.data.processed.years) {
        // DB에서 연도 배열 가져오기 (정렬된 상태)
        const availableYears = [...appState.data.processed.years].sort((a, b) => a - b);
        
        console.log('📅 재배동향 탭 사용 가능한 연도:', availableYears);
        
        if (availableYears.length === 0) {
            console.error('❌ 재배동향 탭: 사용 가능한 연도가 없음');
            return;
        }
        
        // 기존 옵션 제거
        cultivationYearA.innerHTML = '';
        cultivationYearB.innerHTML = '';
        
        // 최소, 최대값 계산
        const minYear = Math.min(...availableYears);
        const maxYear = Math.max(...availableYears);
        
        // 옵션 추가 - 작목군별 TOP5 탭과 동일한 방식
        availableYears.forEach(year => {
            const optionA = new Option(`${year}년`, year);
            if (year === minYear) optionA.selected = true; // 최소값을 기본 선택
            cultivationYearA.add(optionA);
            
            const optionB = new Option(`${year}년`, year);
            if (year === maxYear) optionB.selected = true; // 최대값을 기본 선택
            cultivationYearB.add(optionB);
        });
        
        // 명시적으로 초기값 설정 (브라우저 호환성을 위해)
        cultivationYearA.value = minYear;
        cultivationYearB.value = maxYear;
        
        console.log(`재배동향 탭 연도 선택기 초기화 완료: A=${minYear}년, B=${maxYear}년`);
    }
    
    // 이벤트 리스너 추가
    if (cultivationYearA) {
        cultivationYearA.addEventListener('change', handleCultivationChange);
    }
    
    if (cultivationYearB) {
        cultivationYearB.addEventListener('change', handleCultivationChange);
    }
    
    if (cultivationTrendMetric) {
        cultivationTrendMetric.addEventListener('change', handleCultivationChange);
    }
    
    // 각 카드별 면적 필터 슬라이더 설정
    setupCardAreaFilterSliders();
    
    // 초기 업데이트
    setTimeout(() => {
        handleCultivationChange();
    }, 500);
    
    console.log('🌱 재배동향 탭 컨트롤들 설정 완료');
}

// 재배동향 탭 변경 핸들러
function handleCultivationChange() {
    const selectedMetric = document.getElementById('cultivation-trend-metric')?.value || 'area';
    
    console.log('🌱 재배동향 탭 업데이트 시작:', selectedMetric);
    
    // 증감 분석 표 업데이트
    updateCultivationCropChangeAnalysisTable(selectedMetric);
    
    console.log('🌱 재배동향 탭 업데이트 완료');
}

// 증감 분석 표 데이터 업데이트 (기존)
function updateCropChangeTable(analysisResults) {
    console.log('📊 증감 분석 표 업데이트 중...', analysisResults);
    
    // 전체 집계
    let totalIncrease = 0, totalMaintain = 0, totalDecrease = 0;
    
    Object.keys(analysisResults).forEach(cropGroup => {
        const groupKey = cropGroup === '식량' ? 'grain' : 
                        cropGroup === '채소' ? 'vegetable' :
                        cropGroup === '과수' ? 'fruit' : 'special';
        
        // 증가
        const increaseCount = analysisResults[cropGroup].increase.length;
        const increaseCell = document.querySelector(`.${groupKey}-increase`);
        if (increaseCell) {
            increaseCell.textContent = increaseCount > 0 ? 
                `${increaseCount}개: ${analysisResults[cropGroup].increase.slice(0, 3).join(', ')}${increaseCount > 3 ? ' 등' : ''}` : 
                '0개';
        }
        totalIncrease += increaseCount;
        
        // 유지
        const maintainCount = analysisResults[cropGroup].maintain.length;
        const maintainCell = document.querySelector(`.${groupKey}-maintain`);
        if (maintainCell) {
            maintainCell.textContent = maintainCount > 0 ? 
                `${maintainCount}개: ${analysisResults[cropGroup].maintain.slice(0, 3).join(', ')}${maintainCount > 3 ? ' 등' : ''}` : 
                '0개';
        }
        totalMaintain += maintainCount;
        
        // 감소
        const decreaseCount = analysisResults[cropGroup].decrease.length;
        const decreaseCell = document.querySelector(`.${groupKey}-decrease`);
        if (decreaseCell) {
            decreaseCell.textContent = decreaseCount > 0 ? 
                `${decreaseCount}개: ${analysisResults[cropGroup].decrease.slice(0, 3).join(', ')}${decreaseCount > 3 ? ' 등' : ''}` : 
                '0개';
        }
        totalDecrease += decreaseCount;
    });
    
    // 전체 집계 업데이트
    const totalIncreaseCell = document.querySelector('.total-increase');
    const totalMaintainCell = document.querySelector('.total-maintain');
    const totalDecreaseCell = document.querySelector('.total-decrease');
    
    if (totalIncreaseCell) totalIncreaseCell.textContent = `${totalIncrease}개`;
    if (totalMaintainCell) totalMaintainCell.textContent = `${totalMaintain}개`;
    if (totalDecreaseCell) totalDecreaseCell.textContent = `${totalDecrease}개`;
    
    console.log(`📈 증감 분석 완료: 증가=${totalIncrease}, 유지=${totalMaintain}, 감소=${totalDecrease}`);
}

// 모든 작목군별 카드의 테이블과 차트 업데이트 함수
function updateAllCropGroupCards() {
    console.log('🔄 모든 작목군별 카드 업데이트 시작');
    
    const cropGroups = [
        { name: '식량', tableId: 'grain-comparison-table', yearHeaderAId: 'grain-year-a-header', yearHeaderBId: 'grain-year-b-header', trendChartId: 'grain-trend-chart', cropsChartId: 'grain-crops-chart' },
        { name: '채소', tableId: 'vegetable-comparison-table', yearHeaderAId: 'vegetable-year-a-header', yearHeaderBId: 'vegetable-year-b-header', trendChartId: 'vegetable-trend-chart', cropsChartId: 'vegetable-crops-chart' },
        { name: '과수', tableId: 'fruit-comparison-table', yearHeaderAId: 'fruit-year-a-header', yearHeaderBId: 'fruit-year-b-header', trendChartId: 'fruit-trend-chart', cropsChartId: 'fruit-crops-chart' },
        { name: '특약용작물', tableId: 'special-comparison-table', yearHeaderAId: 'special-year-a-header', yearHeaderBId: 'special-year-b-header', trendChartId: 'special-trend-chart', cropsChartId: 'special-crops-chart' }
    ];
    
    cropGroups.forEach(async (cropGroup) => {
        try {
            console.log(`🔄 ${cropGroup.name} 카드 업데이트 중...`);
            
            // 테이블 업데이트
            updateCropGroupTable(cropGroup.name, cropGroup.tableId, cropGroup.yearHeaderAId, cropGroup.yearHeaderBId);
            
            // 차트 업데이트 (약간의 지연을 두어 순차 실행)
            setTimeout(async () => {
                await renderCropGroupTrendChart(cropGroup.name, cropGroup.trendChartId, cropGroup.trendChartId);
                await renderCropGroupTop5Chart(cropGroup.name, cropGroup.cropsChartId, cropGroup.cropsChartId);
            }, 100);
            
            console.log(`✅ ${cropGroup.name} 카드 업데이트 완료`);
        } catch (error) {
            console.error(`❌ ${cropGroup.name} 카드 업데이트 실패:`, error);
        }
    });
    
    console.log('🔄 모든 작목군별 카드 업데이트 완료');
}

// 지정된 작목 리스트로 데이터 추출 함수 (강원 TOP5 작목으로 전국 데이터 추출)
function getCropDataByTopCrops(dataA, dataB, cropGroup, metric = 'area', topCrops) {
    console.log(`🔍 전국 데이터에서 강원 TOP5 작목 추출: ${topCrops.join(', ')}`);
    
    // A년도 데이터 계산
    const cropDataA = {};
    dataA.forEach(row => {
        const rowCropGroup = row.cropGroup || row['작목군'] || row.crop_group;
        const rowCropName = row.cropName || row['작목명'] || row.crop_name;
        
        if (rowCropGroup === cropGroup && topCrops.includes(rowCropName)) {
            if (!cropDataA[rowCropName]) {
                cropDataA[rowCropName] = 0;
            }
            cropDataA[rowCropName] += row[metric] || 0;
        }
    });
    
    // B년도 데이터 계산
    const cropDataB = {};
    dataB.forEach(row => {
        const rowCropGroup = row.cropGroup || row['작목군'] || row.crop_group;
        const rowCropName = row.cropName || row['작목명'] || row.crop_name;
        
        if (rowCropGroup === cropGroup && topCrops.includes(rowCropName)) {
            if (!cropDataB[rowCropName]) {
                cropDataB[rowCropName] = 0;
            }
            cropDataB[rowCropName] += row[metric] || 0;
        }
    });
    
    console.log(`🗺️ 전국 A년도 작목별 데이터:`, cropDataA);
    console.log(`🗺️ 전국 B년도 작목별 데이터:`, cropDataB);
    
    // 결과 반환 (강원과 동일한 작목 순서 유지)
    return {
        cropsA: topCrops.map(crop => ({ crop, value: cropDataA[crop] || 0 })),
        cropsB: topCrops.map(crop => ({ crop, value: cropDataB[crop] || 0 })),
        topCrops: topCrops
    };
}

// 작목군별 계 데이터 계산 함수
function getCropGroupTotal(data, cropGroup, metric = 'area') {
    const filteredData = data.filter(row => {
        const rowCropGroup = row.cropGroup || row['작목군'] || row.crop_group;
        return rowCropGroup === cropGroup;
    });
    
    console.log(`📊 getCropGroupTotal: ${cropGroup}, ${metric}, 필터된 데이터 개수: ${filteredData.length}`);
    
    if (filteredData.length > 0 && metric === 'production') {
        const sample = filteredData[0];
        console.log(`📋 ${metric} 필드 확인:`, {
            production: sample.production,
            생산량: sample['생산량'],
            area: sample.area,
            재배면적: sample['재배면적']
        });
    }
    
    const result = filteredData.reduce((sum, row) => {
        const value = row[metric] || row[metric === 'area' ? '재배면적' : '생산량'] || 0;
        return sum + (parseFloat(value) || 0);
    }, 0);
    
    console.log(`📊 ${cropGroup} ${metric} 총합: ${result}`);
    return result;
}

// 작목군별 테이블 업데이트 함수
function updateCropGroupTable(cropGroup, tableId, yearHeaderAId, yearHeaderBId) {
    console.log(`🔧 ${cropGroup} 테이블 업데이트 시작`);
    
    const yearA = parseInt(document.getElementById('year-a')?.value);
    const yearB = parseInt(document.getElementById('year-b')?.value);
    const selectedMetric = document.getElementById('trend-metric')?.value || 'area';
    
    console.log(`📅 연도 설정: A=${yearA}, B=${yearB}, 메트릭=${selectedMetric}`);
    
    if (!yearA || !yearB) {
        console.warn(`⚠️ ${cropGroup} 테이블: 연도 값이 없습니다`);
        return;
    }
    
    // 연도별 데이터 필터링
    const dataA = appState.data.raw.filter(row => row.year == yearA);
    const dataB = appState.data.raw.filter(row => row.year == yearB);
    
    console.log(`📊 ${cropGroup} 연도별 데이터: A=${dataA.length}개, B=${dataB.length}개`);
    
    const gangwonDataA = dataA.filter(row => row.region === '강원도' || row.region === '강원');
    const gangwonDataB = dataB.filter(row => row.region === '강원도' || row.region === '강원');
    
    // 여러 가지 전국 표기 방식 지원 (차트와 동일)
    const nationalDataA = dataA.filter(row => {
        const region = row.region;
        return region === '전국' || region === '전체' || region === 'national' || region === 'National' || region === '합계';
    });
    const nationalDataB = dataB.filter(row => {
        const region = row.region;
        return region === '전국' || region === '전체' || region === 'national' || region === 'National' || region === '합계';
    });
    
    console.log(`🗺️ ${cropGroup} 지역별 데이터: 강원A=${gangwonDataA.length}, 강원B=${gangwonDataB.length}, 전국A=${nationalDataA.length}, 전국B=${nationalDataB.length}`);
    
    // 해당 작목군 데이터 확인
    const cropGroupDataA = gangwonDataA.filter(row => {
        const rowCropGroup = row.cropGroup || row['작목군'] || row.crop_group;
        return rowCropGroup === cropGroup;
    });
    const cropGroupDataB = gangwonDataB.filter(row => {
        const rowCropGroup = row.cropGroup || row['작목군'] || row.crop_group;
        return rowCropGroup === cropGroup;
    });
    
    console.log(`🌾 ${cropGroup} 작목군 데이터: A년도=${cropGroupDataA.length}개, B년도=${cropGroupDataB.length}개`);
    
    if (cropGroupDataA.length === 0 && cropGroupDataB.length === 0) {
        console.warn(`⚠️ ${cropGroup} 작목군 데이터가 없습니다`);
        
        // 첫 번째 데이터 샘플 확인
        if (appState.data.raw.length > 0) {
            const sample = appState.data.raw[0];
            console.log('📋 데이터 샘플 구조:', Object.keys(sample));
            console.log('📋 사용 가능한 작목군들 (cropGroup):', [...new Set(appState.data.raw.map(row => row.cropGroup))]);
            console.log('📋 사용 가능한 작목군들 (작목군):', [...new Set(appState.data.raw.map(row => row['작목군']))]);
            console.log('📋 사용 가능한 작목군들 (crop_group):', [...new Set(appState.data.raw.map(row => row.crop_group))]);
        }
    }
    
    // 작목군 계 데이터 계산
    const gangwonTotalA = getCropGroupTotal(gangwonDataA, cropGroup, selectedMetric);
    const gangwonTotalB = getCropGroupTotal(gangwonDataB, cropGroup, selectedMetric);
    const nationalTotalA = getCropGroupTotal(nationalDataA, cropGroup, selectedMetric);
    const nationalTotalB = getCropGroupTotal(nationalDataB, cropGroup, selectedMetric);
    
    console.log(`🔢 ${cropGroup} ${selectedMetric} 계산 결과:`);
    console.log(`   강원 A년도(${yearA}): ${gangwonTotalA}`);
    console.log(`   강원 B년도(${yearB}): ${gangwonTotalB}`);
    console.log(`   전국 A년도(${yearA}): ${nationalTotalA}`);
    console.log(`   전국 B년도(${yearB}): ${nationalTotalB}`);
    
    // 비중 계산
    const ratioA = nationalTotalA > 0 ? (gangwonTotalA / nationalTotalA * 100) : 0;
    const ratioB = nationalTotalB > 0 ? (gangwonTotalB / nationalTotalB * 100) : 0;
    
    // 증감률 계산
    const nationalChangeRate = nationalTotalA > 0 ? ((nationalTotalB - nationalTotalA) / nationalTotalA * 100) : 0;
    const gangwonChangeRate = gangwonTotalA > 0 ? ((gangwonTotalB - gangwonTotalA) / gangwonTotalA * 100) : 0;
    const ratioChange = ratioB - ratioA;
    
    console.log(`📊 ${cropGroup} 테이블 업데이트 값들:`);
    console.log(`   비중 A: ${ratioA.toFixed(2)}%, 비중 B: ${ratioB.toFixed(2)}%`);
    console.log(`   전국 증감률: ${nationalChangeRate.toFixed(2)}%, 강원 증감률: ${gangwonChangeRate.toFixed(2)}%`);
    console.log(`   비중 변화: ${ratioChange.toFixed(2)}%`);
    
    // 테이블 업데이트
    const table = document.getElementById(tableId);
    if (!table) return;
    
    // 헤더 업데이트 (null 체크 추가)
    const yearHeaderA = document.getElementById(yearHeaderAId);
    const yearHeaderB = document.getElementById(yearHeaderBId);
    
    if (yearHeaderA) {
        yearHeaderA.textContent = `${yearA}년 (A)`;
    } else {
        console.warn(`⚠️ 연도 헤더 A 요소를 찾을 수 없음: ${yearHeaderAId}`);
    }
    
    if (yearHeaderB) {
        yearHeaderB.textContent = `${yearB}년 (B)`;
    } else {
        console.warn(`⚠️ 연도 헤더 B 요소를 찾을 수 없음: ${yearHeaderBId}`);
    }
    
    // 계 행 업데이트
    const totalRow = table.querySelector('.total-row');
    console.log(`🔍 ${cropGroup} 테이블 총계 행 찾기:`, totalRow ? '찾음' : '없음');
    
    if (totalRow) {
        const cells = totalRow.querySelectorAll('td');
        console.log(`🔍 ${cropGroup} 총계 행 셀 개수: ${cells.length}`);
        
        if (cells.length >= 9) {
            console.log(`✍️ ${cropGroup} 테이블 셀 업데이트 중...`);
            
            // 값을 업데이트하기 전에 포맷팅된 값들 확인
            const formattedValues = {
                nationalA: formatNumber(nationalTotalA),
                gangwonA: formatNumber(gangwonTotalA), 
                ratioA: formatPercent(ratioA),
                nationalB: formatNumber(nationalTotalB),
                gangwonB: formatNumber(gangwonTotalB),
                ratioB: formatPercent(ratioB),
                nationalChangeRate: formatChangeRate(nationalChangeRate),
                gangwonChangeRate: formatChangeRate(gangwonChangeRate),
                ratioChange: formatChangeValue(ratioChange)
            };
            
            console.log(`📊 ${cropGroup} 포맷팅된 값들:`, formattedValues);
            
            cells[1].textContent = formattedValues.nationalA;
            cells[2].textContent = formattedValues.gangwonA;
            cells[3].textContent = formattedValues.ratioA;
            cells[4].textContent = formattedValues.nationalB;
            cells[5].textContent = formattedValues.gangwonB;
            cells[6].textContent = formattedValues.ratioB;
            cells[7].textContent = formattedValues.nationalChangeRate;
            cells[7].className = getChangeRateClass(nationalChangeRate);
            cells[8].textContent = formattedValues.gangwonChangeRate;
            cells[8].className = getChangeRateClass(gangwonChangeRate);
            cells[9].textContent = formattedValues.ratioChange;
            cells[9].className = getChangeRateClass(ratioChange);
            
            console.log(`✅ ${cropGroup} 테이블 셀 업데이트 완료`);
        } else {
            console.warn(`⚠️ ${cropGroup} 테이블 셀 개수 부족: ${cells.length} < 9`);
        }
    } else {
        console.warn(`⚠️ ${cropGroup} 테이블에서 .total-row를 찾을 수 없음`);
        console.log('테이블 구조:', table.innerHTML);
    }
    
    // TOP5 작목 데이터 가져오기 (비교연도 B 기준으로 순서 결정)
    // 1. 강원 기준으로 TOP5 작목 선별
    const gangwonTop5Data = getCropGroupTop5(gangwonDataA, gangwonDataB, cropGroup, selectedMetric);
    // 2. 전국 데이터는 강원 TOP5 작목 리스트와 동일한 작목들만 사용
    const nationalTop5Data = getCropDataByTopCrops(nationalDataA, nationalDataB, cropGroup, selectedMetric, gangwonTop5Data.topCrops);
    
    console.log(`📋 ${cropGroup} 테이블 TOP5 작목:`, gangwonTop5Data.topCrops);
    console.log(`📋 ${cropGroup} 테이블 강원 데이터:`, gangwonTop5Data);
    console.log(`📋 ${cropGroup} 테이블 전국 데이터:`, nationalTop5Data);
    
    // 기존 작목 행들 제거
    const tbody = table.querySelector('tbody');
    const existingRows = tbody.querySelectorAll('tr:not(.total-row)');
    existingRows.forEach(row => row.remove());
    
    // TOP5 작목별 행 생성 (B년도 강원 재배면적 순으로)
    gangwonTop5Data.topCrops.forEach(cropName => {
        const cropGangwonA = gangwonTop5Data.cropsA.find(c => c.crop === cropName)?.value || 0;
        const cropGangwonB = gangwonTop5Data.cropsB.find(c => c.crop === cropName)?.value || 0;
        
        // 전국 데이터 (같은 작목에 대해)
        const cropNationalA = nationalTop5Data.cropsA.find(c => c.crop === cropName)?.value || 0;
        const cropNationalB = nationalTop5Data.cropsB.find(c => c.crop === cropName)?.value || 0;
        
        // 비중 계산
        const cropRatioA = cropNationalA > 0 ? (cropGangwonA / cropNationalA * 100) : 0;
        const cropRatioB = cropNationalB > 0 ? (cropGangwonB / cropNationalB * 100) : 0;
        
        // 증감률 계산
        const cropNationalChangeRate = cropNationalA > 0 ? ((cropNationalB - cropNationalA) / cropNationalA * 100) : 0;
        const cropGangwonChangeRate = cropGangwonA > 0 ? ((cropGangwonB - cropGangwonA) / cropGangwonA * 100) : 0;
        const cropRatioChange = cropRatioB - cropRatioA;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${cropName}</strong></td>
            <td class="number">${formatNumber(cropNationalA)}</td>
            <td class="number">${formatNumber(cropGangwonA)}</td>
            <td class="percent">${formatPercent(cropRatioA)}</td>
            <td class="number">${formatNumber(cropNationalB)}</td>
            <td class="number">${formatNumber(cropGangwonB)}</td>
            <td class="percent">${formatPercent(cropRatioB)}</td>
            <td class="${getChangeRateClass(cropNationalChangeRate)}">${formatChangeRate(cropNationalChangeRate)}</td>
            <td class="${getChangeRateClass(cropGangwonChangeRate)}">${formatChangeRate(cropGangwonChangeRate)}</td>
            <td class="${getChangeRateClass(cropRatioChange)}">${formatChangeValue(cropRatioChange)}</td>
        `;
        tbody.appendChild(row);
    });
}

// 작목군별 시계열 차트 렌더링 함수
async function renderCropGroupTrendChart(cropGroup, canvasId, chartKey) {
    console.log(`📈 ${cropGroup} 트렌드 차트 렌더링 시작`);
    
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) {
        console.error(`❌ ${cropGroup} 트렌드 차트: 캔버스 요소를 찾을 수 없음 (${canvasId})`);
        return;
    }
    
    // 기존 차트 제거
    if (appState.ui.charts.has(chartKey)) {
        appState.ui.charts.get(chartKey).destroy();
    }
    
    const yearA = parseInt(document.getElementById('year-a')?.value);
    const yearB = parseInt(document.getElementById('year-b')?.value);
    const selectedMetric = document.getElementById('trend-metric')?.value || 'area';
    
    if (!yearA || !yearB) return;
    
    // A <= B 범위의 연도들만 필터링
    const allYears = appState.data.processed.years.sort((a, b) => a - b);
    const years = allYears.filter(year => year >= yearA && year <= yearB);
    
    if (years.length === 0) return;
    
    // 연도별 작목군 데이터 계산
    const gangwonData = [];
    const ratioData = [];
    
    years.forEach(year => {
        const yearData = appState.data.raw.filter(row => row.year === year);
        const gangwonYearData = yearData.filter(row => row.region === '강원도' || row.region === '강원');
        // 여러 가지 전국 표기 방식 지원
        const nationalYearData = yearData.filter(row => {
            const region = row.region;
            return region === '전국' || region === '전체' || region === 'national' || region === 'National' || region === '합계';
        });
        
        const gangwonTotal = getCropGroupTotal(gangwonYearData, cropGroup, selectedMetric);
        const nationalTotal = getCropGroupTotal(nationalYearData, cropGroup, selectedMetric);
        
        gangwonData.push(gangwonTotal);
        ratioData.push(nationalTotal > 0 ? (gangwonTotal / nationalTotal * 100) : 0);
    });
    
    const metricNames = {
        area: '재배면적',
        production: '생산량'
    };
    
    const metricUnits = {
        area: 'ha',
        production: '톤'
    };
    
    try {
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: years.map(y => y + '년'),
                datasets: [
                    {
                        label: `강원 ${cropGroup} ${metricNames[selectedMetric]} (${metricUnits[selectedMetric]})`,
                        type: 'bar',
                        data: gangwonData,
                        backgroundColor: 'rgba(100, 116, 139, 0.7)',
                        borderColor: 'rgba(100, 116, 139, 1)',
                        borderWidth: 2,
                        yAxisID: 'y'
                    },
                    {
                        label: `${cropGroup} 비중 (%)`,
                        type: 'line',
                        data: ratioData,
                        backgroundColor: 'rgba(20, 184, 166, 0.2)',
                        borderColor: 'rgba(20, 184, 166, 1)',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.4,
                        pointBackgroundColor: 'rgba(20, 184, 166, 1)',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 6,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        callbacks: {
                            label: function(context) {
                                if (context.datasetIndex === 0) {
                                    return `${context.dataset.label}: ${context.raw.toLocaleString()}${metricUnits[selectedMetric]}`;
                                } else {
                                    return `${context.dataset.label}: ${context.raw.toFixed(1)}%`;
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: `${metricNames[selectedMetric]} (${metricUnits[selectedMetric]})`
                        },
                        beginAtZero: true,
                        max: gangwonData.length > 0 ? Math.max(...gangwonData) * 1.5 : 1000,
                        ticks: {
                            callback: function(value, index, values) {
                                let roundedValue;
                                if (value >= 100000) {
                                    roundedValue = Math.round(value / 10000) * 10000;
                                } else if (value >= 10000) {
                                    roundedValue = Math.round(value / 1000) * 1000;
                                } else if (value >= 1000) {
                                    roundedValue = Math.round(value / 100) * 100;
                                } else {
                                    roundedValue = Math.round(value / 10) * 10;
                                }
                                return roundedValue.toLocaleString();
                            }
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: '비중 (%)'
                        },
                        beginAtZero: true,
                        max: ratioData.length > 0 ? Math.max(...ratioData) * 1.3 : 8,
                        ticks: {
                            callback: function(value, index, values) {
                                if (value >= 10) {
                                    return Math.round(value);
                                } else {
                                    return Math.round(value * 2) / 2;
                                }
                            }
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                }
            }
        });
        
        appState.ui.charts.set(chartKey, chart);
        
    } catch (error) {
        console.error(`❌ ${chartKey} 생성 중 오류:`, error);
    }
}

// 작목군별 TOP5 작목 차트 렌더링 함수
async function renderCropGroupTop5Chart(cropGroup, canvasId, chartKey) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    
    // 기존 차트 제거
    if (appState.ui.charts.has(chartKey)) {
        appState.ui.charts.get(chartKey).destroy();
    }
    
    const yearA = parseInt(document.getElementById('year-a')?.value);
    const yearB = parseInt(document.getElementById('year-b')?.value);
    const selectedMetric = document.getElementById('trend-metric')?.value || 'area';
    
    if (!yearA || !yearB) return;
    
    const dataA = appState.data.raw.filter(row => row.year == yearA);
    const dataB = appState.data.raw.filter(row => row.year == yearB);
    
    const gangwonDataA = dataA.filter(row => row.region === '강원도' || row.region === '강원');
    const gangwonDataB = dataB.filter(row => row.region === '강원도' || row.region === '강원');
    
    // 전국 데이터 필터링 - 상세 디버깅
    console.log(`🔍 ${cropGroup} 전국 데이터 필터링 전 확인:`);
    console.log(`📈 전체 데이터 개수: A=${dataA.length}, B=${dataB.length}`);
    
    // 모든 지역명과 작목군 확인
    const allRegions = [...new Set(dataA.concat(dataB).map(row => row.region))];
    const allCropGroups = [...new Set(dataA.concat(dataB).map(row => row.cropGroup || row['작목군'] || row.crop_group))];
    
    console.log('🗺️ 사용 가능한 지역들:', allRegions);
    console.log('🌾 사용 가능한 작목군들:', allCropGroups);
    
    // 해당 작목군 데이터만 필터링해서 확인
    const cropGroupDataA = dataA.filter(row => {
        const rowCropGroup = row.cropGroup || row['작목군'] || row.crop_group;
        return rowCropGroup === cropGroup;
    });
    const cropGroupDataB = dataB.filter(row => {
        const rowCropGroup = row.cropGroup || row['작목군'] || row.crop_group;
        return rowCropGroup === cropGroup;
    });
    
    console.log(`🌾 ${cropGroup} 작목군 전체 데이터: A=${cropGroupDataA.length}, B=${cropGroupDataB.length}`);
    
    if (cropGroupDataA.length > 0) {
        console.log(`🌾 ${cropGroup} A년도 지역들:`, [...new Set(cropGroupDataA.map(row => row.region))]);
    }
    if (cropGroupDataB.length > 0) {
        console.log(`🌾 ${cropGroup} B년도 지역들:`, [...new Set(cropGroupDataB.map(row => row.region))]);
    }
    
    // 여러 가지 전국 표기 방식 지원
    const nationalDataA = cropGroupDataA.filter(row => {
        const region = row.region;
        return region === '전국' || region === '전체' || region === 'national' || region === 'National' || region === '합계';
    });
    const nationalDataB = cropGroupDataB.filter(row => {
        const region = row.region;
        return region === '전국' || region === '전체' || region === 'national' || region === 'National' || region === '합계';
    });
    
    console.log(`🗺️ ${cropGroup} 전국 데이터 개수: A=${nationalDataA.length}, B=${nationalDataB.length}`);
    
    // 전국 데이터가 없으면 샘플 확인
    if (nationalDataA.length === 0 && nationalDataB.length === 0) {
        console.log(`⚠️ ${cropGroup} 전국 데이터가 없습니다.`);
        if (cropGroupDataA.length > 0) {
            console.log(`${cropGroup} A년도 첫 번째 샘플:`, cropGroupDataA[0]);
        }
        if (cropGroupDataB.length > 0) {
            console.log(`${cropGroup} B년도 첫 번째 샘플:`, cropGroupDataB[0]);
        }
    }
    
    // 작목군별 TOP5 작목 데이터 (비교연도 B 기준으로 순서 결정)
    // 1. 강원 기준으로 TOP5 작목 선별
    const gangwonTop5Data = getCropGroupTop5(gangwonDataA, gangwonDataB, cropGroup, selectedMetric);
    
    // 2. 전국 데이터는 강원 TOP5 작목 리스트와 동일한 작목들만 사용
    const nationalTop5Data = getCropDataByTopCrops(nationalDataA, nationalDataB, cropGroup, selectedMetric, gangwonTop5Data.topCrops);
    
    console.log(`🌾 ${cropGroup} TOP5 작목 (B년도 강원 재배면적 순):`, gangwonTop5Data.topCrops);
    console.log(`📊 ${cropGroup} 강원 데이터:`, gangwonTop5Data);
    console.log(`🗺️ ${cropGroup} 전국 데이터:`, nationalTop5Data);
    
    // 비교연도 B 기준 강원 재배면적 순으로 라벨 설정
    const labels = gangwonTop5Data.topCrops;
    
    const ratioDataA = [];
    const ratioDataB = [];
    
    labels.forEach(cropName => {
        const cropGangwonA = gangwonTop5Data.cropsA.find(c => c.crop === cropName)?.value || 0;
        const cropGangwonB = gangwonTop5Data.cropsB.find(c => c.crop === cropName)?.value || 0;
        
        const cropNationalA = nationalTop5Data.cropsA.find(c => c.crop === cropName)?.value || 0;
        const cropNationalB = nationalTop5Data.cropsB.find(c => c.crop === cropName)?.value || 0;
        
        // 비중 계산 (전국 대비 강원 비중)
        const ratioA = cropNationalA > 0 ? (cropGangwonA / cropNationalA * 100) : 0;
        const ratioB = cropNationalB > 0 ? (cropGangwonB / cropNationalB * 100) : 0;
        
        ratioDataA.push(ratioA);
        ratioDataB.push(ratioB);
    });
    
    try {
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: `${yearA}년 (A)`,
                        data: ratioDataA,
                        backgroundColor: 'rgba(100, 116, 139, 0.7)',
                        borderColor: 'rgba(100, 116, 139, 1)',
                        borderWidth: 2
                    },
                    {
                        label: `${yearB}년 (B)`,
                        data: ratioDataB,
                        backgroundColor: 'rgba(16, 185, 129, 0.7)',
                        borderColor: 'rgba(16, 185, 129, 1)',
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.raw.toFixed(1)}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 0
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '전국대비 강원 비중 (%)'
                        },
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
        
        appState.ui.charts.set(chartKey, chart);
        
    } catch (error) {
        console.error(`❌ ${chartKey} 생성 중 오류:`, error);
    }
}

// 유틸리티 함수들
function formatNumber(value) {
    return value ? Math.round(value).toLocaleString() : '-';
}

function formatPercent(value) {
    return value ? `${value.toFixed(1)}%` : '-';
}

function formatChangeRate(value) {
    if (value === 0) return '0.0%';
    return value > 0 ? `+${value.toFixed(1)}%` : `${value.toFixed(1)}%`;
}

function formatChangeValue(value) {
    if (value === 0) return '0.0%';
    return value > 0 ? `+${value.toFixed(1)}%` : `${value.toFixed(1)}%`;
}

function getChangeRateClass(value) {
    const baseClass = 'change-rate';
    if (value > 0) return `${baseClass} positive`;
    if (value < 0) return `${baseClass} negative`;
    return baseClass;
}

// 통합 필터 변경 핸들러
async function handleFilterChange() {
    await updateKPICards();
    await renderMainChart();
    await renderTop5Chart();
    await renderComparisonCharts();
    // 연도 선택기에서 값 가져오기
    const yearA = parseInt(document.getElementById('year-a')?.value);
    const yearB = parseInt(document.getElementById('year-b')?.value);
    if (yearA && yearB) {
        await updateComparisonTable(yearA, yearB);
    }
    await renderCropGroupCards();
}

// KPI 카드 업데이트 (모든 필터 적용)
async function updateKPICards() {
    const selectedRegion = document.getElementById('region-dropdown')?.value;
    const selectedCropGroup = document.getElementById('crop-group-dropdown')?.value || 'all';
    const selectedYear = document.getElementById('year-dropdown')?.value;
    
    let targetData = appState.data.raw;
    
    if (selectedRegion) {
        targetData = targetData.filter(row => row.region === selectedRegion);
    }
    if (selectedCropGroup !== 'all') {
        targetData = targetData.filter(row => row.cropGroup === selectedCropGroup);
    }
    if (selectedYear) {
        targetData = targetData.filter(row => row.year === selectedYear);
    }
    
    const totalArea = targetData.reduce((sum, row) => sum + (row.area || 0), 0);
    const totalProduction = targetData.reduce((sum, row) => sum + (row.production || 0), 0);
    const cropCount = new Set(targetData.map(row => row.cropName)).size;
    
    // 애니메이션과 함께 값 업데이트
    animateNumber('total-area', 0, totalArea, 1500, (n) => Math.round(n).toLocaleString());
    animateNumber('total-production', 0, totalProduction, 1500, (n) => Math.round(n).toLocaleString());
    animateNumber('crop-count', 0, cropCount, 1000, (n) => Math.round(n));
}

function applyAdvancedFilters() {
    console.log('고급 필터 적용');
}

function clearAllFilters() {
    console.log('모든 필터 초기화');
}

function handleQuickSearch(e) {
    console.log('빠른 검색:', e.target.value);
}

function handlePageSizeChange(e) {
    console.log('페이지 크기 변경:', e.target.value);
}

function handleTableSort(th) {
    console.log('테이블 정렬:', th.dataset.sort);
}

function toggleChartFullscreen(container) {
    console.log('차트 전체화면 토글');
}

function changeChartType(container, type) {
    console.log('차트 타입 변경:', type);
}

function updateQuickStats(data) {
    console.log('빠른 통계 업데이트');
}

// ========== 이벤트 핸들러 및 초기화 ==========

// 내보내기 버튼 이벤트 설정
document.addEventListener('DOMContentLoaded', function() {
    // CSV 내보내기
    const exportCsvBtn = document.getElementById('export-csv');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => exportData('csv'));
    }
    
    // Excel 내보내기  
    const exportExcelBtn = document.getElementById('export-excel');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', () => exportData('excel'));
    }
});

// 차트 크기 조정 이벤트
window.addEventListener('resize', debounce(() => {
    appState.ui.charts.forEach(chart => {
        if (chart && typeof chart.resize === 'function') {
            chart.resize();
        }
    });
}, 250));

// ========== 레거시 함수 호환성 ==========

// 기존 함수들과의 호환성을 위한 래퍼
function processData() {
    // 이미 AppState에서 처리됨
    console.log('processData 호출됨 - AppState에서 처리됨');
}

function setupTabs() {
    // 새로운 UI에서는 탭 대신 섹션 네비게이션 사용
    console.log('setupTabs 호출됨 - 새로운 네비게이션 시스템 사용');
}

function setupFilters() {
    // setupAdvancedFilters로 대체됨
    setupAdvancedFilters();
}

function renderCharts() {
    // renderAllSections에서 모든 차트 렌더링
    console.log('renderCharts 호출됨 - renderAllSections에서 처리됨');
}

function updateDataTable() {
    // renderDataTable로 대체됨
    renderDataTable();
}

// 기존 차트 렌더링 함수들 (간소화된 버전)
function renderCropAreaChart() {
    console.log('작목군별 재배면적 차트 렌더링 예정');
}

function renderTopCropsChart() {
    console.log('주요 작물 TOP 10 차트 렌더링 예정');  
}

function renderRegionComparisonChart() {
    console.log('지역 비교 차트 렌더링 예정');
}

function renderShareChart() {
    console.log('점유율 차트 렌더링 예정');
}

function renderLegacyTrendChart() {
    console.log('레거시 트렌드 차트 렌더링 예정');
}

function renderGrowthChart() {
    console.log('성장률 차트 렌더링 예정');
}

// 기존 함수명 호환성
function downloadData() {
    exportData('csv');
}

// ========== 앱 시작 로그 ==========
console.log('🌾 강원도 농업 재배동향 대시보드 Pro 초기화됨');
console.log('📊 Chart.js 버전:', Chart.version);
console.log('🎨 프리미엄 테마 적용됨');
console.log('⚡ 고성능 모드 활성화됨');

// 개발 모드에서 앱 상태 전역 접근 허용
if (typeof window !== 'undefined') {
    window.appState = appState;
    window.AppConfig = AppConfig;
    
    // 디버깅을 위한 전역 함수 노출
    window.debugRenderCropGroupCards = renderCropGroupCards;
    window.debugUpdateCropGroupTable = updateCropGroupTable;
    window.debugCheckData = function() {
        console.log('🔍 전체 데이터 상태 확인:');
        console.log('📊 전체 로드된 데이터 개수:', appState.data.raw.length);
        
        if (appState.data.raw.length > 0) {
            const sample = appState.data.raw[0];
            console.log('📋 데이터 샘플:', sample);
            console.log('📋 사용 가능한 필드들:', Object.keys(sample));
            
            const regions = [...new Set(appState.data.raw.map(row => row.region))];
            const cropGroups = [...new Set(appState.data.raw.map(row => row.cropGroup || row['작목군'] || row.crop_group))];
            const years = [...new Set(appState.data.raw.map(row => row.year))];
            
            console.log('🗺️ 모든 지역:', regions);
            console.log('🌾 모든 작목군:', cropGroups);
            console.log('📅 모든 연도:', years);
            
            // 전국 데이터 확인
            const nationalData = appState.data.raw.filter(row => {
                const region = row.region;
                return region === '전국' || region === '전체' || region === 'national' || region === 'National' || region === '합계';
            });
            console.log('🗺️ 전국 관련 데이터 개수:', nationalData.length);
            
            if (nationalData.length > 0) {
                console.log('🗺️ 전국 데이터 샘플:', nationalData[0]);
            }
        }
    };
}

// 페이지 로드 완료 후 작목군별 카드 초기화
setTimeout(() => {
    console.log('🚀 페이지 로드 후 작목군별 카드 초기화 시작');
    if (appState.data.raw && appState.data.raw.length > 0) {
        renderCropGroupCards().catch(error => {
            console.error('❌ 초기 작목군별 카드 렌더링 실패:', error);
        });
    } else {
        console.warn('⚠️ 데이터가 로드되지 않아 작목군별 카드를 초기화할 수 없습니다');
        
        // 3초 후 재시도
        setTimeout(() => {
            console.log('🔄 작목군별 카드 초기화 재시도');
            if (appState.data.raw && appState.data.raw.length > 0) {
                renderCropGroupCards().catch(error => {
                    console.error('❌ 재시도 후 작목군별 카드 렌더링 실패:', error);
                });
            } else {
                console.error('❌ 데이터 로드 실패 - 수동으로 renderCropGroupCards() 호출 필요');
            }
        }, 3000);
    }
}, 2000);

// ========== 재배동향 분석 시스템 ==========

// 증감률 계산 및 분류 함수
function calculateChangeRate(valueA, valueB) {
    if (!valueA || valueA === 0) return { rate: 0, category: 'maintain' };
    
    const rate = ((valueB - valueA) / valueA) * 100;
    
    if (rate >= 5) return { rate, category: 'increase' };
    if (rate <= -5) return { rate, category: 'decrease' };
    return { rate, category: 'maintain' };
}

// 구성비 계산 함수
function calculateCompositionRate(cropValue, totalValue) {
    if (!totalValue || totalValue === 0) return 0;
    return (cropValue / totalValue) * 100;
}

// 재배동향 분석 메인 함수
function analyzeCultivationTrends(yearA, yearB, metric = 'area', region = '전국') {
    console.log(`🔍 재배동향 분석 시작: ${yearA} vs ${yearB}, ${metric}, ${region}`);
    
    if (!appState.data.raw || appState.data.raw.length === 0) {
        console.error('❌ 데이터가 없습니다');
        return null;
    }

    // 디버깅: 사용 가능한 지역 확인
    const availableRegions = [...new Set(appState.data.raw.map(row => row.region))];
    console.log(`🗺️ 사용 가능한 지역들:`, availableRegions);
    console.log(`🗺️ 지역별 데이터 개수:`, availableRegions.map(region => ({
        region: region, 
        count: appState.data.raw.filter(row => row.region === region).length
    })));
    
    // 해당 연도의 데이터 확인
    const yearAData = appState.data.raw.filter(row => row.year == yearA);
    const yearBData = appState.data.raw.filter(row => row.year == yearB);
    console.log(`📅 ${yearA}년 데이터:`, yearAData.length, `${yearB}년 데이터:`, yearBData.length);
    
    if (yearAData.length > 0) {
        const yearARegions = [...new Set(yearAData.map(row => row.region))];
        console.log(`📅 ${yearA}년 지역들:`, yearARegions);
    }
    if (yearBData.length > 0) {
        const yearBRegions = [...new Set(yearBData.map(row => row.region))];
        console.log(`📅 ${yearB}년 지역들:`, yearBRegions);
    }

    // 데이터 필터링 - 지역별로 정확히 매칭
    let dataA, dataB;
    
    if (region === '전국') {
        // DB의 전국 데이터만 필터링
        dataA = appState.data.raw.filter(row => {
            const rowRegion = row.region;
            return row.year == yearA && 
                   (rowRegion === '전국' || rowRegion === '전체' || 
                    rowRegion === 'national' || rowRegion === 'National' || 
                    rowRegion === '합계' || rowRegion === '계');
        });
        
        dataB = appState.data.raw.filter(row => {
            const rowRegion = row.region;
            return row.year == yearB && 
                   (rowRegion === '전국' || rowRegion === '전체' || 
                    rowRegion === 'national' || rowRegion === 'National' || 
                    rowRegion === '합계' || rowRegion === '계');
        });
        
        console.log(`🔍 전국 필터링 체크: yearA=${yearA}, yearB=${yearB}`);
        console.log(`🔍 전국 후보 데이터 A:`, [...new Set(appState.data.raw.filter(row => row.year == yearA).map(r => r.region))]);
        console.log(`🔍 전국 후보 데이터 B:`, [...new Set(appState.data.raw.filter(row => row.year == yearB).map(r => r.region))]);
    } else if (region === '강원') {
        // 강원도 데이터만 필터링
        dataA = appState.data.raw.filter(row => {
            const rowRegion = row.region;
            return row.year == yearA && rowRegion === '강원도';
        });
        
        dataB = appState.data.raw.filter(row => {
            const rowRegion = row.region;
            return row.year == yearB && rowRegion === '강원도';
        });
        
        console.log(`🔍 강원도 필터링 체크: yearA=${yearA}, yearB=${yearB}`);
        console.log(`🔍 강원도 후보 데이터 A:`, [...new Set(appState.data.raw.filter(row => row.year == yearA).map(r => r.region))]);
        console.log(`🔍 강원도 후보 데이터 B:`, [...new Set(appState.data.raw.filter(row => row.year == yearB).map(r => r.region))]);
    } else {
        // 기타 지역의 경우 정확히 매칭
        dataA = appState.data.raw.filter(row => 
            row.year === yearA && row.region === region
        );
        
        dataB = appState.data.raw.filter(row => 
            row.year === yearB && row.region === region
        );
    }

    console.log(`📊 ${region} 필터된 데이터: A=${dataA.length}, B=${dataB.length}`);
    
    // 필터된 데이터 샘플 확인
    if (dataA.length > 0) {
        console.log(`📊 ${region} ${yearA}년 샘플:`, dataA[0]);
        const uniqueCropsA = [...new Set(dataA.map(row => row.cropName))].filter(crop => crop);
        console.log(`🌾 ${region} ${yearA}년 작목 개수: ${uniqueCropsA.length}개`);
    }
    if (dataB.length > 0) {
        console.log(`📊 ${region} ${yearB}년 샘플:`, dataB[0]);
        const uniqueCropsB = [...new Set(dataB.map(row => row.cropName))].filter(crop => crop);
        console.log(`🌾 ${region} ${yearB}년 작목 개수: ${uniqueCropsB.length}개`);
    }
    
    if (dataA.length === 0 || dataB.length === 0) {
        console.warn(`⚠️ ${region} 지역 비교할 데이터가 부족합니다`);
        return null;
    }

    // 작목군별 분석
    const cropGroups = ['식량', '채소', '과수', '특약용작물'];
    const analysis = {
        area: { increase: [], maintain: [], decrease: [] },
        composition: { increase: [], maintain: [], decrease: [] }
    };

    // 공통 작목만 추출 (두 연도 모두에 존재하는 작목)
    const cropsA = [...new Set(dataA.map(row => row.cropName))].filter(crop => crop);
    const cropsB = [...new Set(dataB.map(row => row.cropName))].filter(crop => crop);
    const commonCrops = cropsA.filter(crop => cropsB.includes(crop));
    
    console.log(`🌾 ${region} A년도 작목: ${cropsA.length}개`, cropsA);
    console.log(`🌾 ${region} B년도 작목: ${cropsB.length}개`, cropsB);
    console.log(`🌾 ${region} 공통 작목: ${commonCrops.length}개`, commonCrops);

    if (commonCrops.length === 0) {
        console.warn(`⚠️ ${region} 지역에 공통 작목이 없습니다`);
        return null;
    }

    // 공통 작목에 대한 총합계 계산 (구성비 계산용)
    const totalAreaA = dataA
        .filter(row => commonCrops.includes(row.cropName))
        .reduce((sum, row) => sum + (parseFloat(row.area) || 0), 0);
    const totalAreaB = dataB
        .filter(row => commonCrops.includes(row.cropName))
        .reduce((sum, row) => sum + (parseFloat(row.area) || 0), 0);

    console.log(`📊 ${region} 공통 작목 총합계: A=${totalAreaA}, B=${totalAreaB}`);

    commonCrops.forEach(cropName => {
        const cropDataA = dataA.find(row => row.cropName === cropName);
        const cropDataB = dataB.find(row => row.cropName === cropName);
        
        // 공통 작목이므로 둘 다 존재해야 함
        const areaA = parseFloat(cropDataA?.area) || 0;
        const areaB = parseFloat(cropDataB?.area) || 0;
        
        // 면적 변화 분석
        const areaChange = calculateChangeRate(areaA, areaB);
        
        // 구성비 변화 분석
        const compositionA = calculateCompositionRate(areaA, totalAreaA);
        const compositionB = calculateCompositionRate(areaB, totalAreaB);
        const compositionChange = calculateChangeRate(compositionA, compositionB);
        
        // 작목군 식별
        const cropGroup = cropDataA?.cropGroup || cropDataB?.cropGroup || '기타';
        
        // 분석 결과 저장
        const cropInfo = {
            name: cropName,
            cropGroup: cropGroup,
            areaA: areaA,
            areaB: areaB,
            compositionA: compositionA,
            compositionB: compositionB,
            areaChangeRate: areaChange.rate,
            compositionChangeRate: compositionChange.rate
        };

        // 면적 변화에 따른 분류
        analysis.area[areaChange.category].push(cropInfo);
        
        // 구성비 변화에 따른 분류
        analysis.composition[compositionChange.category].push(cropInfo);
    });

    return analysis;
}

// 작목군별 작목 분류 함수
function groupCropsByCategory(crops) {
    const groups = {
        식량: crops.filter(crop => crop.cropGroup === '식량'),
        채소: crops.filter(crop => crop.cropGroup === '채소'),
        과수: crops.filter(crop => crop.cropGroup === '과수'),
        특약용작물: crops.filter(crop => crop.cropGroup === '특약용작물')
    };
    
    return groups;
}

// 재배동향 테이블 업데이트 함수
function updateCultivationTrendTable(tableId, analysis, type = 'area') {
    console.log(`🔄 테이블 업데이트 시작: ${tableId}, type: ${type}`);
    
    const table = document.getElementById(tableId);
    if (!table) {
        console.error(`❌ 테이블을 찾을 수 없습니다: ${tableId}`);
        return;
    }

    // 테이블별 CSS 클래스 prefix 결정
    let classPrefix = '';
    if (tableId.includes('gangwon') && tableId.includes('composition')) {
        classPrefix = 'cultivation-gangwon-composition-';
    } else if (tableId.includes('gangwon')) {
        classPrefix = 'cultivation-gangwon-';
    } else if (tableId.includes('composition')) {
        classPrefix = 'cultivation-composition-';
    } else {
        classPrefix = 'cultivation-';
    }
    
    console.log(`🎯 CSS 클래스 prefix: ${classPrefix}`);
    console.log(`📊 분석 데이터:`, analysis);

    const data = analysis[type];
    console.log(`📊 ${type} 데이터:`, data);

    const categories = ['increase', 'maintain', 'decrease'];
    const labels = type === 'area' ? 
        { increase: '면적증가', maintain: '면적유지', decrease: '면적감소' } :
        { increase: '구성비증가', maintain: '구성비유지', decrease: '구성비감소' };

    categories.forEach(category => {
        const crops = data[category] || [];
        console.log(`📊 ${category} 카테고리 작목 수: ${crops.length}`, crops);
        
        const groups = groupCropsByCategory(crops);
        console.log(`📊 ${category} 작목군별 분류:`, groups);
        
        // 총 작목 수 (헤더 합계용)
        const totalCount = crops.length;
        const totalSelector = `.${classPrefix}total-${category}`;
        const totalCell = table.querySelector(totalSelector);
        console.log(`🔍 총계 셀 찾기: ${totalSelector}`, totalCell ? '찾음' : '없음');
        if (totalCell) {
            totalCell.textContent = totalCount;
            console.log(`✅ 총계 셀 업데이트: ${totalCount}`);
        }

        // 작목군별 업데이트
        ['grain', 'vegetable', 'fruit', 'special'].forEach((groupKey, index) => {
            const groupName = ['식량', '채소', '과수', '특약용작물'][index];
            const groupCrops = groups[groupName] || [];
            
            const cellSelector = `.${classPrefix}${groupKey}-${category}`;
            const cell = table.querySelector(cellSelector);
            console.log(`🔍 ${groupName} 셀 찾기: ${cellSelector}`, cell ? '찾음' : '없음');
            
            if (cell) {
                const count = groupCrops.length;
                
                if (count > 0) {
                    // 모든 작목명을 표시 (개수와 "외" 제거)
                    const cropNames = groupCrops.map(crop => crop.name);
                    const displayText = cropNames.join(', ');
                    cell.textContent = displayText;
                    console.log(`✅ ${groupName} 셀 업데이트: ${displayText}`);
                } else {
                    cell.textContent = '-';
                    console.log(`✅ ${groupName} 셀 업데이트: -`);
                }
            }
        });
    });

    // 헤더에 작목군별 총 개수 업데이트
    updateTableHeaders(table, analysis, classPrefix);
}

// 테이블 헤더에 작목군별 총 개수 업데이트 함수
function updateTableHeaders(table, analysis, classPrefix) {
    console.log(`🔄 헤더 업데이트 시작`);
    
    // 공통 작목 기준으로 작목군별 총 개수 계산
    const commonCrops = [
        ...analysis.area.increase,
        ...analysis.area.maintain, 
        ...analysis.area.decrease
    ];
    
    // 중복 제거 (같은 작목이 여러 카테고리에 있을 수 없지만 안전을 위해)
    const uniqueCrops = commonCrops.filter((crop, index, array) => 
        array.findIndex(c => c.name === crop.name) === index
    );
    
    const groups = groupCropsByCategory(uniqueCrops);
    
    // 각 작목군별 공통 작목 개수
    const totalCounts = {
        grain: groups['식량'].length,
        vegetable: groups['채소'].length,
        fruit: groups['과수'].length,
        special: groups['특약용작물'].length
    };
    
    console.log(`📊 헤더 총 개수 (공통 작목 기준):`, totalCounts);
    console.log(`📊 공통 작목 상세:`, uniqueCrops.map(c => `${c.name}(${c.cropGroup})`));
    
    // 테이블 헤더의 th 요소들을 찾아서 텍스트 업데이트
    const headers = table.querySelectorAll('thead th');
    headers.forEach(th => {
        const text = th.textContent || th.innerText;
        if (text.includes('식량')) {
            th.innerHTML = `식량<br>(${totalCounts.grain})`;
            console.log(`✅ 식량 헤더 업데이트: ${totalCounts.grain}`);
        } else if (text.includes('채소')) {
            th.innerHTML = `채소<br>(${totalCounts.vegetable})`;
            console.log(`✅ 채소 헤더 업데이트: ${totalCounts.vegetable}`);
        } else if (text.includes('과수')) {
            th.innerHTML = `과수<br>(${totalCounts.fruit})`;
            console.log(`✅ 과수 헤더 업데이트: ${totalCounts.fruit}`);
        } else if (text.includes('특약용작물')) {
            th.innerHTML = `특약용작물<br>(${totalCounts.special})`;
            console.log(`✅ 특약용작물 헤더 업데이트: ${totalCounts.special}`);
        } else if (text.includes('작목수')) {
            const totalCropCount = totalCounts.grain + totalCounts.vegetable + totalCounts.fruit + totalCounts.special;
            th.innerHTML = `작목수<br>(${totalCropCount})`;
            console.log(`✅ 작목수 헤더 업데이트: ${totalCropCount}`);
        }
    });
}

// 재배동향 섹션 업데이트 메인 함수
function updateCultivationSection() {
    const yearA = document.getElementById('cultivation-year-a')?.value;
    const yearB = document.getElementById('cultivation-year-b')?.value;
    const metric = document.getElementById('cultivation-trend-metric')?.value || 'area';
    
    if (!yearA || !yearB) {
        console.warn('⚠️ 연도가 선택되지 않았습니다');
        return;
    }

    console.log(`🔄 재배동향 섹션 업데이트: ${yearA} vs ${yearB}, ${metric}`);

    // 전국 데이터 분석
    const nationalAnalysis = analyzeCultivationTrends(yearA, yearB, metric, '전국');
    if (nationalAnalysis) {
        // 재배면적 동향 테이블 업데이트
        updateCultivationTrendTable('cultivation-crop-change-analysis-table', nationalAnalysis, 'area');
        
        // 구성비 동향 테이블 업데이트  
        updateCultivationTrendTable('cultivation-crop-composition-analysis-table', nationalAnalysis, 'composition');
    }

    // 강원도 데이터 분석
    const gangwonAnalysis = analyzeCultivationTrends(yearA, yearB, metric, '강원');
    if (gangwonAnalysis) {
        // 강원 재배면적 동향 테이블 업데이트
        updateCultivationTrendTable('cultivation-gangwon-crop-change-analysis-table', gangwonAnalysis, 'area');
        
        // 강원 구성비 동향 테이블 업데이트
        updateCultivationTrendTable('cultivation-gangwon-crop-composition-analysis-table', gangwonAnalysis, 'composition');
    }

    // 헤더 텍스트 업데이트
    updateCultivationHeaders(metric);
}

// 헤더 텍스트 업데이트 함수
function updateCultivationHeaders(metric) {
    const isArea = metric === 'area';
    const metricText = isArea ? '재배면적' : '생산량';
    
    // 카드 제목 업데이트
    const cardTitle = document.getElementById('cultivation-card-title');
    if (cardTitle) {
        cardTitle.textContent = `전국 농산물 ${metricText} 동향`;
    }
    
    const gangwonCardTitle = document.getElementById('cultivation-gangwon-area-card-title');
    if (gangwonCardTitle) {
        gangwonCardTitle.textContent = `강원 농산물 ${metricText} 동향`;
    }
    
    
    // 라벨 업데이트
    const increaseLabel = document.getElementById('cultivation-increase-label');
    const maintainLabel = document.getElementById('cultivation-maintain-label');
    const decreaseLabel = document.getElementById('cultivation-decrease-label');
    
    if (increaseLabel) increaseLabel.textContent = `${metricText}증가`;
    if (maintainLabel) maintainLabel.textContent = `${metricText}유지`;
    if (decreaseLabel) decreaseLabel.textContent = `${metricText}감소`;
    
    // 강원도 라벨도 같은 방식으로 업데이트
    const gangwonIncreaseLabel = document.getElementById('cultivation-gangwon-increase-label');
    const gangwonMaintainLabel = document.getElementById('cultivation-gangwon-maintain-label');
    const gangwonDecreaseLabel = document.getElementById('cultivation-gangwon-decrease-label');
    
    if (gangwonIncreaseLabel) gangwonIncreaseLabel.textContent = `${metricText}증가`;
    if (gangwonMaintainLabel) gangwonMaintainLabel.textContent = `${metricText}유지`;
    if (gangwonDecreaseLabel) gangwonDecreaseLabel.textContent = `${metricText}감소`;
}

// 재배동향 이벤트 리스너 초기화
function initCultivationEventListeners() {
    // 연도 선택 이벤트
    const yearASelect = document.getElementById('cultivation-year-a');
    const yearBSelect = document.getElementById('cultivation-year-b');
    const metricSelect = document.getElementById('cultivation-trend-metric');
    
    if (yearASelect) {
        yearASelect.addEventListener('change', updateCultivationSection);
    }
    
    if (yearBSelect) {
        yearBSelect.addEventListener('change', updateCultivationSection);
    }
    
    if (metricSelect) {
        metricSelect.addEventListener('change', updateCultivationSection);
    }

    console.log('✅ 재배동향 이벤트 리스너 초기화 완료');
}

// 초기화 함수 - 기존 초기화 코드에 추가
function initCultivationSection() {
    console.log('🚀 재배동향 섹션 초기화 시작');
    
    // 이벤트 리스너 초기화
    initCultivationEventListeners();
    
    // 연도 옵션 초기화는 setupCultivationControls에서 처리됨
    
    // 초기 업데이트
    setTimeout(() => {
        updateCultivationSection();
    }, 500);
}

// 기존 초기화 코드에 추가 - DOMContentLoaded 이벤트에 연결
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (appState.data.raw && appState.data.raw.length > 0) {
            initCultivationSection();
        } else {
            // 데이터 로드 완료 후 재시도
            setTimeout(() => {
                initCultivationSection();
            }, 3000);
        }
    }, 1000);
});

// ========== CARD AREA FILTER SLIDER FUNCTIONS ==========

// 각 카드별 면적 필터 슬라이더 설정 함수
function setupCardAreaFilterSliders() {
    console.log('🎚️ 카드별 면적 필터 슬라이더 설정 시작');
    
    const cardConfigs = [
        {
            id: 'card1',
            sliderId: 'card1-area-filter-slider',
            valueId: 'card1-area-value',
            countId: 'card1-filtered-count',
            tableId: 'cultivation-crop-change-analysis-table',
            type: 'area',
            unit: 'ha'
        },
        {
            id: 'card2',
            sliderId: 'card2-area-filter-slider',
            valueId: 'card2-area-value',
            countId: 'card2-filtered-count',
            tableId: 'cultivation-crop-composition-analysis-table',
            type: 'composition',
            unit: '%'
        },
        {
            id: 'card3',
            sliderId: 'card3-area-filter-slider',
            valueId: 'card3-area-value',
            countId: 'card3-filtered-count',
            tableId: 'cultivation-gangwon-crop-change-analysis-table',
            type: 'area',
            unit: 'ha'
        },
        {
            id: 'card4',
            sliderId: 'card4-area-filter-slider',
            valueId: 'card4-area-value',
            countId: 'card4-filtered-count',
            tableId: 'cultivation-gangwon-crop-composition-analysis-table',
            type: 'composition',
            unit: '%'
        }
    ];
    
    cardConfigs.forEach(config => {
        setupSingleCardFilter(config);
    });
    
    console.log('✅ 모든 카드별 면적 필터 슬라이더 설정 완료');
}

// 개별 카드 필터 설정
function setupSingleCardFilter(config) {
    const slider = document.getElementById(config.sliderId);
    const valueElement = document.getElementById(config.valueId);
    const countElement = document.getElementById(config.countId);
    const presetBtns = document.querySelectorAll(`[data-card="${config.id}"]`);
    
    if (!slider || !valueElement || !countElement) {
        console.error(`❌ ${config.id} 슬라이더 요소를 찾을 수 없습니다`);
        return;
    }
    
    // 슬라이더 변경 이벤트
    slider.addEventListener('input', function(e) {
        const value = parseInt(e.target.value);
        updateCardFilterDisplay(config, value);
        applyCardAreaFilter(config, value);
        updateCardPresetButtons(config.id, value);
    });
    
    // 프리셋 버튼 이벤트
    presetBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const value = parseInt(this.dataset.value);
            slider.value = value;
            updateCardFilterDisplay(config, value);
            applyCardAreaFilter(config, value);
            updateCardPresetButtons(config.id, value);
        });
    });
    
    // 초기 상태 설정
    updateCardFilterDisplay(config, 0);
    updateCardPresetButtons(config.id, 0);
    
    console.log(`✅ ${config.id} 필터 설정 완료`);
}

// 카드별 필터 표시 업데이트
function updateCardFilterDisplay(config, value) {
    const valueElement = document.getElementById(config.valueId);
    const countElement = document.getElementById(config.countId);
    
    if (valueElement) {
        valueElement.textContent = value;
    }
    
    if (countElement) {
        const count = getCardFilteredCount(config, value);
        if (value > 0) {
            countElement.textContent = `(${count}개 작목)`;
        } else {
            countElement.textContent = '(전체 작목)';
        }
    }
}

// 카드별 프리셋 버튼 활성화 상태 업데이트
function updateCardPresetButtons(cardId, currentValue) {
    const presetBtns = document.querySelectorAll(`[data-card="${cardId}"]`);
    presetBtns.forEach(btn => {
        const btnValue = parseInt(btn.dataset.value);
        if (btnValue === currentValue) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// 카드별 면적 필터 적용
function applyCardAreaFilter(config, value) {
    console.log(`🔍 ${config.id} 필터 적용: ${value}${config.unit} 이상`);
    
    filterCardTable(config, value);
}

// 카드별 테이블에 필터 적용
function filterCardTable(config, minValue) {
    const table = document.getElementById(config.tableId);
    if (!table) return;
    
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    const rows = tbody.querySelectorAll('tr');
    let visibleCount = 0;
    
    rows.forEach(row => {
        // 헤더 행이나 계 행은 항상 표시
        if (row.classList.contains('total-row') || row.classList.contains('separator-row')) {
            row.style.display = '';
            return;
        }
        
        // 작목 데이터가 있는 셀들을 확인
        const cropCells = row.querySelectorAll('.crop-list');
        let shouldShow = minValue === 0; // 필터가 0이면 모든 행 표시
        
        if (minValue > 0) {
            // 각 셀의 작목 데이터를 확인하여 조건에 맞는지 검사
            cropCells.forEach(cell => {
                const cellText = cell.textContent || '';
                // 간단한 조건: 셀에 내용이 있으면 표시 (실제로는 더 정교한 필터링이 필요)
                if (cellText.trim() !== '-' && cellText.trim() !== '') {
                    shouldShow = true;
                }
            });
        }
        
        if (shouldShow) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });
    
    console.log(`📊 ${config.tableId}: ${visibleCount}개 행 표시중`);
}

// 카드별 필터 조건에 맞는 작목 수 계산
function getCardFilteredCount(config, minValue) {
    if (minValue === 0) return '전체';
    
    // 실제 데이터를 기반으로 카운트 계산
    const yearA = parseInt(document.getElementById('cultivation-year-a')?.value);
    const yearB = parseInt(document.getElementById('cultivation-year-b')?.value);
    
    if (!yearA || !yearB || !appState.data.raw) return 0;
    
    const selectedMetric = document.getElementById('cultivation-trend-metric')?.value || 'area';
    const isGangwon = config.id === 'card3' || config.id === 'card4';
    const dataFilter = isGangwon ? 
        (row => row.year === yearA && (row.region === '강원도' || row.region === '강원')) :
        (row => row.year === yearA);
    
    const dataA = appState.data.raw.filter(dataFilter);
    
    let count = 0;
    dataA.forEach(row => {
        const value = selectedMetric === 'area' ? (row.area || 0) : (row.production || 0);
        if (value >= minValue) {
            count++;
        }
    });
    
    return count;
}