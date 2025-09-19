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
            crops: [...new Set(data.map(row => `${row.cropGroup}|${row.cropName}`).filter(c => c && !c.includes('undefined')))],
            regions: [...new Set(data.map(row => row.region).filter(r => r))],
            fieldMapping
        };

        
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
        
        // 초기 홈 섹션 렌더링
        setTimeout(() => {
            renderHome();
        }, 100);
        
        showLoadingOverlay(false);
    } catch (error) {
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
        
        // 캐시 확인
        const cacheKey = `data_${AppConfig.DATA_URL}`;
        const cachedData = getCachedData(cacheKey);
        
        if (cachedData) {
            appState.setRawData(cachedData);
            return;
        }

        const response = await fetch(AppConfig.DATA_URL);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const csvText = await response.text();
        const rawData = parseCSV(csvText);
        
        // 캐시에 저장
        setCachedData(cacheKey, rawData);
        
        appState.setRawData(rawData);
    } catch (error) {
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
}

// 고급 필터 설정
function setupAdvancedFilters() {
    const advancedFilterBtn = document.getElementById('advanced-filter');
    const filterPanel = document.getElementById('filterPanel');
    const applyFiltersBtn = document.getElementById('apply-filters');
    const clearFiltersBtn = document.getElementById('clear-filters');

    if (advancedFilterBtn && filterPanel) {
        // 초기 로드시 필터 패널 활성화
        filterPanel.classList.add('active');
        
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
        if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '7') {
            e.preventDefault();
            const sectionIndex = parseInt(e.key) - 1;
            const sections = ['home', 'dashboard', 'analytics', 'comparison', 'trends', 'data', 'reports'];
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
        
        // 페이지 상단으로 스크롤
        window.scrollTo(0, 0);
        
        // 재배동향 섹션이 표시될 때 슬라이더 설정
        if (sectionId === 'cultivation') {
            setTimeout(() => {
                setupCardAreaFilterSliders();
                // 슬라이더 설정 후 초기 데이터 업데이트 (데이터 로딩 확인)
                setTimeout(() => {
                    if (appState.data.raw && appState.data.raw.length > 0) {
                        handleCultivationChange();
                    } else {
                        setTimeout(() => {
                            if (appState.data.raw && appState.data.raw.length > 0) {
                                handleCultivationChange();
                            }
                        }, 1000);
                    }
                }, 100);
            }, 200);
        }
        
        // 순위분석 섹션이 표시될 때 테이블 업데이트
        if (sectionId === 'ranking') {
            setTimeout(() => {
                if (appState.data.raw && appState.data.raw.length > 0) {
                    updateRankingTables();
                } else {
                    setTimeout(() => {
                        if (appState.data.raw && appState.data.raw.length > 0) {
                            updateRankingTables();
                        }
                    }, 1000);
                }
            }, 100);
        }
        
        // 특화계수 섹션이 표시될 때 분석 업데이트
        if (sectionId === 'specialization') {
            setTimeout(() => {
                if (appState.data.raw && appState.data.raw.length > 0) {
                    updateSpecializationAnalysis();
                } else {
                    setTimeout(() => {
                        if (appState.data.raw && appState.data.raw.length > 0) {
                            updateSpecializationAnalysis();
                        }
                    }, 1000);
                }
            }, 100);
        }
        
        // 홈 섹션이 표시될 때 홈 데이터 업데이트
        if (sectionId === 'home') {
            setTimeout(() => {
                renderHome();
            }, 100);
        }
    }
}

// 브레드크럼 업데이트
function updateBreadcrumb(sectionName) {
    const breadcrumb = document.getElementById('currentSection');
    const sectionNames = {
        home: '홈',
        dashboard: '대시보드',
        analytics: '작목군별 TOP 5 동향',
        cultivation: '재배동향',
        ranking: '작목별 순위분석',
        'crop-ranking': '도별 순위분석',
        specialization: '특화계수',
        data: '데이터 테이블',
        reports: '분석 리포트'
    };
    
    if (breadcrumb) {
        breadcrumb.textContent = sectionNames[sectionName] || sectionName;
    }

    // 브라우저 타이틀 업데이트
    document.title = `${sectionNames[sectionName] || sectionName} - 강원도 재배동향 웹페이지`;
}

// 대시보드 렌더링
async function renderDashboard() {
    // 데이터가 없으면 렌더링 건너뛰기
    if (!appState.data.raw || appState.data.raw.length === 0) {
        return;
    }
    
    // 강원도 데이터 확인, 없으면 전체 데이터 사용
    let targetData = appState.data.raw.filter(row => row.region === '강원');
    if (targetData.length === 0) {
        targetData = appState.data.raw;
    }
    
    
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
        if (chartTitle) chartTitle.textContent = `${selectedCropGroup} TOP5 ${metricNames[selectedMetric]}`;
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
    let targetData = appState.data.raw.filter(row => row.region === '강원');
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
}

// 주요 작물 TOP 10 차트 (레거시)
function renderTopCropsChart() {
}

// 지역 비교 차트 (레거시)
function renderRegionComparisonChart() {
}

// 강원도 점유율 차트 (레거시)
function renderShareChart() {
}

// 트렌드 분석 차트 (레거시)
function renderTrendChart() {
}

// 증감률 분석 차트 (레거시)
function renderGrowthChart() {
}


// 데이터 테이블 업데이트 (레거시)
function updateDataTable() {
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
        });
    } else {
        document.exitFullscreen().catch(err => {
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
}

async function renderComparison() {
}

async function renderTrends() {
}

async function renderDataTable() {
    
    try {
        // 데이터가 로드되지 않았으면 지연 처리
        if (!appState.data.raw || appState.data.raw.length === 0) {
            setTimeout(async () => {
                if (appState.data.raw && appState.data.raw.length > 0) {
                    await renderDataTable();
                }
            }, 1000);
            return;
        }
        
        // 필터 초기화
        initializeDataTableFilters();
        
        // 전체 데이터 로드 및 테이블 렌더링
        await loadDataTableData();
        
        // 이벤트 리스너 설정
        setupDataTableEventListeners();
        
    } catch (error) {
    }
}

async function renderHome() {
    
    try {
        // 홈 섹션 통계 업데이트
        updateHomeStatistics();
        
        // 빠른 탐색 이벤트 리스너 설정
        setupQuickNavigation();
        
        // 최종 업데이트 날짜 설정
        updateLastUpdateDate();
        
    } catch (error) {
    }
}

// 홈 섹션 통계 업데이트
function updateHomeStatistics() {
    if (!appState.data.raw || appState.data.raw.length === 0) {
        return;
    }
    
    try {
        // 총 데이터 수
        const totalDataElement = document.querySelector('.data-info .info-card:nth-child(1) .info-value');
        if (totalDataElement) {
            totalDataElement.textContent = appState.data.raw.length.toLocaleString() + '건';
        }
        
        // 작목 수
        const uniqueCrops = [...new Set(appState.data.raw.map(item => item.작목명))].length;
        const cropsElement = document.querySelector('.data-info .info-card:nth-child(2) .info-value');
        if (cropsElement) {
            cropsElement.textContent = uniqueCrops + '개';
        }
        
        // 최신 연도
        const years = appState.data.raw.map(item => item.연도).filter(year => year);
        const latestYear = Math.max(...years);
        const yearElement = document.querySelector('.data-info .info-card:nth-child(3) .info-value');
        if (yearElement) {
            yearElement.textContent = latestYear + '년';
        }
        
    } catch (error) {
    }
}

// 빠른 탐색 이벤트 리스너 설정
function setupQuickNavigation() {
    const navCards = document.querySelectorAll('.quick-nav-card');
    
    navCards.forEach((card, index) => {
        const targetSection = card.dataset.section;
        
        card.addEventListener('click', () => {
            if (targetSection) {
                // 해당 섹션으로 이동
                navigateToSection(targetSection);
            }
        });
        
        // 호버 효과를 위한 추가 이벤트
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-5px)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
        });
    });
    
}

// 최종 업데이트 날짜 설정
function updateLastUpdateDate() {
    const updateDateElement = document.querySelector('.data-info .source-info');
    if (updateDateElement) {
        const currentDate = new Date();
        const formattedDate = currentDate.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // 기존 텍스트 유지하면서 날짜만 업데이트
        const existingText = updateDateElement.textContent;
        if (!existingText.includes('최종 업데이트:')) {
            updateDateElement.textContent = existingText + ` (최종 업데이트: ${formattedDate})`;
        }
    }
    
}

// 섹션으로 이동하는 함수 (빠른 탐색 카드에서 사용)
function navigateToSection(sectionId) {
    // 네비게이션 링크 클릭 이벤트 시뮬레이션
    const navLink = document.querySelector(`[data-section="${sectionId}"]`);
    if (navLink) {
        navLink.click();
    } else {
        // 직접 섹션 표시
        showSection(sectionId);
        updateBreadcrumb(sectionId);
        
        // 네비게이션 활성 상태 업데이트
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        const targetNavLink = document.querySelector(`[data-section="${sectionId}"]`);
        if (targetNavLink) {
            targetNavLink.classList.add('active');
        }
        
        appState.ui.currentSection = sectionId;
    }
}

async function renderReports() {
}

// 필터 옵션 초기화
function populateFilterOptions() {
    if (!appState.data.processed.years) {
        return;
    }
    
    // 지역 드롭다운 옵션 추가 (강원과 전국만)
    const regionDropdown = document.getElementById('region-dropdown');
    if (regionDropdown) {
        // 모든 기존 옵션 제거
        regionDropdown.innerHTML = '';

        // 강원과 전국만 필터링
        const allowedRegions = ['강원', '전국'];
        const filteredRegions = appState.data.processed.regions.filter(region =>
            allowedRegions.includes(region)
        );

        filteredRegions.forEach((region, index) => {
            const option = new Option(region, region);
            if (region === '강원') option.selected = true; // 강원을 기본 선택
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
    const yearASelect = document.getElementById('year-a');
    const yearBSelect = document.getElementById('year-b');
    
    if (!yearASelect || !yearBSelect) {
        return;
    }
    
    if (!appState.data.processed.years) {
        return;
    }
    
    // DB에서 연도 배열 가져오기 (정렬된 상태)
    const availableYears = [...appState.data.processed.years].sort((a, b) => a - b);
    
    
    if (availableYears.length === 0) {
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
    
}

// 연도 비교 업데이트
async function updateYearComparison() {
    const yearA = parseInt(document.getElementById('year-a')?.value);
    const yearB = parseInt(document.getElementById('year-b')?.value);
    
    if (!yearA || !yearB) return;
    
    // A > B인 경우 경고하고 B를 A보다 큰 값으로 조정
    if (yearA > yearB) {
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
        
        const dataA = appState.data.raw.filter(row => row.year == yearA);
        const dataB = appState.data.raw.filter(row => row.year == yearB);
        
        
        // 지역별 데이터 분리
        const gangwonDataA = dataA.filter(row => row.region === '강원');
        const gangwonDataB = dataB.filter(row => row.region === '강원');
        
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
}

// 비교 차트 렌더링
async function renderComparisonCharts() {
    await renderTrendChart();
    await renderRatioComparisonChart();
}

// 작목군별 상세 카드들 렌더링
async function renderCropGroupCards() {
    
    const cropGroups = [
        { name: '식량', tableId: 'grain-comparison-table', yearHeaderAId: 'grain-year-a-header', yearHeaderBId: 'grain-year-b-header', trendChartId: 'grain-trend-chart', cropsChartId: 'grain-crops-chart' },
        { name: '채소', tableId: 'vegetable-comparison-table', yearHeaderAId: 'vegetable-year-a-header', yearHeaderBId: 'vegetable-year-b-header', trendChartId: 'vegetable-trend-chart', cropsChartId: 'vegetable-crops-chart' },
        { name: '과수', tableId: 'fruit-comparison-table', yearHeaderAId: 'fruit-year-a-header', yearHeaderBId: 'fruit-year-b-header', trendChartId: 'fruit-trend-chart', cropsChartId: 'fruit-crops-chart' },
        { name: '특약용작물', tableId: 'special-comparison-table', yearHeaderAId: 'special-year-a-header', yearHeaderBId: 'special-year-b-header', trendChartId: 'special-trend-chart', cropsChartId: 'special-crops-chart' }
    ];
    
    // 데이터 유효성 검사
    if (!appState.data.raw || appState.data.raw.length === 0) {
        return;
    }
    
    // 모든 작목군에 대해 순차적으로 처리 (디버깅을 위해)
    for (const cropGroup of cropGroups) {
        try {
            
            // HTML 요소 존재 확인
            const tableElement = document.getElementById(cropGroup.tableId);
            const trendChartElement = document.getElementById(cropGroup.trendChartId);
            const cropsChartElement = document.getElementById(cropGroup.cropsChartId);
            
            if (!tableElement) {
                continue;
            }
            
            // 테이블 업데이트
            updateCropGroupTable(cropGroup.name, cropGroup.tableId, cropGroup.yearHeaderAId, cropGroup.yearHeaderBId);
            
            // 차트 렌더링
            if (trendChartElement) {
                await renderCropGroupTrendChart(cropGroup.name, cropGroup.trendChartId, cropGroup.trendChartId);
            }
            
            if (cropsChartElement) {
                await renderCropGroupTop5Chart(cropGroup.name, cropGroup.cropsChartId, cropGroup.cropsChartId);
            }
            
        } catch (error) {
        }
    }
    
}

// 차트 1: 강원 재배면적/비중 시계열 차트
async function renderTrendChart() {
    if (typeof Chart === 'undefined') {
        return;
    }
    
    const canvasElement = document.getElementById('trend-chart');
    if (!canvasElement) {
        return;
    }
    
    const ctx = canvasElement.getContext('2d');
    if (!ctx) {
        return;
    }
    
    
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
        return;
    }
    
    // 기준연도(A)와 비교연도(B) 가져오기
    const yearA = parseInt(document.getElementById('year-a')?.value);
    const yearB = parseInt(document.getElementById('year-b')?.value);
    
    if (!yearA || !yearB) {
        return;
    }
    
    // A > B인 경우 처리
    if (yearA > yearB) {
        return;
    }
    
    // A <= B 범위의 연도들만 필터링
    const allYears = appState.data.processed.years.sort((a, b) => a - b);
    const years = allYears.filter(year => year >= yearA && year <= yearB);
    
    
    if (years.length === 0) {
        return;
    }
    
    // 연도별 강원도 데이터와 전국 데이터 계산
    const gangwonData = [];
    const ratioData = [];
    
    years.forEach(year => {
        const yearData = appState.data.raw.filter(row => row.year === year);
        const gangwonYearData = yearData.filter(row => row.region === '강원');
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
    
    
    if (gangwonData.every(val => val === 0) && ratioData.every(val => val === 0)) {
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
    
    } catch (error) {
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
    
    const gangwonDataA = dataA.filter(row => row.region === '강원');
    const gangwonDataB = dataB.filter(row => row.region === '강원');
    
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
    
    // 년도 정보 가져오기
    const yearA = parseInt(document.getElementById('year-a')?.value);
    const yearB = parseInt(document.getElementById('year-b')?.value);
    const yearText = (yearA && yearB) ? ` (${yearA}년 대비 ${yearB}년)` : '';
    
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
        if (element) {
            const yearSpan = yearText ? ` <span class="year-comparison">${yearText}</span>` : '';
            element.innerHTML = `${header.text}${yearSpan}`;
        } else {
        }
    });
    
    
    // 테이블 단위 표시 업데이트
    updateTableUnits(selectedMetric);
    
    // 차트 제목들도 업데이트
    updateAllChartTitles(selectedMetric);
    
    // 증감 분석 표 제목과 내용 업데이트 (작목군별 TOP5 탭용)
    updateCropChangeAnalysisTable(selectedMetric);
    
    // 카드 내부 테이블과 차트도 업데이트
    updateAllCropGroupCards();
}

// 테이블 단위 표시 업데이트 함수
function updateTableUnits(metric) {
    const unit = metric === 'area' ? 'ha' : '톤';
    const unitText = `단위 : ${unit}, %`;
    
    // 각 테이블의 단위 표시 업데이트
    const unitElements = [
        'crop-comparison-table-unit',
        'grain-comparison-table-unit',
        'vegetable-comparison-table-unit',
        'fruit-comparison-table-unit',
        'special-comparison-table-unit'
    ];
    
    unitElements.forEach(elementId => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = unitText;
        } else {
        }
    });
    
}

// 모든 차트 제목을 선택된 측정항목에 따라 업데이트하는 함수
function updateAllChartTitles(selectedMetric) {
    const metricText = selectedMetric === 'area' ? '재배면적' : '생산량';
    
    // 작목군별 트렌드 차트 제목들
    const chartTitleUpdates = [
        { id: 'ratio-comparison-chart-title', text: `<i class="fas fa-chart-bar"></i> 전국 대비 강원 ${metricText} 비중 변화` },
        { id: 'grain-trend-chart-title', text: `<i class="fas fa-chart-line"></i> 식량 ${metricText} 및 비중` },
        { id: 'grain-crops-chart-title', text: `<i class="fas fa-chart-bar"></i> 전국 대비 식량 작목별 ${metricText} 비중 변화` },
        { id: 'vegetable-trend-chart-title', text: `<i class="fas fa-chart-line"></i> 채소 ${metricText} 및 비중` },
        { id: 'vegetable-crops-chart-title', text: `<i class="fas fa-chart-bar"></i> 전국 대비 채소 작목별 ${metricText} 비중 변화` },
        { id: 'fruit-trend-chart-title', text: `<i class="fas fa-chart-line"></i> 과수 ${metricText} 및 비중` },
        { id: 'fruit-crops-chart-title', text: `<i class="fas fa-chart-bar"></i> 전국 대비 과수 작목별 ${metricText} 비중 변화` },
        { id: 'special-trend-chart-title', text: `<i class="fas fa-chart-line"></i> 특약용작물 ${metricText} 및 비중` },
        { id: 'special-crops-chart-title', text: `<i class="fas fa-chart-bar"></i> 전국 대비 특약용작물 작목별 ${metricText} 비중 변화` }
    ];
    
    chartTitleUpdates.forEach(titleUpdate => {
        const element = document.getElementById(titleUpdate.id);
        if (element) {
            element.innerHTML = titleUpdate.text;
        }
    });
    
}

// 작목별 증감 분석 표 업데이트 함수 (재배동향 탭용)
function updateCultivationCropChangeAnalysisTable(selectedMetric) {
    const metricText = selectedMetric === 'area' ? '재배면적' : '생산량';
    const labelText = selectedMetric === 'area' ? '면적' : '생산량';
    
    // 년도 정보 가져오기
    const titleYearA = parseInt(document.getElementById('cultivation-year-a')?.value);
    const titleYearB = parseInt(document.getElementById('cultivation-year-b')?.value);
    const yearText = (titleYearA && titleYearB) ? ` (${titleYearA}년 대비 ${titleYearB}년)` : '';
    
    // 카드 제목 업데이트  
    const cardTitleElement = document.getElementById('cultivation-card-title');
    if (cardTitleElement) {
        const yearSpan = yearText ? ` <span class="year-comparison">${yearText}</span>` : '';
        cardTitleElement.innerHTML = `전국 농산물 ${metricText} 동향${yearSpan}`;
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
        return;
    }
    
    // 전국 분석 (선택된 측정 항목으로 분석하되, 테이블 타입은 재배면적 기준 유지)
    const nationalAnalysis = analyzeCultivationTrends(yearA, yearB, selectedMetric, '전국');
    if (nationalAnalysis) {
        // 재배면적 동향 테이블 업데이트 (슬라이더는 재배면적 기준이므로 'area' 유지)
        updateCultivationTrendTable('cultivation-crop-change-analysis-table', nationalAnalysis, 'area');
        
        // 구성비 동향 테이블 업데이트 (카드2는 재배면적 필터이므로 'area' 유지)
        updateCultivationTrendTable('cultivation-crop-composition-analysis-table', nationalAnalysis, 'area');
    }

    // 강원도 데이터 분석 (선택된 측정 항목으로 분석하되, 테이블 타입은 재배면적 기준 유지)
    const gangwonAnalysis = analyzeCultivationTrends(yearA, yearB, selectedMetric, '강원');
    if (gangwonAnalysis) {
        // 강원 재배면적 동향 테이블 업데이트 (슬라이더는 재배면적 기준이므로 'area' 유지)
        updateCultivationTrendTable('cultivation-gangwon-crop-change-analysis-table', gangwonAnalysis, 'area');
        
        // 강원 구성비 동향 테이블 업데이트 (카드4는 재배면적 필터이므로 'area' 유지)
        updateCultivationTrendTable('cultivation-gangwon-crop-composition-analysis-table', gangwonAnalysis, 'area');
    }
}

// 재배동향 탭용 작목별 증감 분석 함수
function analyzeCultivationCropChanges(yearA, yearB, selectedMetric) {
    
    const dataA = appState.data.raw.filter(row => row.year === yearA && row.region === '강원');
    const dataB = appState.data.raw.filter(row => row.year === yearB && row.region === '강원');
    
    
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
        
        
        commonCrops.forEach(cropName => {
            const cropDataA = cropGroupDataA.find(row => 
                (row.cropName || row['작목명'] || row.crop_name) === cropName && 
                (row.cropGroup || row['작목군'] || row.crop_group) === cropGroup
            );
            const cropDataB = cropGroupDataB.find(row => 
                (row.cropName || row['작목명'] || row.crop_name) === cropName && 
                (row.cropGroup || row['작목군'] || row.crop_group) === cropGroup
            );
            
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
    
    const dataA = appState.data.raw.filter(row => row.year === yearA && row.region === '강원');
    const dataB = appState.data.raw.filter(row => row.year === yearB && row.region === '강원');
    
    
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
        
        
        commonCrops.forEach(cropName => {
            const cropDataA = cropGroupDataA.find(row => 
                (row.cropName || row['작목명'] || row.crop_name) === cropName && 
                (row.cropGroup || row['작목군'] || row.crop_group) === cropGroup
            );
            const cropDataB = cropGroupDataB.find(row => 
                (row.cropName || row['작목명'] || row.crop_name) === cropName && 
                (row.cropGroup || row['작목군'] || row.crop_group) === cropGroup
            );
            
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
    
}

// 재배동향 탭 컨트롤들 설정 함수
function setupCultivationControls() {
    
    const cultivationYearA = document.getElementById('cultivation-year-a');
    const cultivationYearB = document.getElementById('cultivation-year-b');
    const cultivationTrendMetric = document.getElementById('cultivation-trend-metric');
    
    // 년도 선택기에 옵션 추가
    if (cultivationYearA && cultivationYearB && appState.data.processed.years) {
        // DB에서 연도 배열 가져오기 (정렬된 상태)
        const availableYears = [...appState.data.processed.years].sort((a, b) => a - b);
        
        
        if (availableYears.length === 0) {
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
    
    // 각 카드별 면적 필터 슬라이더 설정 (DOM 로드 후 지연 실행)
    setTimeout(() => {
        setupCardAreaFilterSliders();
    }, 100);
    
    // 초기 업데이트는 showSection에서 처리됨
    
}

// 재배동향 탭 변경 핸들러
function handleCultivationChange() {
    const selectedMetric = document.getElementById('cultivation-trend-metric')?.value || 'area';
    
    
    // 증감 분석 표 업데이트
    updateCultivationCropChangeAnalysisTable(selectedMetric);
    
    // 슬라이더 필터 다시 적용 (측정 항목 변경 시 필터링된 테이블도 업데이트)
    setTimeout(() => {
        const cardConfigs = [
            { id: 'card1', sliderId: 'card1-area-filter-slider' },
            { id: 'card2', sliderId: 'card2-area-filter-slider' },
            { id: 'card3', sliderId: 'card3-area-filter-slider' },
            { id: 'card4', sliderId: 'card4-area-filter-slider' }
        ];
        
        cardConfigs.forEach(config => {
            const slider = document.getElementById(config.sliderId);
            if (slider && slider.value > 0) {
                // 슬라이더 변경 이벤트를 수동으로 트리거
                slider.dispatchEvent(new Event('input'));
            }
        });
    }, 100);
    
}

// 작목군별 TOP5 탭의 증감 분석 표 업데이트 함수
function updateCropChangeAnalysisTable(selectedMetric) {
    
    // 현재 선택된 연도들 가져오기
    const yearA = parseInt(document.getElementById('year-a')?.value);
    const yearB = parseInt(document.getElementById('year-b')?.value);
    
    if (!yearA || !yearB) {
        return;
    }
    
    // 메트릭에 따른 텍스트 업데이트
    const metricText = selectedMetric === 'area' ? '재배면적' : '생산량';
    const labelText = selectedMetric === 'area' ? '면적' : '생산량';
    
    // 테이블 헤더들 업데이트
    const headers = document.querySelectorAll('.comparison-table thead tr:first-child th');
    headers.forEach((header, index) => {
        if (header.textContent.includes('증감률')) {
            header.innerHTML = `증감률 ((B-A)/A)<br>${labelText}`;
        }
    });
    
}

// 증감 분석 표 데이터 업데이트 (기존)
function updateCropChangeTable(analysisResults) {
    
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
    
}

// 모든 작목군별 카드의 테이블과 차트 업데이트 함수
function updateAllCropGroupCards() {
    
    const cropGroups = [
        { name: '식량', tableId: 'grain-comparison-table', yearHeaderAId: 'grain-year-a-header', yearHeaderBId: 'grain-year-b-header', trendChartId: 'grain-trend-chart', cropsChartId: 'grain-crops-chart' },
        { name: '채소', tableId: 'vegetable-comparison-table', yearHeaderAId: 'vegetable-year-a-header', yearHeaderBId: 'vegetable-year-b-header', trendChartId: 'vegetable-trend-chart', cropsChartId: 'vegetable-crops-chart' },
        { name: '과수', tableId: 'fruit-comparison-table', yearHeaderAId: 'fruit-year-a-header', yearHeaderBId: 'fruit-year-b-header', trendChartId: 'fruit-trend-chart', cropsChartId: 'fruit-crops-chart' },
        { name: '특약용작물', tableId: 'special-comparison-table', yearHeaderAId: 'special-year-a-header', yearHeaderBId: 'special-year-b-header', trendChartId: 'special-trend-chart', cropsChartId: 'special-crops-chart' }
    ];
    
    cropGroups.forEach(async (cropGroup) => {
        try {
            
            // 테이블 업데이트
            updateCropGroupTable(cropGroup.name, cropGroup.tableId, cropGroup.yearHeaderAId, cropGroup.yearHeaderBId);
            
            // 차트 업데이트 (약간의 지연을 두어 순차 실행)
            setTimeout(async () => {
                await renderCropGroupTrendChart(cropGroup.name, cropGroup.trendChartId, cropGroup.trendChartId);
                await renderCropGroupTop5Chart(cropGroup.name, cropGroup.cropsChartId, cropGroup.cropsChartId);
            }, 100);
            
        } catch (error) {
        }
    });
    
}

// 지정된 작목 리스트로 데이터 추출 함수 (강원 TOP5 작목으로 전국 데이터 추출)
function getCropDataByTopCrops(dataA, dataB, cropGroup, metric = 'area', topCrops) {
    
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
    
    
    if (filteredData.length > 0 && metric === 'production') {
        const sample = filteredData[0];
    }
    
    const result = filteredData.reduce((sum, row) => {
        const value = row[metric] || row[metric === 'area' ? '재배면적' : '생산량'] || 0;
        return sum + (parseFloat(value) || 0);
    }, 0);
    
    return result;
}

// 작목군별 테이블 업데이트 함수
function updateCropGroupTable(cropGroup, tableId, yearHeaderAId, yearHeaderBId) {
    
    const yearA = parseInt(document.getElementById('year-a')?.value);
    const yearB = parseInt(document.getElementById('year-b')?.value);
    const selectedMetric = document.getElementById('trend-metric')?.value || 'area';
    
    
    if (!yearA || !yearB) {
        return;
    }
    
    // 연도별 데이터 필터링
    const dataA = appState.data.raw.filter(row => row.year == yearA);
    const dataB = appState.data.raw.filter(row => row.year == yearB);
    
    
    const gangwonDataA = dataA.filter(row => row.region === '강원');
    const gangwonDataB = dataB.filter(row => row.region === '강원');
    
    // 여러 가지 전국 표기 방식 지원 (차트와 동일)
    const nationalDataA = dataA.filter(row => {
        const region = row.region;
        return region === '전국' || region === '전체' || region === 'national' || region === 'National' || region === '합계';
    });
    const nationalDataB = dataB.filter(row => {
        const region = row.region;
        return region === '전국' || region === '전체' || region === 'national' || region === 'National' || region === '합계';
    });
    
    
    // 해당 작목군 데이터 확인
    const cropGroupDataA = gangwonDataA.filter(row => {
        const rowCropGroup = row.cropGroup || row['작목군'] || row.crop_group;
        return rowCropGroup === cropGroup;
    });
    const cropGroupDataB = gangwonDataB.filter(row => {
        const rowCropGroup = row.cropGroup || row['작목군'] || row.crop_group;
        return rowCropGroup === cropGroup;
    });
    
    
    if (cropGroupDataA.length === 0 && cropGroupDataB.length === 0) {
        
        // 첫 번째 데이터 샘플 확인
        if (appState.data.raw.length > 0) {
            const sample = appState.data.raw[0];
        }
    }
    
    // 작목군 계 데이터 계산
    const gangwonTotalA = getCropGroupTotal(gangwonDataA, cropGroup, selectedMetric);
    const gangwonTotalB = getCropGroupTotal(gangwonDataB, cropGroup, selectedMetric);
    const nationalTotalA = getCropGroupTotal(nationalDataA, cropGroup, selectedMetric);
    const nationalTotalB = getCropGroupTotal(nationalDataB, cropGroup, selectedMetric);
    
    
    // 비중 계산
    const ratioA = nationalTotalA > 0 ? (gangwonTotalA / nationalTotalA * 100) : 0;
    const ratioB = nationalTotalB > 0 ? (gangwonTotalB / nationalTotalB * 100) : 0;
    
    // 증감률 계산
    const nationalChangeRate = nationalTotalA > 0 ? ((nationalTotalB - nationalTotalA) / nationalTotalA * 100) : 0;
    const gangwonChangeRate = gangwonTotalA > 0 ? ((gangwonTotalB - gangwonTotalA) / gangwonTotalA * 100) : 0;
    const ratioChange = ratioB - ratioA;
    
    
    // 테이블 업데이트
    const table = document.getElementById(tableId);
    if (!table) return;
    
    // 헤더 업데이트 (null 체크 추가)
    const yearHeaderA = document.getElementById(yearHeaderAId);
    const yearHeaderB = document.getElementById(yearHeaderBId);
    
    if (yearHeaderA) {
        yearHeaderA.textContent = `${yearA}년 (A)`;
    } else {
    }
    
    if (yearHeaderB) {
        yearHeaderB.textContent = `${yearB}년 (B)`;
    } else {
    }
    
    // 계 행 업데이트
    const totalRow = table.querySelector('.total-row');
    
    if (totalRow) {
        const cells = totalRow.querySelectorAll('td');
        
        if (cells.length >= 9) {
            
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
            
        } else {
        }
    } else {
    }
    
    // TOP5 작목 데이터 가져오기 (비교연도 B 기준으로 순서 결정)
    // 1. 강원 기준으로 TOP5 작목 선별
    const gangwonTop5Data = getCropGroupTop5(gangwonDataA, gangwonDataB, cropGroup, selectedMetric);
    // 2. 전국 데이터는 강원 TOP5 작목 리스트와 동일한 작목들만 사용
    const nationalTop5Data = getCropDataByTopCrops(nationalDataA, nationalDataB, cropGroup, selectedMetric, gangwonTop5Data.topCrops);
    
    
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
    
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) {
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
        const gangwonYearData = yearData.filter(row => row.region === '강원');
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
    
    const gangwonDataA = dataA.filter(row => row.region === '강원');
    const gangwonDataB = dataB.filter(row => row.region === '강원');
    
    // 전국 데이터 필터링 - 상세 디버깅
    
    // 모든 지역명과 작목군 확인
    const allRegions = [...new Set(dataA.concat(dataB).map(row => row.region))];
    const allCropGroups = [...new Set(dataA.concat(dataB).map(row => row.cropGroup || row['작목군'] || row.crop_group))];
    
    
    // 해당 작목군 데이터만 필터링해서 확인
    const cropGroupDataA = dataA.filter(row => {
        const rowCropGroup = row.cropGroup || row['작목군'] || row.crop_group;
        return rowCropGroup === cropGroup;
    });
    const cropGroupDataB = dataB.filter(row => {
        const rowCropGroup = row.cropGroup || row['작목군'] || row.crop_group;
        return rowCropGroup === cropGroup;
    });
    
    
    if (cropGroupDataA.length > 0) {
    }
    if (cropGroupDataB.length > 0) {
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
    
    
    // 전국 데이터가 없으면 샘플 확인
    if (nationalDataA.length === 0 && nationalDataB.length === 0) {
        if (cropGroupDataA.length > 0) {
        }
        if (cropGroupDataB.length > 0) {
        }
    }
    
    // 작목군별 TOP5 작목 데이터 (비교연도 B 기준으로 순서 결정)
    // 1. 강원 기준으로 TOP5 작목 선별
    const gangwonTop5Data = getCropGroupTop5(gangwonDataA, gangwonDataB, cropGroup, selectedMetric);
    
    // 2. 전국 데이터는 강원 TOP5 작목 리스트와 동일한 작목들만 사용
    const nationalTop5Data = getCropDataByTopCrops(nationalDataA, nationalDataB, cropGroup, selectedMetric, gangwonTop5Data.topCrops);
    
    
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
    const cropCount = new Set(targetData.map(row => `${row.cropGroup}|${row.cropName}`)).size;
    
    // 애니메이션과 함께 값 업데이트
    animateNumber('total-area', 0, totalArea, 1500, (n) => Math.round(n).toLocaleString());
    animateNumber('total-production', 0, totalProduction, 1500, (n) => Math.round(n).toLocaleString());
    animateNumber('crop-count', 0, cropCount, 1000, (n) => Math.round(n));
}

function applyAdvancedFilters() {
}

function clearAllFilters() {
}

function handleQuickSearch(e) {
}

function handlePageSizeChange(e) {
}

// 테이블 정렬 상태 관리
let tableSortState = {
    column: null,
    direction: 'asc' // 'asc' 또는 'desc'
};

function handleTableSort(th) {
    const column = th.dataset.sort;
    const isNumeric = th.classList.contains('numeric');
    
    
    // 정렬 방향 결정
    if (tableSortState.column === column) {
        // 같은 컬럼을 클릭했으면 방향 변경
        tableSortState.direction = tableSortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        // 다른 컬럼을 클릭했으면 오름차순으로 시작
        tableSortState.column = column;
        tableSortState.direction = 'asc';
    }
    
    // 현재 필터된 데이터 가져오기
    const filteredData = getFilteredTableData();
    
    // 데이터 정렬
    const sortedData = sortTableData(filteredData, column, tableSortState.direction, isNumeric);
    
    // 테이블 다시 렌더링 (첫 페이지로)
    renderDataTableRows(sortedData, 1);
    
    // 정렬 표시기 업데이트
    updateSortIndicators(column, tableSortState.direction);
    
}

// 데이터 정렬 함수
function sortTableData(data, column, direction, isNumeric) {
    return [...data].sort((a, b) => {
        let aValue = a[column];
        let bValue = b[column];
        
        if (isNumeric) {
            // 숫자형 정렬
            aValue = parseFloat(aValue) || 0;
            bValue = parseFloat(bValue) || 0;
        } else {
            // 텍스트 정렬
            aValue = String(aValue || '').toLowerCase();
            bValue = String(bValue || '').toLowerCase();
        }
        
        if (aValue < bValue) {
            return direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return direction === 'asc' ? 1 : -1;
        }
        return 0;
    });
}

// 정렬 표시기 업데이트
function updateSortIndicators(activeColumn, direction) {
    // 모든 정렬 표시기 초기화
    document.querySelectorAll('.sortable i').forEach(icon => {
        icon.className = 'fas fa-sort';
    });
    
    // 활성 컬럼의 표시기 업데이트
    const activeHeader = document.querySelector(`th[data-sort="${activeColumn}"] i`);
    if (activeHeader) {
        activeHeader.className = direction === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
    }
    
    // 헤더에 정렬 상태 클래스 추가
    document.querySelectorAll('.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    const activeTh = document.querySelector(`th[data-sort="${activeColumn}"]`);
    if (activeTh) {
        activeTh.classList.add(`sort-${direction}`);
    }
}

function toggleChartFullscreen(container) {
}

function changeChartType(container, type) {
}

function updateQuickStats(data) {
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

    // 순위분석 다운로드 버튼
    const rankingDownloadBtns = document.querySelectorAll('#ranking .btn-download');
    rankingDownloadBtns.forEach(btn => {
        btn.addEventListener('click', exportRankingToExcel);
    });

    // 특화계수 다운로드 버튼
    const specializationDownloadBtns = document.querySelectorAll('#specialization .btn-download');
    specializationDownloadBtns.forEach(btn => {
        btn.addEventListener('click', exportSpecializationToExcel);
    });
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
}

function setupTabs() {
    // 새로운 UI에서는 탭 대신 섹션 네비게이션 사용
}

function setupFilters() {
    // setupAdvancedFilters로 대체됨
    setupAdvancedFilters();
}

function renderCharts() {
    // renderAllSections에서 모든 차트 렌더링
}

function updateDataTable() {
    // renderDataTable로 대체됨
    renderDataTable();
}

// 기존 차트 렌더링 함수들 (간소화된 버전)
function renderCropAreaChart() {
}

function renderTopCropsChart() {
}

function renderRegionComparisonChart() {
}

function renderShareChart() {
}

function renderLegacyTrendChart() {
}

function renderGrowthChart() {
}

// 기존 함수명 호환성
function downloadData() {
    exportData('csv');
}

// ========== 앱 시작 로그 ==========

// 개발 모드에서 앱 상태 전역 접근 허용
if (typeof window !== 'undefined') {
    window.appState = appState;
    window.AppConfig = AppConfig;
    
    // 디버깅을 위한 전역 함수 노출
    window.debugRenderCropGroupCards = renderCropGroupCards;
    window.debugUpdateCropGroupTable = updateCropGroupTable;
    window.debugCheckData = function() {
        
        if (appState.data.raw.length > 0) {
            const sample = appState.data.raw[0];
            
            const regions = [...new Set(appState.data.raw.map(row => row.region))];
            const cropGroups = [...new Set(appState.data.raw.map(row => row.cropGroup || row['작목군'] || row.crop_group))];
            const years = [...new Set(appState.data.raw.map(row => row.year))];
            
            
            // 전국 데이터 확인
            const nationalData = appState.data.raw.filter(row => {
                const region = row.region;
                return region === '전국' || region === '전체' || region === 'national' || region === 'National' || region === '합계';
            });
            
            if (nationalData.length > 0) {
            }
        }
    };
}

// 페이지 로드 완료 후 작목군별 카드 초기화
setTimeout(() => {
    if (appState.data.raw && appState.data.raw.length > 0) {
        renderCropGroupCards().catch(error => {
        });
    } else {
        
        // 3초 후 재시도
        setTimeout(() => {
            if (appState.data.raw && appState.data.raw.length > 0) {
                renderCropGroupCards().catch(error => {
                });
            } else {
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
    
    if (!appState.data.raw || appState.data.raw.length === 0) {
        return null;
    }

    // 디버깅: 사용 가능한 지역 확인
    const availableRegions = [...new Set(appState.data.raw.map(row => row.region))];
    
    // 해당 연도의 데이터 확인
    const yearAData = appState.data.raw.filter(row => row.year == yearA);
    const yearBData = appState.data.raw.filter(row => row.year == yearB);
    
    if (yearAData.length > 0) {
        const yearARegions = [...new Set(yearAData.map(row => row.region))];
    }
    if (yearBData.length > 0) {
        const yearBRegions = [...new Set(yearBData.map(row => row.region))];
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
        
    } else if (region === '강원') {
        // 강원도 데이터만 필터링
        dataA = appState.data.raw.filter(row => {
            const rowRegion = row.region;
            return row.year == yearA && rowRegion === '강원';
        });
        
        dataB = appState.data.raw.filter(row => {
            const rowRegion = row.region;
            return row.year == yearB && rowRegion === '강원';
        });
        
    } else {
        // 기타 지역의 경우 정확히 매칭
        dataA = appState.data.raw.filter(row => 
            row.year === yearA && row.region === region
        );
        
        dataB = appState.data.raw.filter(row => 
            row.year === yearB && row.region === region
        );
    }

    
    // 데이터 샘플 확인
    if (dataA.length > 0) {
        // 데이터 확인됨
    }
    
    if (dataB.length > 0) {
        // 데이터 확인됨
    }
    
    // 강원 데이터가 0개일 때 상세 디버깅
    if (region === '강원' && (dataA.length === 0 || dataB.length === 0)) {
        
        if (appState.data.raw.filter(row => row.year == yearA && row.region === '강원').length > 0) {
        }
        if (appState.data.raw.filter(row => row.year == yearB && row.region === '강원').length > 0) {
        }
    }
    
    // 필터된 데이터 샘플 확인
    if (dataA.length > 0) {
        const uniqueCropsA = [...new Set(dataA.map(row => `${row.cropGroup}|${row.cropName}`))].filter(crop => crop && !crop.includes('undefined'));
    }
    if (dataB.length > 0) {
        const uniqueCropsB = [...new Set(dataB.map(row => `${row.cropGroup}|${row.cropName}`))].filter(crop => crop && !crop.includes('undefined'));
    }
    
    if (dataA.length === 0 || dataB.length === 0) {
        return null;
    }

    // 작목군별 분석
    const cropGroups = ['식량', '채소', '과수', '특약용작물'];
    const analysis = {
        area: { increase: [], maintain: [], decrease: [] },
        composition: { increase: [], maintain: [], decrease: [] }
    };

    // 공통 작목만 추출 (두 연도 모두에 존재하는 작목 - 작목군+작목명 조합으로)
    const cropsA = [...new Set(dataA.map(row => `${row.cropGroup}|${row.cropName}`))].filter(crop => crop && !crop.includes('undefined'));
    const cropsB = [...new Set(dataB.map(row => `${row.cropGroup}|${row.cropName}`))].filter(crop => crop && !crop.includes('undefined'));
    const commonCrops = cropsA.filter(crop => cropsB.includes(crop));
    

    if (commonCrops.length === 0) {
        return null;
    }

    // 공통 작목에 대한 총합계 계산 (구성비 계산용)
    const totalValueA = dataA
        .filter(row => commonCrops.includes(`${row.cropGroup}|${row.cropName}`))
        .reduce((sum, row) => {
            const value = metric === 'area' ? 
                (parseFloat(row.area) || 0) : 
                (parseFloat(row.production) || 0);
            return sum + value;
        }, 0);
    const totalValueB = dataB
        .filter(row => commonCrops.includes(`${row.cropGroup}|${row.cropName}`))
        .reduce((sum, row) => {
            const value = metric === 'area' ? 
                (parseFloat(row.area) || 0) : 
                (parseFloat(row.production) || 0);
            return sum + value;
        }, 0);


    // 처리 통계 변수 초기화
    let processedCount = 0;
    let excludedCount = 0;
    const excludedCrops = [];

    commonCrops.forEach(cropKey => {
        const [cropGroup, cropName] = cropKey.split('|');
        const cropDataA = dataA.find(row => row.cropName === cropName && row.cropGroup === cropGroup);
        const cropDataB = dataB.find(row => row.cropName === cropName && row.cropGroup === cropGroup);
        
        if (!cropDataA || !cropDataB) {
            excludedCount++;
            excludedCrops.push(cropName);
            return;
        }
        
        // 선택된 측정항목에 따라 값 선택
        const valueA = metric === 'area' ? 
            (parseFloat(cropDataA?.area) || 0) : 
            (parseFloat(cropDataA?.production) || 0);
        const valueB = metric === 'area' ? 
            (parseFloat(cropDataB?.area) || 0) : 
            (parseFloat(cropDataB?.production) || 0);
        
        // 생산량 분석 시 두 값이 모두 0이면 제외
        if (metric === 'production' && valueA === 0 && valueB === 0) {
            excludedCount++;
            excludedCrops.push(cropName);
            return;
        }
        
        processedCount++;
        
        // 값 변화 분석 (재배면적 또는 생산량)
        const valueChange = calculateChangeRate(valueA, valueB);
        
        // 구성비 변화 분석 (총합계 대비 비율)
        const compositionA = calculateCompositionRate(valueA, totalValueA);
        const compositionB = calculateCompositionRate(valueB, totalValueB);
        const compositionChange = calculateChangeRate(compositionA, compositionB);
        
        // 작목군 식별 (이미 cropGroup 변수가 있으므로 다른 이름 사용)
        const detectedCropGroup = cropDataA?.cropGroup || cropDataB?.cropGroup || '기타';
        
        // 분석 결과 저장
        const cropInfo = {
            name: cropName,
            cropGroup: cropGroup,
            valueA: valueA,
            valueB: valueB,
            compositionA: compositionA,
            compositionB: compositionB,
            valueChangeRate: valueChange.rate,
            compositionChangeRate: compositionChange.rate,
            // 하위 호환성을 위한 기존 필드 유지
            areaA: valueA,
            areaB: valueB,
            areaChangeRate: valueChange.rate
        };

        // 값 변화에 따른 분류 (재배면적 또는 생산량)
        analysis.area[valueChange.category].push(cropInfo);
        
        // 구성비 변화에 따른 분류
        analysis.composition[compositionChange.category].push(cropInfo);
    });

    // 분석 처리 통계 요약
    
    // 분석 결과 요약 로그

    return analysis;
}

// 작목군별 작목 분류 함수
function groupCropsByCategory(crops) {
    if (!crops || !Array.isArray(crops)) {
        return {
            식량: [],
            채소: [],
            과수: [],
            특약용작물: []
        };
    }
    
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
    
    const table = document.getElementById(tableId);
    if (!table) {
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
    

    const data = analysis[type];
    
    if (!data) {
        return;
    }

    const categories = ['increase', 'maintain', 'decrease'];
    const labels = type === 'area' ? 
        { increase: '면적증가', maintain: '면적유지', decrease: '면적감소' } :
        { increase: '구성비증가', maintain: '구성비유지', decrease: '구성비감소' };

    categories.forEach(category => {
        const crops = data[category] || [];
        
        // crops가 배열이 아닌 경우 처리
        let cropArray = [];
        if (Array.isArray(crops)) {
            cropArray = crops;
        } else if (crops && typeof crops === 'object') {
            // crops가 객체인 경우 (예: { grain: [], vegetable: [], ... })
            cropArray = Object.values(crops).flat();
        }
        
        
        const groups = groupCropsByCategory(cropArray);
        
        // 총 작목 수 (헤더 합계용)
        const totalCount = cropArray.length;
        const totalSelector = `.${classPrefix}total-${category}`;
        const totalCell = table.querySelector(totalSelector);
        if (totalCell) {
            const oldTotal = totalCell.textContent;
            totalCell.textContent = totalCount;
        } else {
        }

        // 작목군별 업데이트
        ['grain', 'vegetable', 'fruit', 'special'].forEach((groupKey, index) => {
            const groupName = ['식량', '채소', '과수', '특약용작물'][index];
            const groupCrops = groups[groupName] || [];
            
            const cellSelector = `.${classPrefix}${groupKey}-${category}`;
            const cell = table.querySelector(cellSelector);
            
            if (cell) {
                const count = groupCrops.length;
                const oldContent = cell.textContent; // 변경 전 내용 저장
                
                if (count > 0) {
                    // 모든 작목명을 표시 (개수와 "외" 제거)
                    const cropNames = groupCrops.map(crop => crop.name);
                    const displayText = cropNames.join(', ');
                    cell.textContent = displayText;
                } else {
                    cell.textContent = '-';
                }
            } else {
            }
        });
    });

    // 헤더에 작목군별 총 개수 업데이트
    updateTableHeaders(table, analysis, classPrefix);
    
}

// 테이블 헤더에 작목군별 총 개수 업데이트 함수
function updateTableHeaders(table, analysis, classPrefix) {
    
    // analysis.area의 각 카테고리에서 작목 배열 추출
    const extractCrops = (category) => {
        if (!category) return [];
        if (Array.isArray(category)) return category;
        if (typeof category === 'object') {
            // 객체인 경우 모든 값들을 배열로 변환하여 합침
            return Object.values(category).flat();
        }
        return [];
    };
    
    // 공통 작목 기준으로 작목군별 총 개수 계산
    const commonCrops = [
        ...extractCrops(analysis.area.increase),
        ...extractCrops(analysis.area.maintain), 
        ...extractCrops(analysis.area.decrease)
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
    
    
    // 테이블 헤더의 th 요소들을 찾아서 텍스트 업데이트
    const headers = table.querySelectorAll('thead th');
    headers.forEach(th => {
        const text = th.textContent || th.innerText;
        if (text.includes('식량')) {
            th.innerHTML = `식량<br>(${totalCounts.grain})`;
        } else if (text.includes('채소')) {
            th.innerHTML = `채소<br>(${totalCounts.vegetable})`;
        } else if (text.includes('과수')) {
            th.innerHTML = `과수<br>(${totalCounts.fruit})`;
        } else if (text.includes('특약용작물')) {
            th.innerHTML = `특약용작물<br>(${totalCounts.special})`;
        } else if (text.includes('작목수')) {
            const totalCropCount = totalCounts.grain + totalCounts.vegetable + totalCounts.fruit + totalCounts.special;
            th.innerHTML = `작목수<br>(${totalCropCount})`;
        }
    });
}

// 재배동향 섹션 업데이트 메인 함수
function updateCultivationSection() {
    const yearA = document.getElementById('cultivation-year-a')?.value;
    const yearB = document.getElementById('cultivation-year-b')?.value;
    const selectedMetric = document.getElementById('cultivation-trend-metric')?.value || 'area';
    
    if (!yearA || !yearB) {
        return;
    }


    // 전국 데이터 분석 (선택된 측정 항목으로 분석)
    const nationalAnalysis = analyzeCultivationTrends(yearA, yearB, selectedMetric, '전국');
    if (nationalAnalysis) {
        
        // 카드1: 전국 농산물 재배면적/생산량 동향 테이블 업데이트 (선택된 측정항목으로 분석)
        updateCultivationTrendTable('cultivation-crop-change-analysis-table', nationalAnalysis, 'area');
        
        // 카드2: 전국 농산물 재배면적/생산량 구성비 동향 테이블 업데이트 (선택된 측정항목으로 분석)
        updateCultivationTrendTable('cultivation-crop-composition-analysis-table', nationalAnalysis, 'area');
        
    } else {
    }

    // 강원도 데이터 분석 (선택된 측정 항목으로 분석)
    const gangwonAnalysis = analyzeCultivationTrends(yearA, yearB, selectedMetric, '강원');
    if (gangwonAnalysis) {
        
        // 카드3: 강원 농산물 재배면적/생산량 동향 테이블 업데이트 (선택된 측정항목으로 분석)
        updateCultivationTrendTable('cultivation-gangwon-crop-change-analysis-table', gangwonAnalysis, 'area');
        
        // 카드4: 강원 농산물 재배면적/생산량 구성비 동향 테이블 업데이트 (선택된 측정항목으로 분석)
        updateCultivationTrendTable('cultivation-gangwon-crop-composition-analysis-table', gangwonAnalysis, 'area');
        
    } else {
    }

    // 헤더 텍스트 업데이트
    updateCultivationHeaders(selectedMetric);
}

// 헤더 텍스트 업데이트 함수
function updateCultivationHeaders(metric) {
    const isArea = metric === 'area';
    const metricText = isArea ? '재배면적' : '생산량';
    
    // 년도 정보 가져오기
    const headerYearA = parseInt(document.getElementById('cultivation-year-a')?.value);
    const headerYearB = parseInt(document.getElementById('cultivation-year-b')?.value);
    const yearText = (headerYearA && headerYearB) ? ` (${headerYearA}년 대비 ${headerYearB}년)` : '';
    
    
    // 카드 제목 업데이트
    const cardTitle = document.getElementById('cultivation-card-title');
    if (cardTitle) {
        const yearSpan = yearText ? ` <span class="year-comparison">${yearText}</span>` : '';
        cardTitle.innerHTML = `전국 농산물 ${metricText} 동향${yearSpan}`;
    }
    
    const card2Title = document.getElementById('cultivation-card2-title');
    if (card2Title) {
        const yearSpan = yearText ? ` <span class="year-comparison">${yearText}</span>` : '';
        card2Title.innerHTML = `전국 농산물 ${metricText} 구성비 동향${yearSpan}`;
    }
    
    const gangwonCardTitle = document.getElementById('cultivation-gangwon-area-card-title');
    if (gangwonCardTitle) {
        const yearSpan = yearText ? ` <span class="year-comparison">${yearText}</span>` : '';
        gangwonCardTitle.innerHTML = `강원 농산물 ${metricText} 동향${yearSpan}`;
    }
    
    const card4Title = document.getElementById('cultivation-card4-title');
    if (card4Title) {
        const yearSpan = yearText ? ` <span class="year-comparison">${yearText}</span>` : '';
        card4Title.innerHTML = `강원 농산물 ${metricText} 구성비 동향${yearSpan}`;
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
        metricSelect.addEventListener('change', (event) => {
            const newMetric = event.target.value;
            updateCultivationSection();
        });
    }

}

// 초기화 함수 - 기존 초기화 코드에 추가
function initCultivationSection() {
    
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
    
    // 이미 설정되었는지 확인
    if (window.cardSlidersSetup) {
        return;
    }
    
    const cardConfigs = [
        {
            id: 'card1',
            sliderId: 'card1-area-filter-slider',
            valueId: 'card1-area-value',
            countId: null, // card1에는 카운트 요소가 없음
            tableId: 'cultivation-crop-change-analysis-table',
            type: 'area',
            unit: 'ha'
        },
        {
            id: 'card2',
            sliderId: 'card2-area-filter-slider',
            valueId: 'card2-area-value',
            countId: null, // card2에는 카운트 요소가 없음
            tableId: 'cultivation-crop-composition-analysis-table',
            type: 'area',       // composition에서 area로 변경
            unit: 'ha'          // %에서 ha로 변경
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
            type: 'area',
            unit: 'ha'
        }
    ];
    
    cardConfigs.forEach(config => {
        setupSingleCardFilter(config);
    });
    
    // 설정 완료 플래그 설정
    window.cardSlidersSetup = true;
    
}

// 개별 카드 필터 설정
function setupSingleCardFilter(config) {
    const slider = document.getElementById(config.sliderId);
    const valueElement = document.getElementById(config.valueId);
    const countElement = config.countId ? document.getElementById(config.countId) : null;
    const presetBtns = document.querySelectorAll(`[data-card="${config.id}"]`);
    
    if (!slider || !valueElement) {
        
        // 500ms 후 재시도
        setTimeout(() => {
            setupSingleCardFilter(config);
        }, 500);
        return;
    }
    
    // countId가 null이면 카운트 요소가 의도적으로 없는 것으로 처리
    if (config.countId && !countElement) {
    }
    
    // 슬라이더 변경 이벤트
    slider.addEventListener('input', function(e) {
        const value = parseInt(e.target.value);
        updateCardFilterDisplay(config, value);
        applyCardAreaFilter(config, value);
        updateCardPresetButtons(config.id, value);
    });
    
    // 프리셋 버튼 이벤트 (누를 때마다 증가)
    presetBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const btnValue = parseInt(this.dataset.value);
            const currentValue = parseInt(slider.value);
            let newValue;
            
            
            if (btnValue === 0) {
                // "전체" 버튼은 항상 0으로 리셋
                newValue = 0;
            } else {
                // 다른 버튼들은 해당 값만큼 계속 증가
                newValue = currentValue + btnValue;
                
                // 슬라이더 최대값을 넘지 않도록 제한
                const maxValue = parseInt(slider.max);
                if (newValue > maxValue) {
                    newValue = maxValue;
                }
            }
            
            
            slider.value = newValue;
            updateCardFilterDisplay(config, newValue);
            applyCardAreaFilter(config, newValue);
            updateCardPresetButtons(config.id, newValue);
        });
    });
    
    // 초기 상태 설정
    updateCardFilterDisplay(config, 0);
    updateCardPresetButtons(config.id, 0);
    
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
        
        // "전체" 버튼(값이 0)은 현재 값이 0일 때만 활성화
        if (btnValue === 0) {
            if (currentValue === 0) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        } else {
            // 다른 버튼들은 누적 증가 방식이므로 항상 비활성화 상태로 표시
            // (사용자가 언제든 클릭하여 증가시킬 수 있음을 나타내기 위해)
            btn.classList.remove('active');
        }
    });
}

// 카드별 면적 필터 적용
function applyCardAreaFilter(config, value) {
    
    // 필터링된 데이터로 테이블 업데이트
    updateFilteredCultivationTable(config, value);
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
    
}

// 카드별 필터 조건에 맞는 작목 수 계산
function getCardFilteredCount(config, minValue) {
    if (minValue === 0) return '전체';
    
    // 실제 데이터를 기반으로 카운트 계산
    const yearA = parseInt(document.getElementById('cultivation-year-a')?.value);
    const yearB = parseInt(document.getElementById('cultivation-year-b')?.value);
    
    if (!yearA || !yearB || !appState.data.raw) return 0;
    
    const isGangwon = config.id === 'card3' || config.id === 'card4';
    const dataFilter = isGangwon ? 
        (row => row.year === yearA && row.region === '강원') :
        (row => row.year === yearA);
    
    const dataA = appState.data.raw.filter(dataFilter);
    
    let count = 0;
    dataA.forEach(row => {
        // 슬라이더 필터는 항상 재배면적 기준
        const area = row.area || 0;
        if (area >= minValue) {
            count++;
        }
    });
    
    return count;
}

// 카테고리에서 작목 배열 추출하는 헬퍼 함수
function extractCropsFromCategory(category) {
    if (!category) return [];
    if (Array.isArray(category)) return category;
    if (typeof category === 'object') {
        return Object.values(category).flat();
    }
    return [];
}

// 필터링된 데이터로 재배동향 테이블 업데이트
function updateFilteredCultivationTable(config, filterValue) {
    
    // 현재 선택된 연도와 측정 항목 가져오기
    const yearA = parseInt(document.getElementById('cultivation-year-a')?.value);
    const yearB = parseInt(document.getElementById('cultivation-year-b')?.value);
    const metric = document.getElementById('cultivation-trend-metric')?.value || 'area';
    
    
    if (!yearA || !yearB) {
        return;
    }
    
    // 지역 결정 (card3, card4는 강원도)
    const region = (config.id === 'card3' || config.id === 'card4') ? '강원' : '전국';
    
    // 필터값이 0이면 원본 함수 사용, 0보다 크면 필터링 함수 사용
    let analysis;
    if (filterValue === 0) {
        analysis = analyzeCultivationTrends(yearA, yearB, metric, region);
    } else {
        
        // 디버깅을 위해 원본 결과와 비교
        
        const originalAnalysis = analyzeCultivationTrends(yearA, yearB, metric, region);
        const noFilterAnalysis = analyzeCultivationTrendsWithFilter(yearA, yearB, metric, region, 0, config.unit);
        analysis = analyzeCultivationTrendsWithFilter(yearA, yearB, metric, region, filterValue, config.unit);
        
        
        // 증가 카테고리 비교
        if (originalAnalysis && originalAnalysis.area && analysis && analysis.area) {
            const originalIncrease = extractCropsFromCategory(originalAnalysis.area.increase);
            const filteredIncrease = extractCropsFromCategory(analysis.area.increase);
            
            
            // 차이점 찾기
            const lost = originalIncrease.filter(orig => !filteredIncrease.find(filt => filt.name === orig.name));
            const moved = lost.length > 0 ? '이동됨' : '변화없음';
        }
    }
    
    if (analysis) {
        // 테이블 타입 결정 (card2, card4는 구성비 테이블)
        const tableType = (config.id === 'card2' || config.id === 'card4') ? 'composition' : 'area';
        updateCultivationTrendTable(config.tableId, analysis, tableType);
    } else {
    }
}

// 필터링 기능이 추가된 재배동향 분석 함수
function analyzeCultivationTrendsWithFilter(yearA, yearB, metric = 'area', region = '전국', filterValue = 0, filterUnit = 'ha') {
    
    if (!appState.data.raw || appState.data.raw.length === 0) {
        return null;
    }
    
    // 지역 필터 함수
    let regionFilter;
    if (region === '강원') {
        regionFilter = (row) => row.region === '강원';
    } else if (region === '전국') {
        // DB의 전국 데이터만 필터링 (원본 함수와 동일한 로직)
        regionFilter = (row) => {
            const rowRegion = row.region;
            return rowRegion === '전국' || rowRegion === '전체' || rowRegion === 'national' || rowRegion === 'National' || rowRegion === '합계';
        };
    } else {
        regionFilter = (row) => true; // 기타 지역은 모든 지역
    }
    
    // 연도별 데이터 필터링 (필터 적용 전에 먼저 연도와 지역만 필터링)
    const dataA = appState.data.raw.filter(row => {
        return row.year == yearA && regionFilter(row);
    });
    
    const dataB = appState.data.raw.filter(row => {
        return row.year == yearB && regionFilter(row);
    });
    
    
    // 디버깅: 강원도 데이터가 없을 때 모든 지역명 확인
    if (region === '강원' && (dataA.length === 0 || dataB.length === 0)) {
        const allRegions = [...new Set(appState.data.raw.map(row => row.region))];
        
        const yearAData = appState.data.raw.filter(row => row.year == yearA);
        const yearBData = appState.data.raw.filter(row => row.year == yearB);
    }
    
    if (dataA.length > 0) {
    }
    if (dataB.length > 0) {
    }
    
    // 공통 작목들 찾기 (필터 적용 전) - 작목군+작목명 조합으로
    const cropsA = new Set(dataA.map(row => `${row.cropGroup}|${row.cropName}`));
    const cropsB = new Set(dataB.map(row => `${row.cropGroup}|${row.cropName}`));
    const commonCrops = [...cropsA].filter(crop => cropsB.has(crop) && crop && !crop.includes('undefined'));
    
    
    // 작목군별로 데이터 분석
    const cropGroups = ['식량', '채소', '과수', '특약용작물'];
    const results = {
        increase: { total: 0, grain: [], vegetable: [], fruit: [], special: [] },
        maintain: { total: 0, grain: [], vegetable: [], fruit: [], special: [] },
        decrease: { total: 0, grain: [], vegetable: [], fruit: [], special: [] }
    };
    
    let processedCount = 0;
    let excludedCount = 0;
    const excludedCrops = [];
    
    commonCrops.forEach(cropKey => {
        const [cropGroup, cropName] = cropKey.split('|');
        const cropA = dataA.find(row => row.cropName === cropName && row.cropGroup === cropGroup);
        const cropB = dataB.find(row => row.cropName === cropName && row.cropGroup === cropGroup);
        
        if (!cropA || !cropB) return;
        
        const valueA = metric === 'area' ? (cropA.area || 0) : (cropA.production || 0);
        const valueB = metric === 'area' ? (cropB.area || 0) : (cropB.production || 0);
        
        // 생산량 기준 분석일 때, 생산량 데이터가 모두 0이거나 없는 경우 제외
        if (metric === 'production' && (valueA === 0 && valueB === 0)) {
            excludedCount++;
            excludedCrops.push(cropName);
            return;
        }
        
        processedCount++;
        
        // 디버깅: 측정항목별 값 비교 로그 (모든 작물의 첫 5개는 항상 로그 출력)
        const shouldLog = Math.random() < 0.2 || cropName?.includes('인삼') || cropName?.includes('담배') || commonCrops.indexOf(`${cropGroup}|${cropName}`) < 5;
        if (shouldLog) {
        }
        
        // 증감 판정 (필터와 상관없이 동일하게 계산)
        const changeRate = valueA === 0 ? 0 : ((valueB - valueA) / valueA) * 100;
        let category;
        if (changeRate > 5) category = 'increase';
        else if (changeRate < -5) category = 'decrease';
        else category = 'maintain';
        
        // 필터링 조건 확인: 슬라이더는 항상 재배면적 기준으로 필터링
        // "최소 재배면적" 필터는 현재(B년도) 재배면적 기준으로 적용
        if (filterValue > 0) {
            const areaB = cropB.area || 0; // 항상 재배면적으로 필터링
            if (areaB < filterValue) {
                return; // 필터 조건을 만족하지 않으면 제외
            }
        }
        
        // 데이터 유효성 검증
        if (!cropName || cropName === undefined || cropName === null) {
            return;
        }
        
        
        // 작목군 분류 (이미 cropGroup 변수가 있으므로 기존 값 사용)
        const actualCropGroup = cropGroup || '기타';
        let groupKey;
        if (cropGroup.includes('식량')) groupKey = 'grain';
        else if (cropGroup.includes('채소')) groupKey = 'vegetable';
        else if (cropGroup.includes('과수')) groupKey = 'fruit';
        else if (cropGroup.includes('특약') || cropGroup.includes('특용')) groupKey = 'special';
        else groupKey = 'special'; // 기타는 특약용으로 분류
        
        results[category][groupKey].push({
            name: cropName,
            valueA,
            valueB,
            changeRate,
            cropGroup
        });
        results[category].total++;
    });
    
    
    // 원본 함수와 동일한 구조로 변환 (배열로)
    const convertToArray = (category) => {
        const allCrops = [
            ...category.grain,
            ...category.vegetable,
            ...category.fruit,
            ...category.special
        ];
        return allCrops;
    };
    
    const formattedResults = {
        increase: convertToArray(results.increase),
        maintain: convertToArray(results.maintain),
        decrease: convertToArray(results.decrease)
    };
    
    
    // updateCultivationTrendTable이 기대하는 구조로 변환
    return {
        area: formattedResults,
        composition: formattedResults
    };
}

// ========== 순위분석 기능 ==========

// 순위분석 초기화
function initRankingSection() {
    setupRankingControls();
    initRankingEventListeners();
}

// 순위분석 컨트롤 설정
function setupRankingControls() {
    const year1Select = document.getElementById('ranking-year-1');
    const year2Select = document.getElementById('ranking-year-2');
    
    if (year1Select && year2Select && appState.data.processed.years) {
        const availableYears = [...appState.data.processed.years].sort((a, b) => a - b);
        
        // 년도 옵션 추가
        [year1Select, year2Select].forEach(select => {
            select.innerHTML = '';
            availableYears.forEach(year => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year + '년';
                select.appendChild(option);
            });
        });
        
        // 기본값 설정 (첫 번째 연도와 마지막 연도)
        if (availableYears.length >= 2) {
            year1Select.value = availableYears[0];
            year2Select.value = availableYears[availableYears.length - 1];
        }
        
    }
}

// 순위분석 이벤트 리스너
function initRankingEventListeners() {
    const year1Select = document.getElementById('ranking-year-1');
    const year2Select = document.getElementById('ranking-year-2');
    const metricSelect = document.getElementById('ranking-metric');
    
    [year1Select, year2Select, metricSelect].forEach(select => {
        if (select) {
            select.addEventListener('change', updateRankingTables);
        }
    });
    
}

// 순위분석 테이블 업데이트
function updateRankingTables() {
    const year1 = parseInt(document.getElementById('ranking-year-1')?.value);
    const year2 = parseInt(document.getElementById('ranking-year-2')?.value);
    const metric = document.getElementById('ranking-metric')?.value || 'area';
    
    if (!year1 || !year2) {
        return;
    }
    
    
    // 헤더 업데이트
    updateRankingHeaders(year1, year2, metric);
    
    // 각 테이블 데이터 생성 및 업데이트
    updateNationalRankingTable(year1, year2, metric);
    updateGangwonRankingTable(year1, year2, metric);
    updateShareRankingTable(year1, year2, metric);
}

// 순위분석 헤더 업데이트
function updateRankingHeaders(year1, year2, metric) {
    const metricText = metric === 'area' ? '재배면적' : '생산량';
    const unit = metric === 'area' ? 'ha' : '톤';
    
    // 테이블 제목 업데이트
    document.getElementById('national-ranking-title').textContent = `전국 ${metricText} 순위`;
    document.getElementById('gangwon-ranking-title').textContent = `강원 ${metricText} 순위`;
    document.getElementById('share-ranking-title').textContent = '전국대비 점유율 순위';
    
    // 헤더 연도 업데이트
    ['national', 'gangwon', 'share'].forEach(prefix => {
        document.getElementById(`${prefix}-year1-header`).textContent = `${year1}년`;
        document.getElementById(`${prefix}-year2-header`).textContent = `${year2}년`;
    });
    
    // 값 헤더 업데이트
    ['national', 'gangwon'].forEach(prefix => {
        document.getElementById(`${prefix}-value1-header`).textContent = `${metricText} (${unit})`;
        document.getElementById(`${prefix}-value2-header`).textContent = `${metricText} (${unit})`;
    });
    
    // 필터 안내문구 업데이트
    const filterText = `${year2}년값 전국 기준 재배면적 100ha 이상`;
    document.getElementById('ranking-filter-text').textContent = filterText;
}

// 전국 순위 테이블 업데이트
function updateNationalRankingTable(year1, year2, metric) {
    const data1 = getRankedData(year1, '전국', metric);
    const data2 = getRankedData(year2, '전국', metric);
    const tbody = document.getElementById('national-ranking-tbody');
    
    renderRankingTableBody(tbody, data1, data2, metric, 50);
}

// 강원 순위 테이블 업데이트
function updateGangwonRankingTable(year1, year2, metric) {
    const data1 = getRankedData(year1, '강원', metric);
    const data2 = getRankedData(year2, '강원', metric);
    const tbody = document.getElementById('gangwon-ranking-tbody');
    
    renderRankingTableBody(tbody, data1, data2, metric, 50);
}

// 점유율 순위 테이블 업데이트
function updateShareRankingTable(year1, year2, metric) {
    const shareData1 = getShareRankedData(year1, metric);
    const shareData2 = getShareRankedData(year2, metric);
    const tbody = document.getElementById('share-ranking-tbody');
    
    renderShareRankingTableBody(tbody, shareData1, shareData2, 50);
}

// 순위 데이터 생성
function getRankedData(year, region, metric) {
    // 숫자 필드 안전 변환
    const safeParseNumber = (value) => {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        return parseFloat(value.toString().replace(/,/g, '').replace(/[^\d.-]/g, '')) || 0;
    };

    const data = appState.data.raw.filter(row =>
        row['연도'] == year && row['지역'] === region
    );

    // 전국 기준 재배면적 100ha 이상 필터링을 위해 전국 데이터도 가져오기
    const year2 = parseInt(document.getElementById('ranking-year-2')?.value);
    const nationalDataForFilter = appState.data.raw.filter(row =>
        row['연도'] == year2 && row['지역'] === '전국'
    );

    const result = data
        .map(row => ({
            cropName: row['작목명'],
            cropGroup: row['작목군'],
            value: metric === 'area' ? safeParseNumber(row['면적(ha)']) : safeParseNumber(row['생산량(톤)'])
        }))
        .filter(item => {
            // 값이 0보다 큰지 확인
            if (item.value <= 0) return false;

            // 해당 작목이 선택연도 2의 전국 기준으로 재배면적 100ha 이상인지 확인
            const nationalCrop = nationalDataForFilter.find(row =>
                row['작목명'] === item.cropName && row['작목군'] === item.cropGroup
            );
            const nationalArea = nationalCrop ? safeParseNumber(nationalCrop['면적(ha)']) : 0;

            return nationalArea >= 100;
        })
        .sort((a, b) => b.value - a.value)
        .map((item, index) => ({
            ...item,
            rank: index + 1
        }));

    return result;
}

// 점유율 순위 데이터 생성
function getShareRankedData(year, metric) {
    // 숫자 필드 안전 변환
    const safeParseNumber = (value) => {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        return parseFloat(value.toString().replace(/,/g, '').replace(/[^\d.-]/g, '')) || 0;
    };

    const nationalData = appState.data.raw.filter(row =>
        row['연도'] == year && row['지역'] === '전국'
    );
    const gangwonData = appState.data.raw.filter(row =>
        row['연도'] == year && row['지역'] === '강원'
    );

    // 전국 기준 재배면적 100ha 이상 필터링을 위해 선택연도 2의 전국 데이터도 가져오기
    const year2 = parseInt(document.getElementById('ranking-year-2')?.value);
    const nationalDataForFilter = appState.data.raw.filter(row =>
        row['연도'] == year2 && row['지역'] === '전국'
    );

    const shareData = [];

    gangwonData.forEach(gangwonRow => {
        const nationalRow = nationalData.find(row =>
            row['작목명'] === gangwonRow['작목명'] && row['작목군'] === gangwonRow['작목군']
        );
        if (nationalRow) {
            const gangwonValue = metric === 'area' ? safeParseNumber(gangwonRow['면적(ha)']) : safeParseNumber(gangwonRow['생산량(톤)']);
            const nationalValue = metric === 'area' ? safeParseNumber(nationalRow['면적(ha)']) : safeParseNumber(nationalRow['생산량(톤)']);

            if (nationalValue > 0 && gangwonValue > 0) {
                // 해당 작목이 선택연도 2의 전국 기준으로 재배면적 100ha 이상인지 확인
                const nationalCropForFilter = nationalDataForFilter.find(row =>
                    row['작목명'] === gangwonRow['작목명'] && row['작목군'] === gangwonRow['작목군']
                );
                const nationalAreaForFilter = nationalCropForFilter ? safeParseNumber(nationalCropForFilter['면적(ha)']) : 0;

                if (nationalAreaForFilter >= 100) {
                    const shareRate = (gangwonValue / nationalValue) * 100;
                    shareData.push({
                        cropName: gangwonRow['작목명'],
                        cropGroup: gangwonRow['작목군'],
                        shareRate: shareRate
                    });
                }
            }
        }
    });
    
    return shareData
        .sort((a, b) => b.shareRate - a.shareRate)
        .map((item, index) => ({
            ...item,
            rank: index + 1
        }));
}

// 순위 테이블 바디 렌더링
function renderRankingTableBody(tbody, data1, data2, metric, maxRows = 50) {
    tbody.innerHTML = '';
    
    // 두 연도의 모든 작목 수집 (작목군+작목명 조합으로)
    const allCrops = new Set([
        ...data1.map(item => `${item.cropGroup || '기타'}|${item.cropName}`),
        ...data2.map(item => `${item.cropGroup || '기타'}|${item.cropName}`)
    ]);
    
    // data2 기준으로 정렬하여 최대 maxRows개만 표시
    const cropList = Array.from(allCrops)
        .map(cropKey => {
            const [cropGroup, cropName] = cropKey.split('|');
            const item1 = data1.find(item => item.cropName === cropName && (item.cropGroup || '기타') === cropGroup);
            const item2 = data2.find(item => item.cropName === cropName && (item.cropGroup || '기타') === cropGroup);
            return {
                cropName,
                data1: item1 || { value: 0, rank: '-' },
                data2: item2 || { value: 0, rank: '-' }
            };
        })
        .sort((a, b) => {
            const aValue = typeof a.data2.value === 'number' ? a.data2.value : 0;
            const bValue = typeof b.data2.value === 'number' ? b.data2.value : 0;
            return bValue - aValue;
        })
        .slice(0, maxRows);
    
    cropList.forEach(({ cropName, data1: item1, data2: item2 }) => {
        const row = document.createElement('tr');
        
        const unit = metric === 'area' ? 'ha' : '톤';
        const value1 = (typeof item1.value === 'number' && !isNaN(item1.value)) ? Math.round(item1.value).toLocaleString() : '-';
        const value2 = (typeof item2.value === 'number' && !isNaN(item2.value)) ? Math.round(item2.value).toLocaleString() : '-';
        
        row.innerHTML = `
            <td title="${cropName}">${cropName}</td>
            <td class="value-cell">${value1}</td>
            <td class="rank-cell ${getRankClass(item1.rank)}">${item1.rank}</td>
            <td class="value-cell">${value2}</td>
            <td class="rank-cell ${getRankClass(item2.rank)}">${item2.rank}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// 점유율 테이블 바디 렌더링
function renderShareRankingTableBody(tbody, data1, data2, maxRows = 50) {
    tbody.innerHTML = '';
    
    // 두 연도의 모든 작목 수집 (작목군+작목명 조합으로)
    const allCrops = new Set([
        ...data1.map(item => `${item.cropGroup || '기타'}|${item.cropName}`),
        ...data2.map(item => `${item.cropGroup || '기타'}|${item.cropName}`)
    ]);
    
    // data2 기준으로 정렬하여 최대 maxRows개만 표시
    const cropList = Array.from(allCrops)
        .map(cropKey => {
            const [cropGroup, cropName] = cropKey.split('|');
            const item1 = data1.find(item => item.cropName === cropName && (item.cropGroup || '기타') === cropGroup);
            const item2 = data2.find(item => item.cropName === cropName && (item.cropGroup || '기타') === cropGroup);
            return {
                cropName,
                data1: item1 || { shareRate: 0, rank: '-' },
                data2: item2 || { shareRate: 0, rank: '-' }
            };
        })
        .sort((a, b) => {
            const aValue = typeof a.data2.shareRate === 'number' ? a.data2.shareRate : 0;
            const bValue = typeof b.data2.shareRate === 'number' ? b.data2.shareRate : 0;
            return bValue - aValue;
        })
        .slice(0, maxRows);
    
    cropList.forEach(({ cropName, data1: item1, data2: item2 }) => {
        const row = document.createElement('tr');
        
        const share1 = (typeof item1.shareRate === 'number' && !isNaN(item1.shareRate)) ? item1.shareRate.toFixed(2) : '-';
        const share2 = (typeof item2.shareRate === 'number' && !isNaN(item2.shareRate)) ? item2.shareRate.toFixed(2) : '-';
        
        row.innerHTML = `
            <td title="${cropName}">${cropName}</td>
            <td class="value-cell">${share1 !== '-' ? share1 + '%' : '-'}</td>
            <td class="rank-cell ${getRankClass(item1.rank)}">${item1.rank}</td>
            <td class="value-cell">${share2 !== '-' ? share2 + '%' : '-'}</td>
            <td class="rank-cell ${getRankClass(item2.rank)}">${item2.rank}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// 순위에 따른 CSS 클래스 반환
function getRankClass(rank) {
    if (rank === 1) return 'rank-1';
    if (rank === 2) return 'rank-2';
    if (rank === 3) return 'rank-3';
    if (rank === 4) return 'rank-4';
    if (rank === 5) return 'rank-5';
    return '';
}

// 순위분석 섹션이 표시될 때 초기화
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (appState.data.raw && appState.data.raw.length > 0) {
            initRankingSection();
            initSpecializationSection();
        } else {
            setTimeout(() => {
                initRankingSection();
                initSpecializationSection();
            }, 3000);
        }
    }, 1000);
});

// ========== 특화계수 기능 ==========

// 특화계수 초기화
function initSpecializationSection() {
    setupSpecializationControls();
    initSpecializationEventListeners();
}

// 특화계수 컨트롤 설정
function setupSpecializationControls() {
    const yearSelect = document.getElementById('specialization-year');
    
    if (yearSelect && appState.data.processed.years) {
        const availableYears = [...appState.data.processed.years].sort((a, b) => b - a);
        
        // 년도 옵션 추가
        yearSelect.innerHTML = '';
        availableYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year + '년';
            yearSelect.appendChild(option);
        });
        
        // 기본값 설정 (최신 연도)
        if (availableYears.length > 0) {
            yearSelect.value = availableYears[0];
        }
        
    }
}

// 특화계수 이벤트 리스너
function initSpecializationEventListeners() {
    const yearSelect = document.getElementById('specialization-year');
    const metricSelect = document.getElementById('specialization-metric');
    const thresholdSelect = document.getElementById('coefficient-threshold');
    
    [yearSelect, metricSelect, thresholdSelect].forEach(select => {
        if (select) {
            select.addEventListener('change', updateSpecializationAnalysis);
        }
    });
    
}

// 특화계수 분석 업데이트
function updateSpecializationAnalysis() {
    const year = parseInt(document.getElementById('specialization-year')?.value);
    const metric = document.getElementById('specialization-metric')?.value || 'area';
    const threshold = parseFloat(document.getElementById('coefficient-threshold')?.value || '1');
    
    if (!year) {
        return;
    }
    
    
    // 특화계수 데이터 계산
    const specializationData = calculateSpecializationCoefficients(year, metric);
    
    if (specializationData && specializationData.length > 0) {
        // 전국 기준 100ha 이상 필터링된 데이터 생성
        const filteredData = filterSpecializationByNationalArea(specializationData, year);
        
        // threshold가 -1이면 전체 데이터(100ha미만 포함) 사용, 아니면 필터링된 데이터 사용
        const tableData = threshold === -1 ? specializationData : filteredData;
        
        // KPI 업데이트 (필터링된 데이터 사용)
        updateSpecializationKPIs(filteredData);
        
        // 테이블 업데이트 (threshold에 따라 데이터 선택)
        updateSpecializationTable(tableData, threshold === -1 ? 0 : threshold);
        
        // 차트 업데이트 (필터링된 데이터 사용)
        // updateSpecializationChart(filteredData, metric);
        
        // 특화계수 분류 기준별 현황 업데이트 (전체 데이터 사용)
        updateSpecializationGradeStatus(specializationData);
        
        // 작목군별 분석 업데이트 (threshold에 따라 데이터 선택)
        updateCropGroupSpecialization(tableData);
        
        // 헤더 업데이트 (측정항목에 따라)
        updateSpecializationHeaders(metric);
        
    } else {
    }
}

// 특화계수 헤더 업데이트 함수
function updateSpecializationHeaders(metric) {
    const metricText = metric === 'area' ? '재배면적' : '생산량';
    
    // 1. specialization-grade-status 헤더 업데이트
    const gradeStatusTitle = document.querySelector('.specialization-grade-status .section-title h3');
    if (gradeStatusTitle) {
        gradeStatusTitle.innerHTML = `<i class="fas fa-chart-bar"></i> 특화계수 분류 기준별 현황(${metricText})`;
    }
    
    // 2. crop-group-specialization 헤더 업데이트
    const cropGroupTitle = document.querySelector('.crop-group-specialization .section-title h3');
    if (cropGroupTitle) {
        cropGroupTitle.innerHTML = `<i class="fas fa-layer-group"></i> 작목군별 특화 현황(${metricText})`;
    }
    
    // 3. specialization-table-card 헤더 업데이트
    const tableTitle = document.getElementById('specialization-table-title');
    if (tableTitle) {
        tableTitle.textContent = `특화작목 상세(${metricText})`;
    }
    
}

// 특화계수 분류 기준별 현황 업데이트
function updateSpecializationGradeStatus(specializationData) {
    if (!specializationData || specializationData.length === 0) {
        return;
    }
    
    // 100ha 이상 작목만 필터링 (전국 기준 재배면적)
    const filteredData = specializationData.filter(item => {
        // nationalValue가 ha 단위로 저장되어 있다고 가정
        return item.nationalValue >= 100;
    });
    
    
    // 특화계수에 따른 분류 (interpretation-section 기준과 일치)
    const highGradeCrops = filteredData.filter(item => item.coefficient >= 3.0); // 고도특화: 3.0 이상
    const mediumGradeCrops = filteredData.filter(item => item.coefficient >= 2.0 && item.coefficient < 3.0); // 고특화: 2.0~2.9
    const basicGradeCrops = filteredData.filter(item => item.coefficient >= 1.2 && item.coefficient < 2.0); // 특화: 1.2~1.9
    const normalGradeCrops = filteredData.filter(item => item.coefficient < 1.2); // 일반: 1.2 미만
    
    // 개수 업데이트
    const highCountElement = document.getElementById('high-grade-count');
    const mediumCountElement = document.getElementById('medium-grade-count');
    const basicCountElement = document.getElementById('basic-grade-count');
    const normalCountElement = document.getElementById('normal-grade-count');
    
    if (highCountElement) highCountElement.textContent = `${highGradeCrops.length}개`;
    if (mediumCountElement) mediumCountElement.textContent = `${mediumGradeCrops.length}개`;
    if (basicCountElement) basicCountElement.textContent = `${basicGradeCrops.length}개`;
    if (normalCountElement) normalCountElement.textContent = `${normalGradeCrops.length}개`;
    
    // 작목 목록 업데이트
    updateGradeCropList('high-grade-crops', highGradeCrops);
    updateGradeCropList('medium-grade-crops', mediumGradeCrops);
    updateGradeCropList('basic-grade-crops', basicGradeCrops);
    updateGradeCropList('normal-grade-crops', normalGradeCrops);
    
}

// 분류별 작목 목록 업데이트
function updateGradeCropList(containerId, crops) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (crops.length === 0) {
        container.innerHTML = '<div class="no-crops">해당 분류의 작목이 없습니다.</div>';
        return;
    }
    
    crops.forEach(crop => {
        const cropItem = document.createElement('div');
        cropItem.className = 'crop-item';
        cropItem.textContent = crop.cropName;
        cropItem.title = `특화계수: ${crop.coefficient.toFixed(1)}`;
        container.appendChild(cropItem);
    });
}

// 특화계수 계산
function calculateSpecializationCoefficients(year, metric) {
    
    // 전국 데이터와 강원 데이터 가져오기
    const nationalData = appState.data.raw.filter(row => 
        row.year == year && row.region === '전국'
    );
    const gangwonData = appState.data.raw.filter(row => 
        row.year == year && row.region === '강원'
    );
    
    
    if (nationalData.length === 0 || gangwonData.length === 0) {
        return [];
    }
    
    // 전국 및 강원 총합 계산
    const nationalTotal = nationalData.reduce((sum, row) => {
        const value = metric === 'area' ? (row.area || 0) : (row.production || 0);
        return sum + value;
    }, 0);
    
    const gangwonTotal = gangwonData.reduce((sum, row) => {
        const value = metric === 'area' ? (row.area || 0) : (row.production || 0);
        return sum + value;
    }, 0);
    
    
    const specializationData = [];
    
    // 강원 데이터를 기준으로 특화계수 계산
    gangwonData.forEach(gangwonRow => {
        const nationalRow = nationalData.find(row => 
            row.cropName === gangwonRow.cropName && row.cropGroup === gangwonRow.cropGroup
        );
        
        if (nationalRow) {
            const gangwonValue = metric === 'area' ? (gangwonRow['면적(ha)'] || 0) : (gangwonRow['생산량(톤)'] || 0);
            const nationalValue = metric === 'area' ? (nationalRow['면적(ha)'] || 0) : (nationalRow['생산량(톤)'] || 0);
            
            if (gangwonValue > 0 && nationalValue > 0 && gangwonTotal > 0 && nationalTotal > 0) {
                // 비중 계산
                const gangwonShare = (gangwonValue / gangwonTotal) * 100;
                const nationalShare = (nationalValue / nationalTotal) * 100;
                
                // 특화계수 계산: (강원 비중) / (전국 비중)
                const coefficient = nationalShare > 0 ? (gangwonShare / nationalShare) : 0;
                
                if (coefficient > 0) {
                    specializationData.push({
                        cropName: gangwonRow.cropName,
                        cropGroup: gangwonRow.cropGroup || '기타',
                        coefficient: coefficient,
                        gangwonShare: gangwonShare,
                        nationalShare: nationalShare,
                        gangwonValue: gangwonValue,
                        nationalValue: nationalValue,
                        grade: getSpecializationGrade(coefficient)
                    });
                }
            }
        }
    });
    
    // 특화계수 순으로 정렬
    specializationData.sort((a, b) => b.coefficient - a.coefficient);

    return specializationData;
}

// 전국 기준 재배면적 100ha 이상 필터링
function filterSpecializationByNationalArea(specializationData, year) {
    
    // 해당 연도의 전국 데이터 가져오기
    const nationalData = appState.data.raw.filter(row => 
        row.year == year && row.region === '전국'
    );
    
    const filteredData = specializationData.filter(item => {
        const nationalCrop = nationalData.find(row => 
            row.cropName === item.cropName && row.cropGroup === item.cropGroup
        );
        const nationalArea = nationalCrop ? (nationalCrop.area || 0) : 0;
        
        const isFiltered = nationalArea >= 100;
        
        if (!isFiltered) {
        }
        
        return isFiltered;
    });
    
    
    return filteredData;
}

// 특화등급 결정
function getSpecializationGrade(coefficient) {
    if (coefficient >= 3.0) return { level: 'high', label: '고도특화' };
    if (coefficient >= 2.0) return { level: 'medium', label: '고특화' };
    if (coefficient >= 1.2) return { level: 'basic', label: '특화' };
    return { level: 'none', label: '일반' };
}

// KPI 업데이트
function updateSpecializationKPIs(data) {
    const ultraSpecializedCrops = data.filter(item => item.coefficient >= 3.0);  // 고도특화 3.0↑
    const highSpecializedCrops = data.filter(item => item.coefficient >= 2.0 && item.coefficient < 3.0);  // 고특화 2.0-2.9
    const specializedCrops = data.filter(item => item.coefficient >= 1.2 && item.coefficient < 2.0);  // 특화 1.2-1.9
    const normalCrops = data.filter(item => item.coefficient < 1.2);  // 일반 1.2 미만
    
    document.getElementById('ultra-specialized-count').textContent = ultraSpecializedCrops.length;
    document.getElementById('high-specialized-count').textContent = highSpecializedCrops.length;
    document.getElementById('specialized-count').textContent = specializedCrops.length;
    document.getElementById('normal-count').textContent = normalCrops.length;
}

// 특화계수 테이블 업데이트
function updateSpecializationTable(data, threshold) {
    const tbody = document.getElementById('specialization-table-body');
    tbody.innerHTML = '';
    
    const filteredData = data.filter(item => item.coefficient >= threshold);
    
    filteredData.forEach((item, index) => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td class="crop-name">${item.cropName}</td>
            <td>${item.cropGroup}</td>
            <td class="coefficient">${item.coefficient.toFixed(1)}</td>
            <td>${item.gangwonShare.toFixed(2)}</td>
            <td>${item.nationalShare.toFixed(2)}</td>
            <td><span class="grade-${item.grade.level}">${item.grade.label}</span></td>
        `;
        
        tbody.appendChild(row);
    });
    
}

// 특화계수 차트 업데이트
function updateSpecializationChart(data, metric) {
    const canvas = document.getElementById('specialization-chart');
    const ctx = canvas.getContext('2d');
    
    // 기존 차트 제거
    if (window.specializationChart) {
        window.specializationChart.destroy();
    }
    
    // 상위 20개 작목만 표시
    const topCrops = data.slice(0, 20);
    
    const metricText = metric === 'area' ? '재배면적' : '생산량';
    
    window.specializationChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: '특화계수',
                data: topCrops.map(item => ({
                    x: item.nationalShare,
                    y: item.coefficient,
                    cropName: item.cropName,
                    cropGroup: item.cropGroup
                })),
                backgroundColor: topCrops.map(item => {
                    if (item.coefficient >= 3.0) return 'rgba(220, 38, 38, 0.7)';
                    if (item.coefficient >= 2.0) return 'rgba(234, 88, 12, 0.7)';
                    if (item.coefficient >= 1.2) return 'rgba(5, 150, 105, 0.7)';
                    return 'rgba(107, 114, 128, 0.7)';
                }),
                borderColor: topCrops.map(item => {
                    if (item.coefficient >= 3.0) return 'rgba(220, 38, 38, 1)';
                    if (item.coefficient >= 2.0) return 'rgba(234, 88, 12, 1)';
                    if (item.coefficient >= 1.2) return 'rgba(5, 150, 105, 1)';
                    return 'rgba(107, 114, 128, 1)';
                }),
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `${metricText} 기준 특화계수 분포 (상위 20개 작목)`
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const point = context.raw;
                            return [
                                `작목: ${point.cropName}`,
                                `작목군: ${point.cropGroup}`,
                                `전국 비중: ${context.parsed.x.toFixed(2)}%`,
                                `특화계수: ${context.parsed.y.toFixed(1)}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: `전국 ${metricText} 비중 (%)`
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: '특화계수'
                    },
                    min: 0
                }
            }
        }
    });
    
    // 타이틀 업데이트
    document.getElementById('specialization-chart-title').textContent = `${metricText} 특화계수 분포`;
    document.getElementById('specialization-table-title').textContent = `${metricText} 특화작목 상세`;
}

// 작목군별 특화 현황 업데이트
function updateCropGroupSpecialization(data) {
    const specializedData = data.filter(item => item.coefficient >= 1.2);
    
    const groups = {
        '식량': { key: 'grain', crops: [] },
        '채소': { key: 'vegetable', crops: [] },
        '과수': { key: 'fruit', crops: [] },
        '특약용작물': { key: 'special', crops: [] }
    };
    
    specializedData.forEach(item => {
        const group = groups[item.cropGroup];
        if (group) {
            group.crops.push(item);
        }
    });
    
    Object.keys(groups).forEach(groupName => {
        const group = groups[groupName];
        const countElement = document.getElementById(`${group.key}-specialized-count`);
        const contentElement = document.getElementById(`${group.key}-specialized-crops`);
        
        if (countElement && contentElement) {
            countElement.textContent = `${group.crops.length}개`;
            
            contentElement.innerHTML = '';
            
            group.crops
                .sort((a, b) => b.coefficient - a.coefficient)
                .forEach(crop => {
                    const tag = document.createElement('div');
                    tag.className = 'specialized-crop-tag';
                    
                    // specialization-table과 동일한 클래스 체계 사용
                    if (crop.coefficient >= 3.0) {
                        tag.classList.add('grade-high');
                    } else if (crop.coefficient >= 2.0) {
                        tag.classList.add('grade-medium');
                    } else if (crop.coefficient >= 1.2) {
                        tag.classList.add('grade-basic');
                    }
                    
                    tag.textContent = `${crop.cropName} (${crop.coefficient.toFixed(1)})`;
                    tag.title = `특화계수: ${crop.coefficient.toFixed(1)}`;
                    
                    contentElement.appendChild(tag);
                });
            
            if (group.crops.length === 0) {
                contentElement.innerHTML = '<div class="no-specialized-crops">특화작목 없음</div>';
            }
        }
    });
}

// ========== 데이터 테이블 관련 함수 ==========

// 데이터 테이블 필터 초기화
function initializeDataTableFilters() {
    
    // 데이터가 로드되지 않았으면 초기화하지 않음
    if (!appState.data.raw || appState.data.raw.length === 0) {
        return;
    }
    
    // 연도 필터 초기화
    const yearFromSelect = document.getElementById('year-from');
    const yearToSelect = document.getElementById('year-to');
    
    if (yearFromSelect && yearToSelect && appState.data.processed.years) {
        // 사용 가능한 연도 목록 생성
        const availableYears = [...appState.data.processed.years].sort((a, b) => a - b);
        
        yearFromSelect.innerHTML = '<option value="">시작년도</option>';
        yearToSelect.innerHTML = '<option value="">종료년도</option>';
        
        availableYears.forEach(year => {
            yearFromSelect.innerHTML += `<option value="${year}">${year}년</option>`;
            yearToSelect.innerHTML += `<option value="${year}">${year}년</option>`;
        });
    }
    
    // 작목군 필터 초기화
    const cropGroupFilter = document.getElementById('crop-group-filter');
    if (cropGroupFilter && appState.data.processed.cropGroups) {
        cropGroupFilter.innerHTML = '<option value="all">전체 선택</option>';
        
        appState.data.processed.cropGroups.forEach(group => {
            cropGroupFilter.innerHTML += `<option value="${group}">${group}</option>`;
        });
    }
}

// 데이터 테이블 데이터 로드
async function loadDataTableData() {
    
    try {
        // 데이터가 로드되지 않았으면 로딩하지 않음
        if (!appState.data.raw || appState.data.raw.length === 0) {
            return;
        }
        
        // appState.data.raw를 테이블 형태로 직접 사용 (모든 지역 포함)
        const flatData = appState.data.raw
            .map(row => ({
                year: row.year,
                cropGroup: row.cropGroup || row['작목군'] || row.crop_group || '',
                cropName: row.cropName || row['작목명'] || row.crop_name || '',
                region: row.region || row['지역'] || '',
                area: parseFloat(row.area || row['재배면적'] || 0),
                production: parseFloat(row.production || row['생산량'] || 0)
            }));
        
        // 전역 변수로 저장
        window.tableData = flatData;

        // region-filter 옵션 설정
        setupRegionFilter(flatData);

        // 통계 업데이트
        updateDataTableStats(flatData.length, flatData.length);

        // 테이블 렌더링
        renderDataTableRows(flatData);


    } catch (error) {
    }
}

// region-filter 옵션 설정
function setupRegionFilter(data) {
    const regionFilter = document.getElementById('region-filter');
    if (!regionFilter) return;

    // 데이터에서 고유한 지역 추출
    const uniqueRegions = [...new Set(data.map(row => row.region))]
        .filter(region => region && region.trim() !== '') // 빈 값 제거
        .sort(); // 가나다 순 정렬

    // 기존 옵션 제거 (전체 옵션 제외)
    const allOption = regionFilter.querySelector('option[value="all"]');
    regionFilter.innerHTML = '';

    // 전체 옵션 추가
    if (allOption) {
        regionFilter.appendChild(allOption);
    } else {
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = '전체 지역';
        regionFilter.appendChild(allOption);
    }

    // 지역 옵션들 추가
    uniqueRegions.forEach(region => {
        const option = document.createElement('option');
        option.value = region;
        option.textContent = region;
        regionFilter.appendChild(option);
    });
}

// 데이터 테이블 행 렌더링
function renderDataTableRows(data, page = 1) {
    const tbody = document.getElementById('table-body');
    const pageSize = parseInt(document.getElementById('page-size')?.value || '25');
    
    if (!tbody) {
        return;
    }
    
    // 페이지네이션 계산
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageData = data.slice(startIndex, endIndex);
    
    // 테이블 행 생성 (헤더 위치 유지를 위해 부드럽게 업데이트)
    // 스크롤 위치 저장
    const tableWrapper = document.querySelector('.table-wrapper');
    const scrollTop = tableWrapper ? tableWrapper.scrollTop : 0;
    
    // 기존 내용 제거
    while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
    }
    
    pageData.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.year}</td>
            <td>${row.cropGroup}</td>
            <td>${row.cropName}</td>
            <td>${row.region}</td>
            <td class="numeric">${Number(row.area).toLocaleString()}</td>
            <td class="numeric">${Number(row.production).toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
    });
    
    // 스크롤 위치 복원 (약간의 지연을 둬서 DOM이 안정화된 후)
    if (tableWrapper && scrollTop > 0) {
        requestAnimationFrame(() => {
            tableWrapper.scrollTop = scrollTop;
        });
    }
    
    // 페이지네이션 업데이트
    updateDataTablePagination(data.length, page, pageSize);
    
}

// 데이터 테이블 통계 업데이트
function updateDataTableStats(totalRecords, filteredRecords) {
    const totalElement = document.getElementById('total-records');
    const filteredElement = document.getElementById('filtered-records');
    
    if (totalElement) totalElement.textContent = totalRecords.toLocaleString();
    if (filteredElement) filteredElement.textContent = filteredRecords.toLocaleString();
}

// 데이터 테이블 페이지네이션 업데이트
function updateDataTablePagination(totalRecords, currentPage, pageSize) {
    const paginationElement = document.getElementById('pagination');
    const showingElement = document.getElementById('showing-records');
    
    if (!paginationElement) return;
    
    const totalPages = Math.ceil(totalRecords / pageSize);
    const startRecord = (currentPage - 1) * pageSize + 1;
    const endRecord = Math.min(currentPage * pageSize, totalRecords);
    
    // 표시 중인 레코드 업데이트
    if (showingElement) {
        showingElement.textContent = `${startRecord}-${endRecord}`;
    }
    
    // 페이지네이션 버튼 생성
    paginationElement.innerHTML = '';
    
    if (totalPages > 1) {
        // 이전 버튼
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '이전';
        prevBtn.disabled = currentPage === 1;
        prevBtn.onclick = () => {
            const filteredData = getFilteredTableData();
            renderDataTableRows(filteredData, currentPage - 1);
        };
        paginationElement.appendChild(prevBtn);
        
        // 페이지 번호 버튼들
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                const pageBtn = document.createElement('button');
                pageBtn.textContent = i;
                pageBtn.className = i === currentPage ? 'active' : '';
                pageBtn.onclick = () => {
                    const filteredData = getFilteredTableData();
                    renderDataTableRows(filteredData, i);
                };
                paginationElement.appendChild(pageBtn);
            } else if (i === currentPage - 3 || i === currentPage + 3) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                paginationElement.appendChild(ellipsis);
            }
        }
        
        // 다음 버튼
        const nextBtn = document.createElement('button');
        nextBtn.textContent = '다음';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.onclick = () => {
            const filteredData = getFilteredTableData();
            renderDataTableRows(filteredData, currentPage + 1);
        };
        paginationElement.appendChild(nextBtn);
    }
}

// 데이터 테이블 이벤트 리스너 설정
function setupDataTableEventListeners() {
    
    // 페이지 크기 변경
    const pageSizeSelect = document.getElementById('page-size');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', () => {
            applyDataTableFilters();
        });
    }
    
    // 빠른 검색
    const quickSearch = document.getElementById('quick-search');
    if (quickSearch) {
        quickSearch.addEventListener('input', () => {
            applyDataTableFilters();
        });
    }
    
    // 고급 필터 토글
    const advancedFilterBtn = document.getElementById('advanced-filter');
    const filterPanel = document.getElementById('filterPanel');
    if (advancedFilterBtn && filterPanel) {
        advancedFilterBtn.addEventListener('click', () => {
            const isHidden = filterPanel.style.display === 'none' || !filterPanel.style.display;
            filterPanel.style.display = isHidden ? 'block' : 'none';
        });
    }
    
    // 필터 적용 및 초기화 버튼
    const applyFiltersBtn = document.getElementById('apply-filters');
    const clearFiltersBtn = document.getElementById('clear-filters');
    
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            applyDataTableFilters();
            // 필터 패널 닫기
            if (filterPanel) {
                filterPanel.style.display = 'none';
            }
        });
    }
    
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearDataTableFilters);
    }
    
    // 엑셀 내보내기 버튼
    const exportExcelBtn = document.getElementById('export-excel');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', exportToExcel);
    }
    
    // 고급 필터는 실시간 적용하지 않고 버튼 클릭 시에만 적용하도록 변경
    // (빠른 검색과 페이지 크기는 실시간 유지)
}

// 데이터 테이블 필터 적용
function applyDataTableFilters() {
    if (!window.tableData) return;
    
    
    let filteredData = [...window.tableData];
    
    // 빠른 검색
    const quickSearchTerm = document.getElementById('quick-search')?.value?.toLowerCase() || '';
    if (quickSearchTerm) {
        filteredData = filteredData.filter(row => 
            row.cropName.toLowerCase().includes(quickSearchTerm) ||
            row.cropGroup.toLowerCase().includes(quickSearchTerm) ||
            row.region.toLowerCase().includes(quickSearchTerm)
        );
    }
    
    // 연도 범위 필터
    const yearFrom = document.getElementById('year-from')?.value;
    const yearTo = document.getElementById('year-to')?.value;
    
    if (yearFrom) {
        filteredData = filteredData.filter(row => parseInt(row.year) >= parseInt(yearFrom));
    }
    if (yearTo) {
        filteredData = filteredData.filter(row => parseInt(row.year) <= parseInt(yearTo));
    }
    
    // 지역 필터
    const regionFilter = document.getElementById('region-filter')?.value;
    if (regionFilter && regionFilter !== 'all') {
        filteredData = filteredData.filter(row => row.region === regionFilter);
    }
    
    // 작목군 필터
    const cropGroupFilter = document.getElementById('crop-group-filter')?.value;
    if (cropGroupFilter && cropGroupFilter !== 'all') {
        filteredData = filteredData.filter(row => row.cropGroup === cropGroupFilter);
    }
    
    // 작목명 검색
    const cropSearchTerm = document.getElementById('crop-search')?.value?.toLowerCase() || '';
    if (cropSearchTerm) {
        filteredData = filteredData.filter(row => 
            row.cropName.toLowerCase().includes(cropSearchTerm)
        );
    }
    
    
    // 현재 정렬 상태가 있으면 정렬 적용
    if (tableSortState.column) {
        const isNumeric = document.querySelector(`th[data-sort="${tableSortState.column}"]`)?.classList.contains('numeric') || false;
        filteredData = sortTableData(filteredData, tableSortState.column, tableSortState.direction, isNumeric);
    }
    
    // 테이블 렌더링
    renderDataTableRows(filteredData, 1);
    
    // 통계 업데이트
    updateDataTableStats(window.tableData.length, filteredData.length);
}

// 현재 필터 조건에 맞는 데이터 가져오기
function getFilteredTableData() {
    if (!window.tableData) return [];
    
    let filteredData = [...window.tableData];
    
    // 빠른 검색
    const quickSearchTerm = document.getElementById('quick-search')?.value?.toLowerCase() || '';
    if (quickSearchTerm) {
        filteredData = filteredData.filter(row => 
            row.cropName.toLowerCase().includes(quickSearchTerm) ||
            row.cropGroup.toLowerCase().includes(quickSearchTerm) ||
            row.region.toLowerCase().includes(quickSearchTerm)
        );
    }
    
    // 연도 범위 필터
    const yearFrom = document.getElementById('year-from')?.value;
    const yearTo = document.getElementById('year-to')?.value;
    
    if (yearFrom) {
        filteredData = filteredData.filter(row => parseInt(row.year) >= parseInt(yearFrom));
    }
    if (yearTo) {
        filteredData = filteredData.filter(row => parseInt(row.year) <= parseInt(yearTo));
    }
    
    // 지역 필터
    const regionFilter = document.getElementById('region-filter')?.value;
    if (regionFilter && regionFilter !== 'all') {
        filteredData = filteredData.filter(row => row.region === regionFilter);
    }
    
    // 작목군 필터
    const cropGroupFilter = document.getElementById('crop-group-filter')?.value;
    if (cropGroupFilter && cropGroupFilter !== 'all') {
        filteredData = filteredData.filter(row => row.cropGroup === cropGroupFilter);
    }
    
    // 작목명 검색
    const cropSearchTerm = document.getElementById('crop-search')?.value?.toLowerCase() || '';
    if (cropSearchTerm) {
        filteredData = filteredData.filter(row => 
            row.cropName.toLowerCase().includes(cropSearchTerm)
        );
    }
    
    // 현재 정렬 상태가 있으면 정렬 적용
    if (tableSortState.column) {
        const isNumeric = document.querySelector(`th[data-sort="${tableSortState.column}"]`)?.classList.contains('numeric') || false;
        filteredData = sortTableData(filteredData, tableSortState.column, tableSortState.direction, isNumeric);
    }
    
    return filteredData;
}

// 데이터 테이블 필터 초기화
function clearDataTableFilters() {
    
    // 모든 필터 요소 초기화
    const quickSearch = document.getElementById('quick-search');
    const yearFromSelect = document.getElementById('year-from');
    const yearToSelect = document.getElementById('year-to');
    const regionFilter = document.getElementById('region-filter');
    const cropGroupFilter = document.getElementById('crop-group-filter');
    const cropSearch = document.getElementById('crop-search');
    
    if (quickSearch) quickSearch.value = '';
    if (yearFromSelect) yearFromSelect.value = '';
    if (yearToSelect) yearToSelect.value = '';
    if (regionFilter) regionFilter.value = 'all';
    if (cropGroupFilter) cropGroupFilter.value = 'all';
    if (cropSearch) cropSearch.value = '';
    
    // 필터 적용하여 전체 데이터 표시
    applyDataTableFilters();
    
}

// 엑셀 내보내기 함수
function exportToExcel() {
    
    try {
        // 현재 필터된 데이터 가져오기
        const filteredData = getFilteredTableData();
        
        if (!filteredData || filteredData.length === 0) {
            alert('내보낼 데이터가 없습니다.');
            return;
        }
        
        // 워크북 생성
        const wb = XLSX.utils.book_new();
        
        // 헤더 정보 생성
        const headerRows = [
            ['데이터 출처: 본 자료는 「농림축산식품부」(시설채소온실현황 및 생산실적, 특용작물생산실적)와 「통계청」(농작물생산조사, 농업면적조사)의 통계표를 활용하여 재가공한 자료입니다.'],
            ['이용 안내: 재가공 과정에서 다른 연구자료와 결과가 다를 수 있으므로 참고용으로 활용하시기 바랍니다.'],
            ['원본 자료: 정확한 데이터가 필요한 경우 농림축산식품부 및 통계청의 원본 자료를 직접 확인하시기 바랍니다.'],
            [''], // 빈 행
            ['연도', '작목군', '작목명', '지역', '면적(ha)', '생산량(톤)'] // 테이블 헤더
        ];
        
        // 데이터 행 생성
        const dataRows = filteredData.map(row => [
            row.year,
            row.cropGroup,
            row.cropName,
            row.region,
            Number(row.area),
            Number(row.production)
        ]);
        
        // 전체 데이터 배열 생성 (헤더 + 데이터)
        const allData = [...headerRows, ...dataRows];
        
        // 워크시트 생성
        const ws = XLSX.utils.aoa_to_sheet(allData);
        
        // 컬럼 너비 설정
        ws['!cols'] = [
            { width: 10 },  // 연도
            { width: 15 },  // 작목군
            { width: 20 },  // 작목명
            { width: 12 },  // 지역
            { width: 15 },  // 면적
            { width: 15 }   // 생산량
        ];
        
        // 첫 번째 행 스타일 설정 (데이터 출처)
        if (ws['A1']) {
            ws['A1'].s = {
                font: { bold: true, color: { rgb: "0000FF" } },
                alignment: { wrapText: true }
            };
        }
        
        // 두 번째 행 스타일 설정 (이용 안내)
        if (ws['A2']) {
            ws['A2'].s = {
                font: { bold: true, color: { rgb: "FF6600" } },
                alignment: { wrapText: true }
            };
        }
        
        // 세 번째 행 스타일 설정 (원본 자료 안내)
        if (ws['A3']) {
            ws['A3'].s = {
                font: { bold: true, color: { rgb: "FF0000" } },
                alignment: { wrapText: true }
            };
        }
        
        // 테이블 헤더 스타일 설정
        const headerRow = 5; // 1-based index
        ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
            const cellRef = `${col}${headerRow}`;
            if (ws[cellRef]) {
                ws[cellRef].s = {
                    font: { bold: true },
                    fill: { fgColor: { rgb: "E6E6E6" } },
                    alignment: { horizontal: "center" }
                };
            }
        });
        
        // 워크시트를 워크북에 추가
        XLSX.utils.book_append_sheet(wb, ws, '농업 재배동향 데이터');
        
        // 파일명 생성 (현재 날짜 포함)
        const today = new Date().toISOString().split('T')[0];
        const filename = `강원_농업재배동향_데이터_${today}.xlsx`;
        
        // 엑셀 파일 다운로드
        XLSX.writeFile(wb, filename);
        
        
        // // 사용자에게 알림
        // alert(`엑셀 파일이 성공적으로 다운로드되었습니다.\n파일명: ${filename}\n레코드 수: ${filteredData.length.toLocaleString()}개`);
        
    } catch (error) {
        alert('엑셀 파일 내보내기 중 오류가 발생했습니다.');
    }
}

// 순위분석 엑셀 내보내기
function exportRankingToExcel() {
    
    try {
        // 워크북 생성
        const wb = XLSX.utils.book_new();
        
        // 공통 헤더 정보
        const commonHeaders = [
            ['데이터 출처: 본 자료는 「농림축산식품부」(시설채소온실현황 및 생산실적, 특용작물생산실적)와 「통계청」(농작물생산조사, 농업면적조사)의 통계표를 활용하여 재가공한 자료입니다.'],
            ['이용 안내: 재가공 과정에서 다른 연구자료와 결과가 다를 수 있으므로 참고용으로 활용하시기 바랍니다.'],
            ['원본 자료: 정확한 데이터가 필요한 경우 농림축산식품부 및 통계청의 원본 자료를 직접 확인하시기 바랍니다.'],
            ['']
        ];
        
        // 각 테이블 데이터를 수집
        const rankingTableCards = document.querySelectorAll('.ranking-table-card');
        const year1 = document.getElementById('ranking-year-1')?.value || '';
        const year2 = document.getElementById('ranking-year-2')?.value || '';
        
        const tablesData = [];
        
        rankingTableCards.forEach((card) => {
            const tableHeader = card.querySelector('.ranking-table-header h3');
            const table = card.querySelector('.ranking-table');
            
            if (tableHeader && table) {
                const tableTitle = tableHeader.textContent.trim();
                const tableData = {
                    title: tableTitle,
                    headers: [],
                    rows: []
                };
                
                // 테이블 헤더 수집
                const thead = table.querySelector('thead');
                if (thead) {
                    const headerRows = thead.querySelectorAll('tr');
                    headerRows.forEach(headerRow => {
                        const headerCells = headerRow.querySelectorAll('th');
                        const headerData = Array.from(headerCells).map(cell => {
                            let cellText = cell.textContent.trim();
                            
                            // 연도 헤더 동적 설정
                            if (cellText.includes('선택연도 1')) {
                                cellText = cellText.replace('선택연도 1', `${year1}년`);
                            } else if (cellText.includes('선택연도 2')) {
                                cellText = cellText.replace('선택연도 2', `${year2}년`);
                            }
                            
                            return cellText;
                        });
                        tableData.headers.push(headerData);
                    });
                }
                
                // 테이블 데이터 수집
                const tbody = table.querySelector('tbody');
                if (tbody) {
                    const dataRows = tbody.querySelectorAll('tr');
                    dataRows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        const rowData = Array.from(cells).map(cell => cell.textContent.trim());
                        tableData.rows.push(rowData);
                    });
                }
                
                tablesData.push(tableData);
            }
        });
        
        if (tablesData.length === 0) {
            alert('내보낼 순위 데이터가 없습니다.');
            return;
        }
        
        // 가로로 배치된 테이블 생성
        const allSheetData = [...commonHeaders];
        
        // 단일 헤더 행 생성 (예시: 2019_재배면적, 2019_순위, 2023_재배면적, 2023_순위)
        const headerRow = [];
        
        tablesData.forEach((tableData, tableIndex) => {
            if (tableIndex > 0) headerRow.push(''); // 테이블 간 구분을 위한 빈 열
            
            // 테이블 제목을 헤더에 포함
            const tableTitle = tableData.title;
            
            // 각 테이블의 연도 정보 추출 (2행 헤더에서)
            let year1Text = year1;
            let year2Text = year2;
            
            // 측정 항목 추출
            const metric = document.getElementById('ranking-metric')?.value;
            let metricText = '';
            if (tableTitle.includes('점유율')) {
                metricText = '점유율';
            } else if (metric === 'area') {
                metricText = '재배면적';
            } else {
                metricText = '생산량';
            }
            
            headerRow.push(`구분_${tableTitle}`);
            headerRow.push(`${year1Text}_${metricText}`);
            headerRow.push(`${year1Text}_순위`);
            headerRow.push(`${year2Text}_${metricText}`);
            headerRow.push(`${year2Text}_순위`);
        });
        
        allSheetData.push(headerRow);
        
        // 데이터 행들 생성
        const maxDataRows = Math.max(...tablesData.map(t => t.rows.length));
        for (let dataRowIndex = 0; dataRowIndex < maxDataRows; dataRowIndex++) {
            const dataRow = [];
            
            tablesData.forEach((tableData, tableIndex) => {
                if (tableIndex > 0) dataRow.push(''); // 테이블 간 구분을 위한 빈 열
                const rowData = tableData.rows[dataRowIndex] || [];
                // 각 테이블에서 전체 5개 컬럼(구분, 값1, 순위1, 값2, 순위2) 추가
                for (let i = 0; i < 5; i++) { 
                    dataRow.push(rowData[i] || '');
                }
            });
            
            allSheetData.push(dataRow);
        }
        
        // 워크시트 생성
        const ws = XLSX.utils.aoa_to_sheet(allSheetData);
        
        // 동적 컬럼 너비 설정 (테이블 개수와 구분 열 포함)
        const columns = [];
        
        // 각 테이블마다 5개 컬럼 추가 (빈 열 + 구분, 값1, 순위1, 값2, 순위2)
        tablesData.forEach((tableData, index) => {
            if (index > 0) columns.push({ wch: 3 }); // 테이블 간 구분을 위한 빈 열
            columns.push({ wch: 20 }); // 구분/작목명
            columns.push({ wch: 12 }); // 값1
            columns.push({ wch: 8 });  // 순위1  
            columns.push({ wch: 12 }); // 값2
            columns.push({ wch: 8 });  // 순위2
        });
        
        ws['!cols'] = columns;
        
        // 스타일 설정
        if (ws['A1']) {
            ws['A1'].s = {
                font: { bold: true, color: { rgb: "0000FF" } },
                alignment: { wrapText: true }
            };
        }
        
        if (ws['A2']) {
            ws['A2'].s = {
                font: { bold: true, color: { rgb: "FF6600" } },
                alignment: { wrapText: true }
            };
        }
        
        if (ws['A3']) {
            ws['A3'].s = {
                font: { bold: true, color: { rgb: "FF0000" } },
                alignment: { wrapText: true }
            };
        }
        
        XLSX.utils.book_append_sheet(wb, ws, '순위분석');
        
        // 파일 저장
        const today = new Date().toISOString().split('T')[0];
        const filename = `강원_순위분석_${today}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        // alert('순위분석 데이터가 Excel 파일로 저장되었습니다.');
        
    } catch (error) {
        alert('순위분석 Excel 파일 내보내기 중 오류가 발생했습니다.');
    }
}

// 순위분석 데이터 수집
function collectRankingData() {
    const data = [];
    
    try {
        // 현재 선택된 연도와 측정항목 가져오기
        const year1 = document.getElementById('ranking-year-1')?.value;
        const year2 = document.getElementById('ranking-year-2')?.value;
        const metric = document.getElementById('ranking-metric')?.value;
        const metricText = metric === 'area' ? '재배면적(ha)' : '생산량(톤)';
        
        // ranking-table-card 클래스를 가진 모든 테이블 카드 수집
        const rankingTableCards = document.querySelectorAll('.ranking-table-card');
        
        rankingTableCards.forEach(card => {
            const tableHeader = card.querySelector('.ranking-table-header h3');
            const table = card.querySelector('.ranking-table');
            
            if (tableHeader && table) {
                const tableTitle = tableHeader.textContent.trim();
                const tbody = table.querySelector('tbody');
                
                if (tbody) {
                    const rows = tbody.querySelectorAll('tr');
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 5) {
                            data.push({
                                year1,
                                year2,
                                tableType: tableTitle,
                                metric: metricText,
                                cropName: cells[0].textContent.trim(),
                                value1: cells[1].textContent.trim(),
                                rank1: cells[2].textContent.trim(),
                                value2: cells[3].textContent.trim(),
                                rank2: cells[4].textContent.trim()
                            });
                        }
                    });
                }
            }
        });
        
        return data;
        
    } catch (error) {
        return [];
    }
}

// 특화계수 엑셀 내보내기
function exportSpecializationToExcel() {
    
    try {
        // 특화계수 테이블 데이터 수집
        const specializationData = collectSpecializationTableData();
        
        if (!specializationData || specializationData.length === 0) {
            alert('내보낼 특화계수 데이터가 없습니다.');
            return;
        }
        
        // 워크북 생성
        const wb = XLSX.utils.book_new();
        
        // 헤더 정보 생성
        const headerRows = [
            ['데이터 출처: 본 자료는 「농림축산식품부」(시설채소온실현황 및 생산실적, 특용작물생산실적)와 「통계청」(농작물생산조사, 농업면적조사)의 통계표를 활용하여 재가공한 자료입니다.'],
            ['이용 안내: 재가공 과정에서 다른 연구자료와 결과가 다를 수 있으므로 참고용으로 활용하시기 바랍니다.'],
            ['원본 자료: 정확한 데이터가 필요한 경우 농림축산식품부 및 통계청의 원본 자료를 직접 확인하시기 바랍니다.'],
            [''], // 빈 행
            ['특화계수 데이터'],
            ['순번', '작목명', '작목군', '특화계수', '강원비중(%)', '전국비중(%)', '등급']
        ];
        
        // 데이터 행 추가
        const dataRows = specializationData.map((item, index) => [
            index + 1,
            item.cropName || '',
            item.cropGroup || '',
            item.coefficient || '',
            item.gangwonShare || '',
            item.nationalShare || '',
            item.grade || ''
        ]);
        
        const allRows = [...headerRows, ...dataRows];
        
        // 워크시트 생성
        const ws = XLSX.utils.aoa_to_sheet(allRows);
        
        // 컬럼 너비 설정
        ws['!cols'] = [
            { wch: 8 },  // 순번
            { wch: 20 }, // 작목명
            { wch: 12 }, // 작목군
            { wch: 12 }, // 특화계수
            { wch: 15 }, // 강원비중
            { wch: 15 }, // 전국비중
            { wch: 10 }  // 등급
        ];
        
        // 스타일 설정
        if (ws['A1']) {
            ws['A1'].s = {
                font: { bold: true, color: { rgb: "0000FF" } },
                alignment: { wrapText: true }
            };
        }
        
        if (ws['A2']) {
            ws['A2'].s = {
                font: { bold: true, color: { rgb: "FF6600" } },
                alignment: { wrapText: true }
            };
        }
        
        if (ws['A3']) {
            ws['A3'].s = {
                font: { bold: true, color: { rgb: "FF0000" } },
                alignment: { wrapText: true }
            };
        }
        
        XLSX.utils.book_append_sheet(wb, ws, '특화계수');
        
        // 파일 저장
        const today = new Date().toISOString().split('T')[0];
        const filename = `강원_특화계수_${today}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        // alert('특화계수 데이터가 Excel 파일로 저장되었습니다.');
        
    } catch (error) {
        alert('특화계수 Excel 파일 내보내기 중 오류가 발생했습니다.');
    }
}

// 특화계수 테이블 데이터 수집
function collectSpecializationTableData() {
    const data = [];
    
    try {
        // specialization-table에서 데이터 수집
        const table = document.getElementById('specialization-table');
        if (!table) {
            return [];
        }
        
        const tbody = table.querySelector('tbody');
        if (!tbody) {
            return [];
        }
        
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 7) {
                // 등급 셀에서 텍스트만 추출 (span 태그 내부 텍스트)
                const gradeCell = cells[6].querySelector('span');
                const gradeText = gradeCell ? gradeCell.textContent.trim() : cells[6].textContent.trim();
                
                data.push({
                    rank: cells[0].textContent.trim(),
                    cropName: cells[1].textContent.trim(),
                    cropGroup: cells[2].textContent.trim(),
                    coefficient: cells[3].textContent.trim(),
                    gangwonShare: cells[4].textContent.trim(),
                    nationalShare: cells[5].textContent.trim(),
                    grade: gradeText
                });
            }
        });
        
        return data;
        
    } catch (error) {
        return [];
    }
}

// ========== 작목별 순위분석 섹션 관리 ==========

class CropRankingAnalysis {
    constructor() {
        this.data = [];
        this.charts = new Map();
        this.currentFilters = {
            year: null, // 초기화 시 최신 연도로 설정됨
            metric: 'area'
        };
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // 연도 선택 이벤트
        const yearSelect = document.getElementById('crop-ranking-year');
        if (yearSelect) {
            yearSelect.addEventListener('change', (e) => {
                this.currentFilters.year = e.target.value;
                this.updateAnalysis();
                // 현재 선택된 작물 가져오기
                const selectedCrop = document.getElementById('simple-map-crop-filter')?.value || '';
                this.updateSimpleMapHeader(selectedCrop);
            });
        }

        // 측정항목 선택 이벤트
        const metricSelect = document.getElementById('crop-ranking-metric');
        if (metricSelect) {
            metricSelect.addEventListener('change', (e) => {
                this.currentFilters.metric = e.target.value;
                this.updateMetricLabels();
                this.updateAnalysis();
                // 현재 선택된 작물 가져오기
                const selectedCrop = document.getElementById('simple-map-crop-filter')?.value || '';
                this.updateSimpleMapHeader(selectedCrop);
                // 연도별 동향 테이블도 업데이트
                this.updateYearlyTrendTable(selectedCrop);
            });
        }


        // 차트 개수 선택 이벤트
        const chartCountSelect = document.getElementById('ranking-chart-count');
        if (chartCountSelect) {
            chartCountSelect.addEventListener('change', (e) => {
                this.updateRankingChart();
            });
        }

        // 지도 작목 필터 이벤트
        const mapCropFilter = document.getElementById('map-crop-filter');
        if (mapCropFilter) {
            mapCropFilter.addEventListener('change', (e) => {
                this.updateMap(e.target.value);
            });
        }

        // 평면 지도 작목군 필터 이벤트
        const simpleMapCropGroupFilter = document.getElementById('simple-map-crop-group-filter');
        if (simpleMapCropGroupFilter) {
            simpleMapCropGroupFilter.addEventListener('change', (e) => {
                this.updateSimpleMapCropOptions(e.target.value);
                this.updateSimpleMapHeader(''); // 헤더 초기화
            });
        }

        // 평면 지도 작목 필터 이벤트
        const simpleMapCropFilter = document.getElementById('simple-map-crop-filter');
        if (simpleMapCropFilter) {
            simpleMapCropFilter.addEventListener('change', async (e) => {
                await this.updateSimpleMap(e.target.value);
                this.updateYearlyTrendTable(e.target.value);
            });
        }

        // 분포 차트 작목 필터 이벤트
        const distributionCropFilter = document.getElementById('distribution-crop-filter');
        if (distributionCropFilter) {
            distributionCropFilter.addEventListener('change', (e) => {
                this.updateDistributionChart(e.target.value);
            });
        }

        // 히트맵 뷰 변경 이벤트
        const heatmapView = document.getElementById('heatmap-view');
        if (heatmapView) {
            heatmapView.addEventListener('change', (e) => {
                this.updateHeatmap();
            });
        }

        // 지역별 순위 테이블 관련 이벤트
        const tableMetricSelect = document.getElementById('ranking-table-metric');
        if (tableMetricSelect) {
            tableMetricSelect.addEventListener('change', (e) => {
                // currentFilters도 함께 업데이트
                this.currentFilters.metric = e.target.value;


                this.updateRegionalRankingTable();

                // 지도도 함께 업데이트
                const mapCropFilter = document.getElementById('simple-map-crop-filter');
                if (mapCropFilter && mapCropFilter.value) {
                    this.updateSimpleMap(mapCropFilter.value);
                }
            });
        }

        const tableCountSelect = document.getElementById('ranking-table-count');
        if (tableCountSelect) {
            tableCountSelect.addEventListener('change', (e) => {
                this.updateRegionalRankingTable();
            });
        }

        // 빠른 검색 기능
        const quickSearchInput = document.getElementById('crop-quick-search');
        const clearSearchBtn = document.getElementById('clear-search');

        if (quickSearchInput) {
            quickSearchInput.addEventListener('input', (e) => {
                this.currentFilters.quickSearch = e.target.value.trim();
                this.updateRegionalRankingTable();

                // 지우기 버튼 표시/숨기기
                if (clearSearchBtn) {
                    if (e.target.value.trim()) {
                        clearSearchBtn.classList.add('show');
                    } else {
                        clearSearchBtn.classList.remove('show');
                    }
                }
            });
        }

        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                if (quickSearchInput) {
                    quickSearchInput.value = '';
                    this.currentFilters.quickSearch = '';
                    this.updateRegionalRankingTable();
                    clearSearchBtn.classList.remove('show');
                    quickSearchInput.focus();
                }
            });
        }

    }

    // 분석 데이터 업데이트
    async updateAnalysis() {
        try {
            const filteredData = this.getFilteredData();

            // 작목군 필터 업데이트 (연도 변경에 따라)
            this.setupCropGroupFilter();

            // 지역별 순위 테이블 업데이트 (첫 번째)
            this.updateRegionalRankingTable();

            // 차트 업데이트
            this.updateRankingChart();
            this.updateDistributionChart();

            // 필터 옵션 업데이트
            this.updateFilterOptions();
            await this.updateSimpleMapCropOptions();

        } catch (error) {
        }
    }

    // 필터된 데이터 반환
    getFilteredData() {
        let filtered = appState.data.raw.filter(item => {
            // 연도 필터 (null인 경우는 초기화 단계이므로 모든 데이터 반환)
            if (this.currentFilters.year && item.연도 !== this.currentFilters.year) {
                return false;
            }

            return true;
        });

        return filtered;
    }


    // 측정항목 라벨 업데이트
    updateMetricLabels() {
        const isArea = this.currentFilters.metric === 'area';
        const label = isArea ? '재배면적' : '생산량';

        // 차트 제목 업데이트
        const yearlyTrendTitle = document.getElementById('yearly-trend-title');
        if (yearlyTrendTitle) {
            // 표 제목은 선택된 작물에 따라 동적으로 변경됨
        }

        const distributionTitle = document.getElementById('distribution-chart-title');
        if (distributionTitle) {
            distributionTitle.textContent = `지역별 ${label} 분포`;
        }
    }

    // 순위 차트 업데이트 (비활성화됨 - 표로 대체)
    updateRankingChart() {
        // ranking-chart-card가 제거되어 표로 대체됨
        return;

        // 기존 차트 제거
        if (this.charts.has('ranking')) {
            this.charts.get('ranking').destroy();
        }

        const ctx = canvas.getContext('2d');
        const filteredData = this.getFilteredData();
        const count = parseInt(document.getElementById('ranking-chart-count')?.value || '20');

        // 데이터 정렬 및 상위 N개 선택
        const sortedData = filteredData.sort((a, b) => {
            const valueA = this.currentFilters.metric === 'area' ?
                parseFloat(a['면적(ha)']) || 0 :
                parseFloat(a['생산량(톤)']) || 0;
            const valueB = this.currentFilters.metric === 'area' ?
                parseFloat(b['면적(ha)']) || 0 :
                parseFloat(b['생산량(톤)']) || 0;
            return valueB - valueA;
        }).slice(0, count);

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedData.map(item => item.cropName),
                datasets: [{
                    label: this.currentFilters.metric === 'area' ? '재배면적 (ha)' : '생산량 (톤)',
                    data: sortedData.map(item => {
                        return this.currentFilters.metric === 'area' ?
                            parseFloat(item['면적(ha)']) || 0 :
                            parseFloat(item['생산량(톤)']) || 0;
                    }),
                    backgroundColor: AppConfig.GRADIENT_COLORS,
                    borderColor: AppConfig.CHART_COLORS.primary,
                    borderWidth: 1,
                    borderRadius: 4,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: AppConfig.CHART_COLORS.primary,
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            title: function(context) {
                                return context[0].label;
                            },
                            label: function(context) {
                                const value = context.parsed.y;
                                const unit = this.currentFilters.metric === 'area' ? 'ha' : '톤';
                                return `${value.toLocaleString()}${unit}`;
                            }.bind(this)
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString();
                            },
                            color: '#6b7280',
                            font: {
                                size: 11
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 45,
                            color: '#6b7280',
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                onHover: (event, activeElements) => {
                    event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
                }
            }
        });

    }

    // 분포 차트 업데이트
    updateDistributionChart(selectedCrop = '') {
        const canvas = document.getElementById('regional-distribution-chart');
        if (!canvas) return;

        // 기존 차트 제거
        if (this.charts.has('distribution')) {
            this.charts.get('distribution').destroy();
        }

        const ctx = canvas.getContext('2d');
        const filteredData = this.getFilteredData();

        // 선택된 작목이 있으면 해당 작목만, 없으면 전체 합계
        let chartData;
        let chartTitle;

        if (selectedCrop) {
            // 특정 작목의 지역별 분포
            const cropData = filteredData.filter(item => item.cropName === selectedCrop);
            if (cropData.length === 0) return;

            chartData = cropData.map(item => ({
                region: item.region || '강원',
                value: this.currentFilters.metric === 'area' ?
                    parseFloat(item['면적(ha)']) || 0 :
                    parseFloat(item['생산량(톤)']) || 0
            }));

            chartTitle = `${selectedCrop} - 지역별 ${this.currentFilters.metric === 'area' ? '재배면적' : '생산량'} 분포`;

        } else {
            // 전체 작목의 작목군별 분포
            const groupSums = {};
            filteredData.forEach(item => {
                const group = item.cropGroup || '기타';
                const value = this.currentFilters.metric === 'area' ?
                    parseFloat(item['면적(ha)']) || 0 :
                    parseFloat(item['생산량(톤)']) || 0;

                groupSums[group] = (groupSums[group] || 0) + value;
            });

            chartData = Object.entries(groupSums).map(([group, value]) => ({
                region: group,
                value: value
            }));

            chartTitle = `작목군별 ${this.currentFilters.metric === 'area' ? '재배면적' : '생산량'} 분포`;
        }

        // 데이터가 없으면 빈 차트 표시
        if (chartData.length === 0 || chartData.every(d => d.value === 0)) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '16px Arial';
            ctx.fillStyle = '#64748b';
            ctx.textAlign = 'center';
            ctx.fillText('선택된 조건에 대한 데이터가 없습니다', canvas.width / 2, canvas.height / 2);
            return;
        }

        // 차트 제목 업데이트
        const titleElement = document.getElementById('distribution-chart-title');
        if (titleElement) {
            titleElement.innerHTML = `<i class="fas fa-pie-chart"></i> ${chartTitle}`;
        }

        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartData.map(item => item.region),
                datasets: [{
                    data: chartData.map(item => item.value),
                    backgroundColor: AppConfig.GRADIENT_COLORS.slice(0, chartData.length),
                    borderWidth: 3,
                    borderColor: '#ffffff',
                    hoverBorderWidth: 4,
                    hoverBorderColor: AppConfig.CHART_COLORS.primary
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 1200,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: {
                                size: 11
                            },
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                    return data.labels.map((label, i) => {
                                        const value = data.datasets[0].data[i];
                                        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                        return {
                                            text: `${label}: ${value.toLocaleString()} (${percentage}%)`,
                                            fillStyle: data.datasets[0].backgroundColor[i],
                                            hidden: false,
                                            index: i
                                        };
                                    });
                                }
                                return [];
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: AppConfig.CHART_COLORS.primary,
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            title: function(context) {
                                return context[0].label;
                            },
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                const unit = selectedCrop && selectedCrop !== '' ?
                                    (this.currentFilters.metric === 'area' ? 'ha' : '톤') :
                                    (this.currentFilters.metric === 'area' ? 'ha' : '톤');
                                return `${value.toLocaleString()}${unit} (${percentage}%)`;
                            }.bind(this)
                        }
                    }
                },
                onHover: (event, activeElements) => {
                    event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
                }
            }
        });

        this.charts.set('distribution', chart);
    }

    // 평면 지도 헤더 업데이트
    updateSimpleMapHeader(selectedCrop = '') {
        const header = document.getElementById('simple-map-header');
        if (!header) return;

        // 현재 선택된 연도 가져오기
        const yearSelect = document.getElementById('crop-ranking-year');
        const currentYear = yearSelect ? yearSelect.value : '';

        const metric = this.currentFilters.metric || 'area';
        const metricLabel = metric === 'area' ? '재배면적' : '생산량';

        let headerText = '';
        if (selectedCrop && currentYear) {
            headerText = currentYear + '년 ' + selectedCrop + ' ' + metricLabel + ' 현황';
        } else if (currentYear) {
            headerText = currentYear + '년 ' + metricLabel + ' 현황';
        } else {
            headerText = metricLabel + ' 현황';
        }

        header.innerHTML = '<i class="fas fa-map-marked-alt"></i> ' + headerText;
    }

    // 평면 지도 업데이트
    async updateSimpleMap(selectedCrop = '') {
        console.log('updateSimpleMap 호출됨, 선택된 작물:', selectedCrop);
        const mapContainer = document.getElementById('korea-svg-map');
        if (!mapContainer) {
            console.error('updateSimpleMap: korea-svg-map 컨테이너 없음');
            return;
        }

        // 헤더 업데이트
        this.updateSimpleMapHeader(selectedCrop);

        const filteredData = this.getFilteredData();
        const metric = this.currentFilters.metric || 'area';
        const unit = metric === 'area' ? 'ha' : 't';

        // 선택된 작목이 있으면 해당 작목, 없으면 상위 작목 사용
        let targetCrop = selectedCrop;
        if (!targetCrop) {
            // 전국 기준 상위 작목 찾기
            const cropTotals = {};
            filteredData.forEach(item => {
                if (item.지역 === '전국') {
                    const value = metric === 'area' ? parseFloat(item['면적(ha)']) || 0 : parseFloat(item['생산량(톤)']) || 0;
                    cropTotals[item.작목명] = value;
                }
            });

            const topCrop = Object.entries(cropTotals)
                .sort(([,a], [,b]) => b - a)[0];
            targetCrop = topCrop ? topCrop[0] : '';
        }

        const mapInfo = document.getElementById('simple-map-info');

        if (!targetCrop) {
            // 모든 지역 값 초기화
            this.clearMapRegions();
            if (mapInfo) {
                mapInfo.innerHTML = '<p>작목을 선택하면 지역별 재배 현황을 보여줍니다</p>';
            }
            return;
        }

        // 작목 객체 찾기
        const cropTotals = {};
        filteredData.forEach(item => {
            if (item.지역 === '전국') {
                const value = metric === 'area' ? parseFloat(item['면적(ha)']) || 0 : parseFloat(item['생산량(톤)']) || 0;
                cropTotals[item.작목명] = value;
            }
        });

        // 모든 지역 데이터 계산
        const nationalValue = cropTotals[targetCrop] || 0;
        const regionalData = [];

        // 선택된 작목의 모든 지역 데이터 수집
        filteredData.forEach(item => {
            if (item.작목명 === targetCrop && item.지역 !== '전국') {
                const regionValue = metric === 'area' ?
                    parseFloat(item['면적(ha)']) || 0 :
                    parseFloat(item['생산량(톤)']) || 0;

                if (regionValue > 0) { // 0보다 큰 값만 포함
                    regionalData.push({
                        region: item.지역,
                        value: regionValue,
                        percentage: nationalValue > 0 ? (regionValue / nationalValue * 100) : 0
                    });
                }
            }
        });

        // 값 기준으로 내림차순 정렬
        regionalData.sort((a, b) => b.value - a.value);

        // 강원도 데이터 찾기 (지도 정보 표시용)
        const gangwonData = regionalData.find(item => item.region === '강원');
        const gangwonValue = gangwonData ? gangwonData.value : 0;
        console.log('지도 업데이트 - 지역별 데이터:', regionalData);

        // SVG 지도 업데이트
        console.log('updateSimpleMap에서 SVG 업데이트 호출:', targetCrop, regionalData.length);
        await this.loadAndUpdateSVGMap(regionalData, targetCrop, metric);

        // 지도 정보 업데이트
        if (mapInfo) {
            const totalValue = regionalData.reduce((sum, item) => sum + item.value, 0);
            const gangwonData = regionalData.find(item => item.region === '강원');
            const gangwonValue = gangwonData ? gangwonData.value : 0;
            const gangwonPercent = totalValue > 0 ? ((gangwonValue / totalValue) * 100).toFixed(1) : 0;

            mapInfo.innerHTML = `
                <div class="map-summary">
                    <strong>${targetCrop}</strong> 지역별 현황 |
                    전국 합계: ${Math.round(totalValue).toLocaleString()}${unit} |
                    강원: ${Math.round(gangwonValue).toLocaleString()}${unit} (${gangwonPercent}%)
                </div>
            `;
        }
    }

    // 연도별 동향 표 업데이트
    updateYearlyTrendTable(selectedCrop) {
        if (!selectedCrop) {
            selectedCrop = '';
        }

        const table = document.getElementById('yearly-trend-table');
        const header = document.getElementById('yearly-trend-header');
        const tbody = document.getElementById('yearly-trend-body');
        const title = document.getElementById('yearly-trend-title');

        if (!table || !header || !tbody || !title) {
            return;
        }

        // 현재 지표 (면적 또는 생산량)
        const metric = this.currentFilters.metric || 'area';
        const metricLabel = metric === 'area' ? '재배면적' : '생산량';

        // 작물이 선택되지 않은 경우
        if (!selectedCrop) {
            title.textContent = '작물별 연도별 ' + metricLabel + ' 동향';
            tbody.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 2rem;">작물을 선택해주세요</td></tr>';
            return;
        }

        // 제목 업데이트
        title.textContent = selectedCrop + ' 연도별 ' + metricLabel + ' 동향';

        // 데이터 가져오기 (모든 연도 데이터 사용)
        const allData = appState.data.raw;
        const cropData = allData.filter(function(item) {
            return item.작목명 === selectedCrop;
        });

        if (cropData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 2rem;">해당 작물의 데이터가 없습니다</td></tr>';
            return;
        }

        // 연도 추출 및 정렬
        const years = cropData.map(function(item) {
            return parseInt(item.연도);
        });
        const uniqueYears = Array.from(new Set(years)).sort(function(a, b) {
            return a - b;
        });

        // 순위 안내문구 업데이트
        const rankingNote = document.getElementById('yearly-trend-ranking-note');
        if (rankingNote && uniqueYears.length > 0) {
            const lastYear = uniqueYears[uniqueYears.length - 1];
            rankingNote.textContent = `※ 순위 : ${lastYear}년 기준 순위`;
        }

        // 단위 표시 업데이트
        const unitNote = document.getElementById('yearly-trend-unit');
        if (unitNote) {
            const unitText = metric === 'area' ? 'ha' : '톤';
            unitNote.textContent = `단위 : ${unitText}`;
        }

        // 헤더 업데이트
        let headerHTML = '<th>순위</th><th>구분</th>';
        for (let i = 0; i < uniqueYears.length; i++) {
            headerHTML += '<th>' + uniqueYears[i] + '</th>';
        }
        header.innerHTML = headerHTML;

        const unit = metric === 'area' ? 'ha' : 't';

        // 표 내용 생성
        let tableHTML = '';

        // 마지막 연도 기준 순위 계산 (전국 제외)
        const lastYear = uniqueYears[uniqueYears.length - 1];
        const lastYearData = cropData.filter(function(d) {
            return d.연도 == lastYear && d.지역 !== '전국';
        });

        const regionRanking = lastYearData
            .map(function(d) {
                const value = metric === 'area' ? parseFloat(d['면적(ha)']) || 0 : parseFloat(d['생산량(톤)']) || 0;
                return {
                    region: d.지역,
                    value: value
                };
            })
            .filter(function(d) { return d.value > 0; })
            .sort(function(a, b) { return b.value - a.value; });

        // 지역별 순위 맵 생성
        const rankMap = {};
        regionRanking.forEach(function(item, index) {
            rankMap[item.region] = index + 1;
        });

        // 전국 데이터 (순위 없음)
        tableHTML += '<tr><td class="rank-cell">-</td><td class="category-cell">전국</td>';
        for (let i = 0; i < uniqueYears.length; i++) {
            const year = uniqueYears[i];
            const item = cropData.find(function(d) {
                return d.지역 === '전국' && d.연도 == year;
            });
            let value = 0;
            if (item) {
                value = metric === 'area' ? parseFloat(item['면적(ha)']) || 0 : parseFloat(item['생산량(톤)']) || 0;
            }
            const displayValue = value > 0 ? value.toLocaleString() : '-';
            tableHTML += '<td class="value-cell">' + displayValue + '</td>';
        }
        tableHTML += '</tr>';

        // 강원 데이터 (순위 포함)
        const gangwonRank = rankMap['강원'] || '-';
        tableHTML += '<tr class="main-region-row"><td class="rank-cell">' + gangwonRank + '</td><td class="category-cell">강원</td>';
        for (let i = 0; i < uniqueYears.length; i++) {
            const year = uniqueYears[i];
            const item = cropData.find(function(d) {
                return d.지역 === '강원' && d.연도 == year;
            });

            let value = 0;
            if (item) {
                value = metric === 'area' ? parseFloat(item['면적(ha)']) || 0 : parseFloat(item['생산량(톤)']) || 0;
            }

            const displayValue = value > 0 ? Math.round(value).toLocaleString() : '-';
            tableHTML += '<td class="value-cell">' + displayValue + '</td>';
        }
        tableHTML += '</tr>';

        // 상위 7지역을 테이블에 추가 (순위 포함)
        const topRegions = regionRanking.slice(0, 7);
        topRegions.forEach(function(regionInfo, index) {
            const rank = index + 1;
            tableHTML += '<tr><td class="rank-cell">' + rank + '</td><td class="category-cell">' + regionInfo.region + '</td>';

            for (let i = 0; i < uniqueYears.length; i++) {
                const year = uniqueYears[i];
                const item = cropData.find(function(d) {
                    return d.지역 === regionInfo.region && d.연도 == year;
                });

                let value = 0;
                if (item) {
                    value = metric === 'area' ? parseFloat(item['면적(ha)']) || 0 : parseFloat(item['생산량(톤)']) || 0;
                }

                const displayValue = value > 0 ? Math.round(value).toLocaleString() : '-';
                tableHTML += '<td class="value-cell">' + displayValue + '</td>';
            }

            tableHTML += '</tr>';
        });

        tbody.innerHTML = tableHTML;
    }

    // SVG 지도 지역 업데이트
    updateMapRegions(regionalData, totalValue, cropName, unit) {
        const svg = document.querySelector('#korea-svg-map svg');

        if (!svg) {
            return;
        }


        // 지역별 데이터를 값 기준으로 정렬하여 순위 계산
        const sortedRegions = [...regionalData]
            .filter(r => r.value > 0)
            .sort((a, b) => b.value - a.value);


        regionalData.forEach(regionData => {
            const { region, value } = regionData;

            // 지역명 변형 버전들 생성
            const regionVariants = [
                region,
                region + '도',
                region + '특별시',
                region + '광역시',
                region + '특별자치도',
                region.replace('도', ''),
                region.replace('특별시', ''),
                region.replace('광역시', ''),
                region.replace('특별자치도', '')
            ];

            // 경상남도/경상북도, 전라남도/전라북도, 충청남도/충청북도 등 전체명도 추가
            const fullNames = {
                '경남': ['경상남도', 'gyeongnam', 'gyeongsangnam'],
                '경북': ['경상북도', 'gyeongbuk', 'gyeongsangbuk'],
                '전남': ['전라남도', 'jeonnam', 'jeollanam'],
                '전북': ['전라북도', 'jeonbuk', 'jeollabuk'],
                '충남': ['충청남도', 'chungnam', 'chungcheongnam'],
                '충북': ['충청북도', 'chungbuk', 'chungcheongbuk']
            };

            if (fullNames[region]) {
                regionVariants.push(...fullNames[region]);
            }

            let regionElement = null;

            // 모든 지역명 변형으로 찾기
            for (const regionVariant of regionVariants) {
                const selectors = [
                    `[data-name*="${regionVariant}"]`,
                    `[id*="${regionVariant}"]`,
                    `path[id*="${regionVariant}"]`,
                    `g[id*="${regionVariant}"]`,
                    `[title*="${regionVariant}"]`,
                    `[name*="${regionVariant}"]`,
                    `path[class*="${regionVariant}"]`,
                    `g[class*="${regionVariant}"]`
                ];

                for (const selector of selectors) {
                    const elements = svg.querySelectorAll(selector);
                    if (elements.length > 0) {
                        regionElement = Array.from(elements).find(el => el.tagName === 'path') || elements[0];
                        break;
                    }
                }
                if (regionElement) break;
            }

            // 여전히 못 찾으면 모든 요소를 확인하여 부분 매치
            if (!regionElement) {
                const allElements = svg.querySelectorAll('path, g, circle, rect');
                regionElement = Array.from(allElements).find(el => {
                    const id = el.id || '';
                    const className = el.className.baseVal || el.className || '';
                    const dataName = el.getAttribute('data-name') || '';
                    const title = el.getAttribute('title') || '';

                    return regionVariants.some(variant =>
                        id.toLowerCase().includes(variant.toLowerCase()) ||
                        className.toLowerCase().includes(variant.toLowerCase()) ||
                        dataName.toLowerCase().includes(variant.toLowerCase()) ||
                        title.toLowerCase().includes(variant.toLowerCase())
                    );
                });
            }


            if (regionElement) {
                // 개발자 도구에서 보기 좋게 하기 위해 깔끔한 속성 추가
                regionElement.setAttribute('data-region', region);
                regionElement.setAttribute('data-region-kr', region);

                // 순위 찾기
                const rank = sortedRegions.findIndex(r => r.region === region) + 1;

                // 새로운 색상 시스템: 값의 크기에 따른 색상 강도
                let fillColor, strokeColor, strokeWidth;
                const maxValue = Math.max(...sortedRegions.map(r => r.value));
                const intensity = maxValue > 0 ? value / maxValue : 0;

                if (value === 0) {
                    // 데이터 없음: 연한 회색
                    fillColor = '#f3f4f6';
                    strokeColor = '#d1d5db';
                    strokeWidth = '1';
                } else if (rank === 1) {
                    // 1위: 진한 골드
                    fillColor = '#fbbf24';
                    strokeColor = '#d97706';
                    strokeWidth = '3';
                } else if (rank === 2) {
                    // 2위: 진한 실버
                    fillColor = '#94a3b8';
                    strokeColor = '#475569';
                    strokeWidth = '2.5';
                } else if (rank === 3) {
                    // 3위: 진한 브론즈
                    fillColor = '#f97316';
                    strokeColor = '#c2410c';
                    strokeWidth = '2.5';
                } else if (rank >= 4 && rank <= 5) {
                    // 4-5위: 연한 그린
                    fillColor = '#86efac';
                    strokeColor = '#16a34a';
                    strokeWidth = '2';
                } else if (intensity > 0.3) {
                    // 상위권 (30% 이상): 연한 블루
                    fillColor = '#bfdbfe';
                    strokeColor = '#3b82f6';
                    strokeWidth = '1.5';
                } else if (intensity > 0.1) {
                    // 중위권 (10-30%): 매우 연한 블루
                    fillColor = '#e0e7ff';
                    strokeColor = '#6366f1';
                    strokeWidth = '1';
                } else {
                    // 하위권: 연한 회색
                    fillColor = '#f8fafc';
                    strokeColor = '#e2e8f0';
                    strokeWidth = '1';
                }

                // 강원도는 빨간색 테두리로 강조
                if (region === '강원') {
                    strokeColor = '#ef4444';
                    strokeWidth = '3';
                }


                // 스타일 적용
                regionElement.style.fill = fillColor;
                regionElement.style.stroke = strokeColor;
                regionElement.style.strokeWidth = strokeWidth;
                regionElement.style.cursor = 'pointer';

                // 호버 효과를 위한 데이터 속성 추가
                regionElement.setAttribute('data-original-fill', fillColor);
                regionElement.setAttribute('data-original-stroke', strokeColor);
                regionElement.setAttribute('data-original-stroke-width', strokeWidth);

                // 호버 이벤트 추가
                regionElement.addEventListener('mouseenter', (e) => {
                    // 새로운 호버 효과 시스템
                    if (region === '강원') {
                        regionElement.style.fill = 'rgba(239, 68, 68, 0.4)';
                        regionElement.style.strokeWidth = '4';
                    } else if (rank === 1) {
                        regionElement.style.fill = '#f59e0b'; // 1위 호버: 더 진한 골드
                        regionElement.style.strokeWidth = '4';
                    } else if (rank === 2) {
                        regionElement.style.fill = '#64748b'; // 2위 호버: 더 진한 실버
                        regionElement.style.strokeWidth = '3.5';
                    } else if (rank === 3) {
                        regionElement.style.fill = '#ea580c'; // 3위 호버: 더 진한 브론즈
                        regionElement.style.strokeWidth = '3.5';
                    } else if (rank >= 4 && rank <= 5) {
                        regionElement.style.fill = '#22c55e'; // 4-5위 호버: 진한 그린
                        regionElement.style.strokeWidth = '3';
                    } else if (intensity > 0.3) {
                        regionElement.style.fill = '#3b82f6'; // 상위권 호버: 진한 블루
                        regionElement.style.strokeWidth = '2.5';
                    } else if (intensity > 0.1) {
                        regionElement.style.fill = '#6366f1'; // 중위권 호버: 진한 인디고
                        regionElement.style.strokeWidth = '2';
                    } else {
                        regionElement.style.fill = '#94a3b8'; // 하위권 호버: 진한 회색
                        regionElement.style.strokeWidth = '2';
                    }

                    // 툴팁 표시
                    this.showMapTooltip(e, region, value, unit, rank, cropName);
                });

                regionElement.addEventListener('mouseleave', () => {
                    regionElement.style.fill = fillColor;
                    regionElement.style.stroke = strokeColor;
                    regionElement.style.strokeWidth = strokeWidth;

                    // 툴팁 숨기기
                    this.hideMapTooltip();
                });

                regionElement.addEventListener('mousemove', (e) => {
                    // 툴팁 위치 업데이트
                    this.updateTooltipPosition(e);
                });

                // 툴팁 정보 추가 (순위 포함)
                const percentage = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : 0;
                const rankText = rank > 0 ? `${rank}위` : '-';
                regionElement.setAttribute('title',
                    `${region} (${rankText}): ${Math.round(value).toLocaleString()}${unit} (${percentage}%)`
                );

                // 라벨 표시 조건: 상위 3위 + 강원도(항상 표시)
                const shouldShowLabel = (rank >= 1 && rank <= 3) ||
                                       region === '강원';

                if (shouldShowLabel) {
                    this.addRegionLabel(svg, regionElement, region, value, unit, rank, intensity);
                } else {
                    this.removeRegionLabel(svg, region);
                }
            }
        });
    }

    // 지역에 텍스트 레이블 추가 (새로운 간소화된 시스템)
    addRegionLabel(svg, regionElement, region, value, unit, rank, intensity) {
        // 기존 레이블 제거
        this.removeRegionLabel(svg, region);

        // 지역 요소의 중심점 계산
        const bbox = regionElement.getBBox();
        let centerX = bbox.x + bbox.width / 2;
        let centerY = bbox.y + bbox.height / 2;

        // 지역별 위치 조정 (더 정확한 위치로 수정)
        const regionAdjustments = {
            '강원': { x: 5, y: -15 },
            '경기': { x: -10, y: -8 },
            '서울': { x: -20, y: -12 },
            '인천': { x: -30, y: -5 },
            '충북': { x: -8, y: 5 },
            '충남': { x: -18, y: 8 },
            '대전': { x: -15, y: 12 },
            '세종': { x: -20, y: 5 },
            '전북': { x: -12, y: 12 },
            '경북': { x: 10, y: -8 },
            '대구': { x: 5, y: 8 },
            '전남': { x: -8, y: 15 },
            '광주': { x: -15, y: 12 },
            '경남': { x: -5, y: 8 },
            '부산': { x: 8, y: 12 },
            '울산': { x: 12, y: 5 },
            '제주': { x: -8, y: 8 }
        };

        if (regionAdjustments[region]) {
            centerX += regionAdjustments[region].x;
            centerY += regionAdjustments[region].y;
        }

        // 텍스트 그룹 생성
        const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        labelGroup.setAttribute('id', `label-${region}`);
        labelGroup.style.pointerEvents = 'auto';

        // 라벨 크기와 스타일 결정
        const labelRadius = 25;
        let bgColor, strokeColor, textColor, shadowColor;

        // 강도 기반 색상 시스템
        if (rank === 1) {
            bgColor = '#fbbf24';      // 골드
            strokeColor = '#d97706';
            textColor = '#ffffff';
            shadowColor = 'rgba(217, 119, 6, 0.3)';
        } else if (rank === 2) {
            bgColor = '#e5e7eb';      // 실버
            strokeColor = '#9ca3af';
            textColor = '#374151';
            shadowColor = 'rgba(156, 163, 175, 0.3)';
        } else if (rank === 3) {
            bgColor = '#f97316';      // 브론즈
            strokeColor = '#ea580c';
            textColor = '#ffffff';
            shadowColor = 'rgba(234, 88, 12, 0.3)';
        } else if (rank <= 5) {
            bgColor = '#10b981';      // 4-5위: 그린
            strokeColor = '#059669';
            textColor = '#ffffff';
            shadowColor = 'rgba(5, 150, 105, 0.3)';
        } else if (intensity > 0.7) {
            bgColor = '#3b82f6';      // 고강도: 블루
            strokeColor = '#2563eb';
            textColor = '#ffffff';
            shadowColor = 'rgba(37, 99, 235, 0.3)';
        } else if (intensity > 0.4) {
            bgColor = '#60a5fa';      // 중강도: 라이트 블루
            strokeColor = '#3b82f6';
            textColor = '#ffffff';
            shadowColor = 'rgba(59, 130, 246, 0.3)';
        } else {
            bgColor = '#f8fafc';      // 저강도: 라이트 그레이
            strokeColor = '#cbd5e1';
            textColor = '#64748b';
            shadowColor = 'rgba(203, 213, 225, 0.3)';
        }

        // 그림자
        const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        shadow.setAttribute('cx', centerX + 2);
        shadow.setAttribute('cy', centerY + 2);
        shadow.setAttribute('r', labelRadius);
        shadow.style.fill = shadowColor;
        shadow.style.filter = 'blur(3px)';

        // 배경 원
        const background = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        background.setAttribute('cx', centerX);
        background.setAttribute('cy', centerY);
        background.setAttribute('r', labelRadius);
        background.style.fill = bgColor;
        background.style.stroke = strokeColor;
        background.style.strokeWidth = '2';

        // 순위 텍스트 (상단)
        const rankText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        rankText.setAttribute('x', centerX);
        rankText.setAttribute('y', centerY - 6);
        rankText.setAttribute('text-anchor', 'middle');
        rankText.setAttribute('dominant-baseline', 'middle');
        rankText.style.fontSize = '16px';
        rankText.style.fontWeight = 'bold';
        rankText.style.fill = textColor;
        rankText.textContent = rank > 0 ? `${rank}위` : region;

        // 값 텍스트 (하단)
        const valueText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        valueText.setAttribute('x', centerX);
        valueText.setAttribute('y', centerY + 8);
        valueText.setAttribute('text-anchor', 'middle');
        valueText.setAttribute('dominant-baseline', 'middle');
        valueText.style.fontSize = '13px';
        valueText.style.fontWeight = '500';
        valueText.style.fill = textColor;
        valueText.style.opacity = '0.9';
        const displayValue = value >= 1000 ? `${Math.round(value/1000)}k` : Math.round(value).toString();
        valueText.textContent = `${displayValue}${unit}`;

        // 요소들을 그룹에 추가
        labelGroup.appendChild(shadow);
        labelGroup.appendChild(background);
        labelGroup.appendChild(rankText);
        labelGroup.appendChild(valueText);

        // SVG에 추가
        svg.appendChild(labelGroup);
    }

    // 지역 레이블 제거
    removeRegionLabel(svg, region) {
        const existingLabel = svg.querySelector(`#label-${region}`);
        if (existingLabel) {
            existingLabel.remove();
        }
    }

    // 지도 지역 초기화
    clearMapRegions() {
        const svg = document.querySelector('#korea-svg-map svg');
        if (!svg) return;

        // SVG 정리 및 개발자 도구에서 보기 좋게 정리
        svg.setAttribute('data-map', 'korea-regions');

        // 모든 path와 지역 요소 초기화
        const regions = svg.querySelectorAll('path, g[id], [data-name]');
        regions.forEach((region, index) => {
            // 개발자 도구에서 보기 좋게 인덱스 추가
            region.setAttribute('data-path-index', index);

            // path 요소 정보 백업 (d 속성은 그대로 유지)
            if (region.tagName === 'path' && region.getAttribute('d')) {
                region.setAttribute('data-path-summary', `path-${index}`);
            }

            // 모든 스타일 속성 완전 초기화
            region.style.cssText = '';
            region.removeAttribute('style');

            // 기본 스타일 강제 적용
            region.setAttribute('fill', '#e5e7eb');
            region.setAttribute('stroke', '#ffffff');
            region.setAttribute('stroke-width', '1');
            region.style.cursor = 'default';

            // 모든 data 속성 제거
            region.removeAttribute('title');
            region.removeAttribute('data-region');
            region.removeAttribute('data-region-kr');
            region.removeAttribute('data-original-fill');
            region.removeAttribute('data-original-stroke');
            region.removeAttribute('data-original-stroke-width');

            // 기존 이벤트 리스너 제거 (cloneNode 대신 직접 제거)
            region.onmouseenter = null;
            region.onmouseleave = null;
            region.onmousemove = null;
            region.onclick = null;

            // addEventListener로 추가된 이벤트 리스너도 제거
            if (region._mouseenterHandler) {
                region.removeEventListener('mouseenter', region._mouseenterHandler);
                region._mouseenterHandler = null;
            }
            if (region._mouseleaveHandler) {
                region.removeEventListener('mouseleave', region._mouseleaveHandler);
                region._mouseleaveHandler = null;
            }
        });

        // 모든 레이블과 텍스트 요소 제거
        const labels = svg.querySelectorAll('[id^="label-"], text, g[data-label], g[data-region-label], [class*="label"], [class*="rank"]');
        labels.forEach(label => {
            // 레이블의 이벤트 리스너도 제거
            if (label._mouseenterHandler) {
                label.removeEventListener('mouseenter', label._mouseenterHandler);
                label._mouseenterHandler = null;
            }
            if (label._mouseleaveHandler) {
                label.removeEventListener('mouseleave', label._mouseleaveHandler);
                label._mouseleaveHandler = null;
            }
            label.remove();
        });

        // 추가로 모든 텍스트 요소와 그룹 요소 중 레이블 관련 요소들 제거
        const allTexts = svg.querySelectorAll('text');
        allTexts.forEach(text => {
            if (text.textContent && (
                text.textContent.includes('위') ||
                text.textContent.match(/^\d+위$/) ||
                text.id.includes('label') ||
                text.getAttribute('data-region')
            )) {
                text.remove();
            }
        });

        // 모든 그룹 요소 중 레이블 관련 요소들 제거
        const allGroups = svg.querySelectorAll('g');
        allGroups.forEach(group => {
            if (group.id && (
                group.id.includes('label') ||
                group.id.includes('rank') ||
                group.getAttribute('data-region') ||
                group.getAttribute('data-label')
            )) {
                group.remove();
            }
        });

        // 모든 원형(circle), 타원(ellipse), 사각형(rect) 등 동적으로 추가된 도형 요소들 제거
        const allCircles = svg.querySelectorAll('circle');
        allCircles.forEach(circle => {
            // 레이블과 관련된 모든 circle 제거 (조건 완화)
            circle.remove();
        });

        // 툴팁 완전 제거
        const existingTooltip = document.getElementById('map-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }

        // 툴팁 관련 이벤트 리스너도 제거 (cropRankingAnalysis 인스턴스가 있는 경우)
        if (window.cropRankingAnalysis && window.cropRankingAnalysis.hideTooltip) {
            window.cropRankingAnalysis.hideTooltip();
        }

        const allEllipses = svg.querySelectorAll('ellipse');
        allEllipses.forEach(ellipse => {
            ellipse.remove();
        });

        const labelRects = svg.querySelectorAll('rect[class*="label"], rect[id*="label"], rect[data-region], rect[data-label]');
        labelRects.forEach(rect => {
            rect.remove();
        });

        // 모든 동적으로 추가된 요소들 제거 (data-dynamic 속성을 가진 요소들)
        const dynamicElements = svg.querySelectorAll('[data-dynamic], [data-added]');
        dynamicElements.forEach(element => element.remove());

        // 혹시 남아있는 모든 추가 요소들 강제 제거
        const allShapes = svg.querySelectorAll('circle, ellipse, rect, polygon, polyline, line');
        allShapes.forEach(shape => {
            // path 요소가 아닌 모든 도형 요소 중 원본이 아닌 것들 제거
            if (shape.tagName !== 'path' && !shape.hasAttribute('data-original')) {
                shape.remove();
            }
        });

        // 툴팁 숨기기
        this.hideMapTooltip();
    }

    // 지도 툴팁 표시
    showMapTooltip(event, region, value, unit, rank, cropName) {
        const tooltip = document.getElementById('map-tooltip');
        if (!tooltip) return;

        // 툴팁 내용 업데이트
        const regionDiv = tooltip.querySelector('.tooltip-region');
        const cropDiv = tooltip.querySelector('.tooltip-crop');
        const valueDiv = tooltip.querySelector('.tooltip-value');
        const rankDiv = tooltip.querySelector('.tooltip-rank');

        if (regionDiv) regionDiv.textContent = region;
        if (cropDiv) cropDiv.textContent = cropName || '선택된 작물';
        if (valueDiv) {
            const displayValue = value > 0 ? Math.round(value).toLocaleString() + unit : '데이터 없음';
            valueDiv.textContent = displayValue;
        }
        if (rankDiv) {
            const rankText = rank > 0 && value > 0 ? rank + '위' : '순위 외';
            rankDiv.textContent = rankText;
        }

        // 툴팁 위치 설정 및 표시
        this.updateTooltipPosition(event);
        tooltip.style.opacity = '1';
        tooltip.style.display = 'block';
    }

    // 지도 툴팁 숨기기
    hideMapTooltip() {
        const tooltip = document.getElementById('map-tooltip');
        if (tooltip) {
            tooltip.style.opacity = '0';
            setTimeout(() => {
                tooltip.style.display = 'none';
            }, 200); // transition 시간 후에 숨김
        }
    }

    // 툴팁 위치 업데이트
    updateTooltipPosition(event) {
        const tooltip = document.getElementById('map-tooltip');
        if (!tooltip) return;

        const offsetX = 15;
        const offsetY = -10;

        // 간단한 고정 위치로 테스트
        let left = event.clientX + offsetX;
        let top = event.clientY + offsetY;

        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
        tooltip.style.position = 'fixed';
    }

    // 히트맵 업데이트
    updateHeatmap() {
        const container = document.getElementById('crop-region-heatmap');
        if (!container) return;

        const filteredData = this.getFilteredData();
        const heatmapView = document.getElementById('heatmap-view')?.value || 'relative';

        // 히트맵 데이터 준비
        const heatmapData = this.prepareHeatmapData(filteredData, heatmapView);

        if (heatmapData.length === 0) {
            container.innerHTML = `
                <div class="heatmap-placeholder">
                    <i class="fas fa-th"></i>
                    <p>선택된 조건에 대한 데이터가 없습니다</p>
                    <small>필터 조건을 변경해보세요</small>
                </div>
            `;
            return;
        }

        // 히트맵 HTML 생성
        const heatmapHTML = this.generateHeatmapHTML(heatmapData, heatmapView);
        container.innerHTML = heatmapHTML;
    }

    // 히트맵 데이터 준비
    prepareHeatmapData(data, view) {
        // 전체 작목을 값 기준으로 정렬하고 상위 20개만 선택
        const sortedData = data
            .sort((a, b) => {
                const valueA = this.currentFilters.metric === 'area' ?
                    parseFloat(a['면적(ha)']) || 0 :
                    parseFloat(a['생산량(톤)']) || 0;
                const valueB = this.currentFilters.metric === 'area' ?
                    parseFloat(b['면적(ha)']) || 0 :
                    parseFloat(b['생산량(톤)']) || 0;
                return valueB - valueA;
            })
            .slice(0, 20);

        const heatmapData = [];

        sortedData.forEach(crop => {
            const gangwonValue = this.currentFilters.metric === 'area' ?
                parseFloat(crop['면적(ha)']) || 0 :
                parseFloat(crop['생산량(톤)']) || 0;
            const nationalValue = this.currentFilters.metric === 'area' ?
                parseFloat(crop['면적(ha)']) || 0 :
                parseFloat(crop['생산량(톤)']) || 0;

            let displayValue;
            if (view === 'relative') {
                // 상대값: 전국 대비 비율
                displayValue = nationalValue > 0 ? (gangwonValue / nationalValue * 100) : 0;
            } else {
                // 절대값
                displayValue = gangwonValue;
            }

            if (displayValue > 0) {
                heatmapData.push({
                    cropName: crop.cropName,
                    cropGroup: crop.cropGroup || '기타',
                    gangwonValue: gangwonValue,
                    nationalValue: nationalValue,
                    displayValue: displayValue,
                    sharePercentage: nationalValue > 0 ? (gangwonValue / nationalValue * 100) : 0
                });
            }
        });

        // 표시값 기준으로 정렬
        return heatmapData.sort((a, b) => b.displayValue - a.displayValue);
    }

    // 히트맵 HTML 생성
    generateHeatmapHTML(data, view) {
        if (data.length === 0) return '';

        // 값의 범위 계산
        const maxValue = Math.max(...data.map(d => d.displayValue));
        const minValue = Math.min(...data.map(d => d.displayValue));

        // 색상 강도 계산 함수
        const getColorIntensity = (value) => {
            if (maxValue === minValue) return 0.5;
            return (value - minValue) / (maxValue - minValue);
        };

        // 색상 계산 함수
        const getColor = (intensity) => {
            // 초록색 계열 그라데이션
            const baseColor = [20, 184, 166]; // teal-500
            const alpha = 0.2 + (intensity * 0.8); // 0.2 ~ 1.0
            return `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${alpha})`;
        };

        // 작목군별로 그룹화
        const groupedData = {};
        data.forEach(item => {
            if (!groupedData[item.cropGroup]) {
                groupedData[item.cropGroup] = [];
            }
            groupedData[item.cropGroup].push(item);
        });

        let html = `
            <div class="heatmap-grid">
                <div class="heatmap-header">
                    <h4>작목-지역별 ${view === 'relative' ? '점유율' : (this.currentFilters.metric === 'area' ? '재배면적' : '생산량')} 히트맵</h4>
                    <div class="heatmap-legend">
                        <span class="legend-label">낮음</span>
                        <div class="legend-gradient"></div>
                        <span class="legend-label">높음</span>
                    </div>
                </div>
                <div class="heatmap-content">
        `;

        Object.entries(groupedData).forEach(([group, items]) => {
            html += `
                <div class="heatmap-group">
                    <div class="heatmap-group-header">${group}</div>
                    <div class="heatmap-cells">
            `;

            items.forEach(item => {
                const intensity = getColorIntensity(item.displayValue);
                const backgroundColor = getColor(intensity);
                const textColor = intensity > 0.5 ? '#ffffff' : '#334155';

                const displayUnit = view === 'relative' ? '%' :
                    (this.currentFilters.metric === 'area' ? 'ha' : '톤');
                const displayValue = view === 'relative' ?
                    item.displayValue.toFixed(1) :
                    item.displayValue.toLocaleString();

                html += `
                    <div class="heatmap-cell"
                         style="background-color: ${backgroundColor}; color: ${textColor};"
                         data-crop="${item.cropName}"
                         data-value="${item.displayValue}"
                         data-gangwon="${item.gangwonValue}"
                         data-national="${item.nationalValue}"
                         data-share="${item.sharePercentage.toFixed(1)}"
                         title="${item.cropName}: ${displayValue}${displayUnit}">
                        <div class="cell-crop-name">${item.cropName}</div>
                        <div class="cell-value">${displayValue}${displayUnit}</div>
                        ${view === 'relative' ? '' : `<div class="cell-share">(${item.sharePercentage.toFixed(1)}%)</div>`}
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        return html;
    }

    // 지도 업데이트
    updateMap(selectedCrop) {
        const container = document.getElementById('korea-map');
        const legend = document.getElementById('map-legend');
        if (!container) return;

        const filteredData = this.getFilteredData();

        if (!selectedCrop) {
            // 작목이 선택되지 않은 경우 플레이스홀더 표시
            container.innerHTML = `
                <div class="map-placeholder">
                    <i class="fas fa-map"></i>
                    <p>지역별 재배현황 지도</p>
                    <small>작목을 선택하면 지역별 재배면적을 시각화합니다</small>
                </div>
            `;
            if (legend) legend.style.display = 'none';
            return;
        }

        // 선택된 작목 데이터 찾기
        const cropData = filteredData.filter(item => item.cropName === selectedCrop);
        if (cropData.length === 0) {
            container.innerHTML = `
                <div class="map-placeholder">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>선택된 작목에 대한 데이터가 없습니다</p>
                    <small>${selectedCrop}</small>
                </div>
            `;
            if (legend) legend.style.display = 'none';
            return;
        }

        // 순위표와 동일한 방식으로 데이터 처리
        let regionData = {};

        if (selectedCrop) {
            // 필터된 데이터에서 작목별 데이터 준비 (순위표와 동일한 방식)
            const cropGroups = {};
            const metric = this.currentFilters.metric || 'area';

            // 데이터 그룹화 (순위표와 동일한 로직)
            filteredData.forEach(item => {
                const key = `${item.작목군}|${item.작목명}`;
                if (!cropGroups[key]) {
                    const nationalTotal = metric === 'area'
                        ? parseFloat(item.면적) || 0
                        : parseFloat(item.생산량) || 0;

                    cropGroups[key] = {
                        cropGroup: item.작목군,
                        cropName: item.작목명,
                        nationalTotal: nationalTotal,
                        regions: []
                    };
                }
            });

            // 선택된 작목 찾기
            const cropForMap = Object.values(cropGroups).find(crop => crop.cropName === selectedCrop);

            if (cropForMap) {
                // 지도용으로 전체 지역 데이터 요청
                cropForMap.returnAllData = true;
                const gangwonData = cropForMap.regions.find(r => r.region === '강원');
                const gangwonValue = gangwonData ? (this.currentFilters.metric === 'area' ? gangwonData.area : gangwonData.production) : 0;
                const regionalMapData = [{
                    region: '강원',
                    value: gangwonValue,
                    percentage: 100
                }];
                cropForMap.returnAllData = false; // 플래그 초기화

                // 지도용 데이터 포맷으로 변환
                regionalMapData.forEach(regionInfo => {
                    regionData[regionInfo.region] = {
                        value: regionInfo.value,
                        percentage: regionInfo.percentage,
                        isMainRegion: regionInfo.region === '강원'
                    };
                });
            } else {
                // 기본 지역 데이터 (값이 0인 경우)
                const defaultRegions = ['강원', '경기', '충북', '충남', '경북', '경남', '전북', '전남', '제주'];
                defaultRegions.forEach(region => {
                    regionData[region] = {
                        value: 0,
                        percentage: 0,
                        isMainRegion: region === '강원'
                    };
                });
            }
        } else {
            // 작목이 선택되지 않은 경우
            const defaultRegions = ['강원', '경기', '충북', '충남', '경북', '경남', '전북', '전남', '제주'];
            defaultRegions.forEach(region => {
                regionData[region] = {
                    value: 0,
                    percentage: 0,
                    isMainRegion: region === '강원'
                };
            });
        }

        // SVG 지도 확인 및 처리
        let svg = container.querySelector('svg');

        // SVG가 없으면 로드 시도
        if (!svg) {
            console.log('SVG가 없어서 다시 로드 시도');
            // 외부 SVG 로드 상태 확인 후 정적 지도로 대체
            const mapSVG = this.generateKoreaMapSVG(regionData, selectedCrop);
            container.innerHTML = mapSVG;
            return;
        }

        // 기존 SVG가 있으면 색상과 라벨 적용
        if (Object.keys(regionData).length > 0) {
            console.log('기존 SVG에 데이터 적용');
            this.applyRegionDataToSVG(regionData, selectedCrop);
        } else {
            console.log('데이터가 없어서 초기화');
            // 데이터가 없으면 SVG 초기화 (색상 제거)
            this.clearSVGData(svg);
        }

        // 범례 업데이트
        this.updateMapLegend(regionData, selectedCrop, legend);
    }

    // 기존 SVG 지도에 지역 데이터 적용
    applyRegionDataToSVG(regionData, selectedCrop) {
        const svg = document.querySelector('#korea-svg-map svg');
        if (!svg) {
            console.warn('SVG 지도를 찾을 수 없습니다');
            return;
        }

        console.log('지역 데이터:', regionData);
        console.log('선택된 작목:', selectedCrop);

        // 순위 계산 (값 기준으로 정렬)
        const sortedRegions = Object.entries(regionData)
            .filter(([region, data]) => data.value > 0)
            .sort((a, b) => b[1].value - a[1].value);

        // 지역별 순위 맵 생성
        const rankMap = {};
        sortedRegions.forEach(([region, data], index) => {
            rankMap[region] = index + 1;
        });

        // 값의 범위 계산
        const values = Object.values(regionData).map(r => r.value);
        const maxValue = Math.max(...values);
        const minValue = Math.min(...values.filter(v => v > 0));

        // 색상 계산 함수
        const getRegionColor = (value, isMainRegion, rank) => {
            if (value === 0) return '#f8fafc'; // 데이터 없음

            // 순위별 색상 설정
            if (rank === 1) {
                return '#d97706'; // 1위 - 골드
            } else if (rank === 2) {
                return '#6b7280'; // 2위 - 실버
            } else if (rank === 3) {
                return '#92400e'; // 3위 - 브론즈
            } else if (isMainRegion) {
                return '#dc2626'; // 강원도 특별 표시
            } else {
                // 일반 지역 - 연한 블루
                const intensity = maxValue > minValue ? (value - minValue) / (maxValue - minValue) : 0.5;
                const colors = ['#dbeafe', '#93c5fd', '#60a5fa'];
                const colorIndex = Math.min(Math.floor(intensity * colors.length), colors.length - 1);
                return colors[colorIndex];
            }
        };

        // 모든 path 요소 처리 (일반적인 SVG 지도 구조)
        const paths = svg.querySelectorAll('path');

        // 지역명 매핑 (기본적인 매핑만)
        const regionMapping = {
            '강원도': '강원', '경기도': '경기', '충청북도': '충북', '충청남도': '충남',
            '경상북도': '경북', '경상남도': '경남', '전라북도': '전북', '전라남도': '전남',
            '제주도': '제주', '제주특별자치도': '제주'
        };

        paths.forEach((regionElement, index) => {
            // 지역명 추출
            let regionName = regionElement.getAttribute('id') ||
                            regionElement.getAttribute('data-name') ||
                            regionElement.getAttribute('title');

            if (!regionName) return;

            // 매핑을 통해 표준 지역명으로 변환
            let standardRegionName = regionMapping[regionName] || regionName;

            // 디버깅: 모든 요소의 정보 출력
            console.log(`Path ${index}:`, {
                originalName: regionName,
                standardName: standardRegionName,
                hasData: standardRegionName && regionData[standardRegionName] ? 'YES' : 'NO'
            });

            if (standardRegionName && regionData[standardRegionName]) {
                const data = regionData[standardRegionName];
                const rank = rankMap[standardRegionName] || 999;

                // 색상 적용
                const fillColor = getRegionColor(data.value, data.isMainRegion, rank);
                regionElement.style.fill = fillColor;

                // 툴팁 설정
                const percentage = data.percentage.toFixed(1);
                const unit = this.currentFilters.metric === 'area' ? 'ha' : 't';
                const rankText = rank <= Object.keys(rankMap).length ? `${rank}위` : '-';
                regionElement.setAttribute('title',
                    `${standardRegionName} (${rankText}): ${Math.round(data.value).toLocaleString()}${unit} (${percentage}%)`
                );

                // 라벨 표시 조건: 상위 3위 + 강원도(항상 표시)
                const shouldShowLabel = (rank >= 1 && rank <= 3) || standardRegionName === '강원';

                if (shouldShowLabel) {
                    this.addRegionLabelToSVG(svg, regionElement, standardRegionName, data.value, unit, rank);
                } else {
                    this.removeRegionLabelFromSVG(svg, standardRegionName);
                }
            }
        });
    }

    // SVG에 지역 라벨 추가
    addRegionLabelToSVG(svg, regionElement, region, value, unit, rank) {
        // 기존 레이블 제거
        this.removeRegionLabelFromSVG(svg, region);

        // 지역 요소의 중심점 계산
        const bbox = regionElement.getBBox();
        let centerX = bbox.x + bbox.width / 2;
        let centerY = bbox.y + bbox.height / 2;

        // 지역별 위치 조정 (앞서 수정한 것과 동일)
        const regionAdjustments = {
            '강원': { x: 5, y: -15 },
            '경기': { x: -10, y: -8 },
            '서울': { x: -20, y: -12 },
            '인천': { x: -30, y: -5 },
            '충북': { x: -8, y: 5 },
            '충남': { x: -18, y: 8 },
            '대전': { x: -15, y: 12 },
            '세종': { x: -20, y: 5 },
            '전북': { x: -12, y: 12 },
            '경북': { x: 10, y: -8 },
            '대구': { x: 5, y: 8 },
            '전남': { x: -8, y: 15 },
            '광주': { x: -15, y: 12 },
            '경남': { x: -5, y: 8 },
            '부산': { x: 8, y: 12 },
            '울산': { x: 12, y: 5 },
            '제주': { x: -8, y: 8 }
        };

        if (regionAdjustments[region]) {
            centerX += regionAdjustments[region].x;
            centerY += regionAdjustments[region].y;
        }

        // 라벨 텍스트 생성
        const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        labelGroup.setAttribute('id', `label-${region}`);

        // 지역명 텍스트
        const regionText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        regionText.setAttribute('x', centerX);
        regionText.setAttribute('y', centerY - 8);
        regionText.setAttribute('text-anchor', 'middle');
        regionText.setAttribute('class', region === '강원' ? 'region-label main-region' : 'region-label');
        regionText.textContent = region;

        // 순위 텍스트
        if (rank <= 3) {
            const rankText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            rankText.setAttribute('x', centerX);
            rankText.setAttribute('y', centerY + 8);
            rankText.setAttribute('text-anchor', 'middle');
            rankText.setAttribute('class', 'region-rank');
            rankText.textContent = `${rank}위`;
            labelGroup.appendChild(rankText);
        }

        labelGroup.appendChild(regionText);
        svg.appendChild(labelGroup);
    }

    // SVG에서 지역 라벨 제거
    removeRegionLabelFromSVG(svg, region) {
        const existingLabel = svg.querySelector(`#label-${region}`);
        if (existingLabel) {
            existingLabel.remove();
        }
    }

    // SVG 데이터 초기화 (색상 및 라벨 제거)
    clearSVGData(svg) {
        if (!svg) return;

        // 모든 path 요소의 색상 초기화
        const paths = svg.querySelectorAll('path');
        paths.forEach(path => {
            path.style.fill = 'none';
            path.style.stroke = '#000000';
            path.style.strokeWidth = '1';
            path.removeAttribute('title');
        });

        // 모든 라벨 제거
        const labels = svg.querySelectorAll('[id^="label-"]');
        labels.forEach(label => label.remove());
    }

    // 지도 데이터 준비
    prepareMapData(cropData, selectedCrop) {
        // 강원 지역 데이터
        const gangwonValue = this.currentFilters.metric === 'area' ?
            cropData.reduce((sum, item) => sum + (parseFloat(item.gangwonArea) || 0), 0) :
            cropData.reduce((sum, item) => sum + (parseFloat(item.gangwonProduction) || 0), 0);

        const nationalValue = this.currentFilters.metric === 'area' ?
            cropData.reduce((sum, item) => sum + (parseFloat(item.nationalArea) || 0), 0) :
            cropData.reduce((sum, item) => sum + (parseFloat(item.nationalProduction) || 0), 0);

        // 지역별 데이터
        const regions = {
            '강원': {
                value: gangwonValue,
                percentage: nationalValue > 0 ? (gangwonValue / nationalValue * 100) : 0,
                isMainRegion: true
            },
            '경기': {
                value: nationalValue * 0.15, // 전국의 15%로 가정
                percentage: 15,
                isMainRegion: false
            },
            '충북': {
                value: nationalValue * 0.12,
                percentage: 12,
                isMainRegion: false
            },
            '충남': {
                value: nationalValue * 0.18,
                percentage: 18,
                isMainRegion: false
            },
            '경북': {
                value: nationalValue * 0.20,
                percentage: 20,
                isMainRegion: false
            },
            '경남': {
                value: nationalValue * 0.15,
                percentage: 15,
                isMainRegion: false
            },
            '전북': {
                value: nationalValue * 0.10,
                percentage: 10,
                isMainRegion: false
            },
            '전남': {
                value: nationalValue * 0.08,
                percentage: 8,
                isMainRegion: false
            },
            '제주': {
                value: nationalValue * 0.02,
                percentage: 2,
                isMainRegion: false
            }
        };

        return regions;
    }

    // 한국 지도 SVG 생성
    generateKoreaMapSVG(regionData, selectedCrop) {
        // 값의 범위 계산
        const values = Object.values(regionData).map(r => r.value);
        const maxValue = Math.max(...values);
        const minValue = Math.min(...values.filter(v => v > 0));

        // 순위 계산 (값 기준으로 정렬)
        const sortedRegions = Object.entries(regionData)
            .filter(([region, data]) => data.value > 0)
            .sort((a, b) => b[1].value - a[1].value);

        // 지역별 순위 맵 생성
        const rankMap = {};
        sortedRegions.forEach(([region, data], index) => {
            rankMap[region] = index + 1;
        });

        // 색상 계산 함수 (순위별 색상 개선)
        const getRegionColor = (value, isMainRegion, rank) => {
            if (value === 0) return '#f8fafc'; // 데이터 없음 - 매우 연한 회색

            const intensity = maxValue > minValue ? (value - minValue) / (maxValue - minValue) : 0.5;

            // 순위별 색상 설정
            if (rank === 1) {
                // 1위 - 골드 계열 (가장 진한 색상)
                return '#d97706';
            } else if (rank === 2) {
                // 2위 - 실버 계열
                return '#6b7280';
            } else if (rank === 3) {
                // 3위 - 브론즈 계열
                return '#92400e';
            } else if (isMainRegion) {
                // 강원도 특별 표시 (순위와 관계없이)
                return '#dc2626';
            } else {
                // 일반 지역 - 블루 그라데이션 (연한 색상)
                const colors = ['#dbeafe', '#93c5fd', '#60a5fa'];
                const colorIndex = Math.min(Math.floor(intensity * colors.length), colors.length - 1);
                return colors[colorIndex];
            }
        };

        // 간단한 한국 지도 SVG (시각적 표현을 위한 단순화된 형태)
        return `
            <div class="korea-map-container">
                <svg viewBox="0 0 400 300" class="korea-map-svg">
                    <!-- 그라데이션 정의 -->
                    <defs>
                        <linearGradient id="mapBackground" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#f8fafc"/>
                            <stop offset="100%" stop-color="#f1f5f9"/>
                        </linearGradient>
                        <filter id="mapShadow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.1)"/>
                        </filter>
                    </defs>

                    <!-- 배경 -->
                    <rect width="100%" height="100%" fill="url(#mapBackground)"/>

                    <!-- 한국 지도 단순화된 형태 -->
                    <!-- 강원도 -->
                    <path d="M 160 60 L 220 50 L 250 80 L 240 120 L 180 130 L 150 100 Z"
                          fill="${getRegionColor(regionData['강원'].value, regionData['강원'].isMainRegion, rankMap['강원'] || 999)}"
                          stroke="#e2e8f0" stroke-width="1.5"
                          class="map-region" filter="url(#mapShadow)" data-region="강원"
                          data-value="${regionData['강원'].value.toLocaleString()}"
                          data-percentage="${regionData['강원'].percentage.toFixed(1)}">
                        <title>강원: ${regionData['강원'].value.toLocaleString()}${this.currentFilters.metric === 'area' ? 'ha' : '톤'}</title>
                    </path>

                    <!-- 경기도 -->
                    <path d="M 120 100 L 160 90 L 150 130 L 110 140 L 100 120 Z"
                          fill="${getRegionColor(regionData['경기'].value, regionData['경기'].isMainRegion, rankMap['경기'] || 999)}"
                          stroke="#e2e8f0" stroke-width="1.5"
                          class="map-region" filter="url(#mapShadow)" data-region="경기"
                          data-value="${regionData['경기'].value.toLocaleString()}"
                          data-percentage="${regionData['경기'].percentage.toFixed(1)}">
                        <title>경기: ${regionData['경기'].value.toLocaleString()}${this.currentFilters.metric === 'area' ? 'ha' : '톤'}</title>
                    </path>

                    <!-- 충청북도 -->
                    <path d="M 110 140 L 150 130 L 140 170 L 100 180 L 90 160 Z"
                          fill="${getRegionColor(regionData['충북'].value, regionData['충북'].isMainRegion, rankMap['충북'] || 999)}"
                          stroke="#e2e8f0" stroke-width="1.5"
                          class="map-region" filter="url(#mapShadow)" data-region="충북"
                          data-value="${regionData['충북'].value.toLocaleString()}"
                          data-percentage="${regionData['충북'].percentage.toFixed(1)}">
                        <title>충북: ${regionData['충북'].value.toLocaleString()}${this.currentFilters.metric === 'area' ? 'ha' : '톤'}</title>
                    </path>

                    <!-- 충청남도 -->
                    <path d="M 60 160 L 100 150 L 90 190 L 50 200 L 40 180 Z"
                          fill="${getRegionColor(regionData['충남'].value, regionData['충남'].isMainRegion, rankMap['충남'] || 999)}"
                          stroke="#e2e8f0" stroke-width="1.5"
                          class="map-region" filter="url(#mapShadow)" data-region="충남"
                          data-value="${regionData['충남'].value.toLocaleString()}"
                          data-percentage="${regionData['충남'].percentage.toFixed(1)}">
                        <title>충남: ${regionData['충남'].value.toLocaleString()}${this.currentFilters.metric === 'area' ? 'ha' : '톤'}</title>
                    </path>

                    <!-- 경상북도 -->
                    <path d="M 180 130 L 240 120 L 280 150 L 270 200 L 200 210 L 170 180 Z"
                          fill="${getRegionColor(regionData['경북'].value, regionData['경북'].isMainRegion, rankMap['경북'] || 999)}"
                          stroke="#e2e8f0" stroke-width="1.5"
                          class="map-region" filter="url(#mapShadow)" data-region="경북"
                          data-value="${regionData['경북'].value.toLocaleString()}"
                          data-percentage="${regionData['경북'].percentage.toFixed(1)}">
                        <title>경북: ${regionData['경북'].value.toLocaleString()}${this.currentFilters.metric === 'area' ? 'ha' : '톤'}</title>
                    </path>

                    <!-- 경상남도 -->
                    <path d="M 170 180 L 200 210 L 190 250 L 140 260 L 130 220 Z"
                          fill="${getRegionColor(regionData['경남'].value, regionData['경남'].isMainRegion, rankMap['경남'] || 999)}"
                          stroke="#e2e8f0" stroke-width="1.5"
                          class="map-region" filter="url(#mapShadow)" data-region="경남"
                          data-value="${regionData['경남'].value.toLocaleString()}"
                          data-percentage="${regionData['경남'].percentage.toFixed(1)}">
                        <title>경남: ${regionData['경남'].value.toLocaleString()}${this.currentFilters.metric === 'area' ? 'ha' : '톤'}</title>
                    </path>

                    <!-- 전라북도 -->
                    <path d="M 90 190 L 130 180 L 120 220 L 80 230 L 70 210 Z"
                          fill="${getRegionColor(regionData['전북'].value, regionData['전북'].isMainRegion, rankMap['전북'] || 999)}"
                          stroke="#e2e8f0" stroke-width="1.5"
                          class="map-region" filter="url(#mapShadow)" data-region="전북"
                          data-value="${regionData['전북'].value.toLocaleString()}"
                          data-percentage="${regionData['전북'].percentage.toFixed(1)}">
                        <title>전북: ${regionData['전북'].value.toLocaleString()}${this.currentFilters.metric === 'area' ? 'ha' : '톤'}</title>
                    </path>

                    <!-- 전라남도 -->
                    <path d="M 70 210 L 120 200 L 110 240 L 60 250 L 50 230 Z"
                          fill="${getRegionColor(regionData['전남'].value, regionData['전남'].isMainRegion, rankMap['전남'] || 999)}"
                          stroke="#e2e8f0" stroke-width="1.5"
                          class="map-region" filter="url(#mapShadow)" data-region="전남"
                          data-value="${regionData['전남'].value.toLocaleString()}"
                          data-percentage="${regionData['전남'].percentage.toFixed(1)}">
                        <title>전남: ${regionData['전남'].value.toLocaleString()}${this.currentFilters.metric === 'area' ? 'ha' : '톤'}</title>
                    </path>

                    <!-- 제주도 -->
                    <circle cx="80" cy="280" r="15"
                            fill="${getRegionColor(regionData['제주'].value, regionData['제주'].isMainRegion, rankMap['제주'] || 999)}"
                            stroke="#e2e8f0" stroke-width="1.5"
                            class="map-region" filter="url(#mapShadow)" data-region="제주"
                            data-value="${regionData['제주'].value.toLocaleString()}"
                            data-percentage="${regionData['제주'].percentage.toFixed(1)}">
                        <title>제주: ${regionData['제주'].value.toLocaleString()}${this.currentFilters.metric === 'area' ? 'ha' : '톤'}</title>
                    </circle>

                    <!-- 지역 라벨 (위치 개선) -->
                    <text x="205" y="90" text-anchor="middle" class="region-label main-region">강원</text>
                    <text x="115" y="107" text-anchor="middle" class="region-label">경기</text>
                    <text x="112" y="158" text-anchor="middle" class="region-label">충북</text>
                    <text x="52" y="183" text-anchor="middle" class="region-label">충남</text>
                    <text x="235" y="157" text-anchor="middle" class="region-label">경북</text>
                    <text x="155" y="233" text-anchor="middle" class="region-label">경남</text>
                    <text x="88" y="217" text-anchor="middle" class="region-label">전북</text>
                    <text x="77" y="245" text-anchor="middle" class="region-label">전남</text>
                    <text x="72" y="288" text-anchor="middle" class="region-label">제주</text>
                </svg>

                <div class="map-info">
                    <h4>${selectedCrop} 지역별 ${this.currentFilters.metric === 'area' ? '재배면적' : '생산량'}</h4>
                    <p class="map-note">* 강원도 데이터를 기준으로 표시됩니다</p>
                </div>
            </div>
        `;
    }

    // 지도 범례 업데이트
    updateMapLegend(regionData, selectedCrop, legend) {
        if (!legend) return;

        const values = Object.values(regionData).map(r => r.value).filter(v => v > 0);
        const maxValue = Math.max(...values);
        const minValue = Math.min(...values);

        const unit = this.currentFilters.metric === 'area' ? 'ha' : '톤';

        legend.innerHTML = `
            <div class="legend-header">
                <h5>${selectedCrop} ${this.currentFilters.metric === 'area' ? '재배면적' : '생산량'} 분포</h5>
            </div>
            <div class="legend-scale">
                <div class="legend-gradient-bar"></div>
                <div class="legend-labels">
                    <span>${minValue.toLocaleString()}${unit}</span>
                    <span>${maxValue.toLocaleString()}${unit}</span>
                </div>
            </div>
            <div class="legend-special">
                <div class="legend-item">
                    <div class="legend-color main-region"></div>
                    <span>강원도 (실제 데이터)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color other-region"></div>
                    <span>기타 지역 (참고용)</span>
                </div>
            </div>
        `;

        legend.style.display = 'block';
    }


    // 필터 옵션 업데이트
    updateFilterOptions() {
        // 평면 지도 및 분포 차트용 작목 필터 업데이트
        const simpleMapFilter = document.getElementById('simple-map-crop-filter');
        const distributionFilter = document.getElementById('distribution-crop-filter');

        const filteredData = this.getFilteredData();
        const crops = [...new Set(filteredData.map(item => item.작목명))].sort();

        const optionsHTML = '<option value="">작목 선택</option>' +
            crops.map(crop => `<option value="${crop}">${crop}</option>`).join('');

        if (simpleMapFilter) simpleMapFilter.innerHTML = optionsHTML;
        if (distributionFilter) distributionFilter.innerHTML = optionsHTML;
    }

    // 평면 지도 작목 옵션 업데이트 (작목군 필터링)
    async updateSimpleMapCropOptions(selectedCropGroup = '') {
        const simpleMapFilter = document.getElementById('simple-map-crop-filter');
        if (!simpleMapFilter) return;

        const filteredData = this.getFilteredData();
        let crops;

        if (selectedCropGroup) {
            // 선택된 작목군의 작물만 필터링
            crops = [...new Set(filteredData
                .filter(item => item.작목군 === selectedCropGroup)
                .map(item => item.작목명))].sort();
        } else {
            // 모든 작물
            crops = [...new Set(filteredData.map(item => item.작목명))].sort();
        }

        const optionsHTML = '<option value="">작목 선택</option>' +
            crops.map(crop => '<option value="' + crop + '">' + crop + '</option>').join('');

        simpleMapFilter.innerHTML = optionsHTML;

        // 지도 초기화 (빈 상태로 유지)
        this.clearMapRegions();
        const mapInfo = document.getElementById('simple-map-info');
        if (mapInfo) {
            mapInfo.innerHTML = '<p>작목을 선택하면 지역별 재배 현황을 보여줍니다</p>';
        }
        // 헤더도 초기화
        this.updateSimpleMapHeader('');
        this.updateYearlyTrendTable('');
    }

    // 지역별 순위 테이블 업데이트
    updateRegionalRankingTable() {
        const tbody = document.getElementById('regional-ranking-tbody');
        const cropGroupFilter = document.getElementById('ranking-crop-group-filter');

        if (!tbody) return;

        const selectedGroup = cropGroupFilter?.value || '';
        const tableCountSelect = document.getElementById('ranking-table-count');
        const selectedCount = tableCountSelect?.value || '20';
        const maxCount = selectedCount === 'all' ? Infinity : parseInt(selectedCount);

        // 테이블 전용 metric 값 가져오기
        const tableMetricSelect = document.getElementById('ranking-table-metric');
        const metric = tableMetricSelect?.value || this.currentFilters.metric || 'area';

        console.log('테이블 업데이트 - metric:', metric, 'selectedGroup:', selectedGroup);
        const topCount = 5; // 고정값으로 TOP 5 사용
        const filteredData = this.getFilteredData();

        // 테이블 헤더 동적 업데이트
        const totalHeader = document.querySelector('.total-col');
        if (totalHeader) {
            totalHeader.textContent = metric === 'area' ? '전국(면적)' : '전국(생산량)';
        }

        // 작목군+작목명으로 데이터 그룹화
        const cropGroups = {};
        filteredData.forEach(item => {
            // 작목군 필터링
            if (selectedGroup && item.작목군 !== selectedGroup) {
                return;
            }

            const cropKey = `${item.작목군}_${item.작목명}`; // 작목군과 작목명을 조합한 키
            if (!cropGroups[cropKey]) {
                cropGroups[cropKey] = {
                    cropName: item.작목명,
                    cropGroup: item.작목군,
                    nationalTotal: 0,
                    regions: []
                };
            }

            // 전국 데이터인 경우
            if (item.지역 === '전국') {
                const nationalValue = metric === 'area' ?
                    parseFloat(item['면적(ha)']) || 0 :
                    parseFloat(item['생산량(톤)']) || 0;
                cropGroups[cropKey].nationalTotal = nationalValue;
            }

            // 모든 지역 데이터 처리 (전국 제외)
            if (item.지역 !== '전국') {
                const regionValue = metric === 'area' ?
                    parseFloat(item['면적(ha)']) || 0 :
                    parseFloat(item['생산량(톤)']) || 0;

                // 모든 지역 데이터 추가
                cropGroups[cropKey].regions.push({
                    region: item.지역,
                    value: regionValue,
                    percentage: 0 // 나중에 계산
                });
            }
        });

        // 강원 데이터의 비율 계산
        Object.values(cropGroups).forEach(crop => {
            if (crop.regions.length > 0 && crop.nationalTotal > 0) {
                crop.regions.forEach(region => {
                    region.percentage = (region.value / crop.nationalTotal * 100);
                });
            }
        });

        // 빠른 검색 필터링 및 상위 작목 선택 (강원도 데이터 있는 작물 우선)
        const quickSearch = this.currentFilters.quickSearch || '';
        const allCrops = Object.values(cropGroups)
            .filter(crop => {
                // 기본 필터링 (0 이상의 값 포함)
                if (crop.nationalTotal < 0) return false;

                // 빠른 검색 필터링 (작목명에 검색어 포함)
                if (quickSearch) {
                    return crop.cropName.toLowerCase().includes(quickSearch.toLowerCase());
                }

                return true;
            })
            .sort((a, b) => b.nationalTotal - a.nationalTotal);

        // 모든 작물에 대해 강원도 데이터 확인
        allCrops.forEach(crop => {
            // 강원도 데이터가 없으면 기본값으로 초기화
            if (!crop.regions.some(r => r.region === '강원')) {
                crop.regions.push({
                    region: '강원',
                    value: 0,
                    percentage: 0
                });
            }
        });

        // 상위 작물 선택 (이제 모든 작물이 강원도 데이터를 가짐)
        const topCrops = allCrops.slice(0, maxCount);

        console.log(`표시할 작물 수: ${topCrops.length}/${allCrops.length}`);

        // 테이블 생성
        tbody.innerHTML = topCrops.map(crop => {
            const unit = metric === 'area' ? 'ha' : 't';

            // 모든 지역 데이터를 값 기준으로 정렬하고 개별 순위 부여
            const sortedRegions = [...crop.regions].sort((a, b) => {
                if (b.value !== a.value) {
                    return b.value - a.value; // 값이 다르면 값 기준 정렬
                }
                return a.region.localeCompare(b.region); // 값이 같으면 지역명 가나다순
            });

            // 순위 맵 생성 (개별 순위 부여)
            const rankMap = {};
            let currentRank = 1;
            let previousValue = null;
            let sameValueCount = 0;

            sortedRegions.forEach((region, index) => {
                if (previousValue !== null && region.value === previousValue) {
                    // 같은 값이지만 개별 순위 부여
                    sameValueCount++;
                    rankMap[region.region] = currentRank + sameValueCount;
                } else {
                    // 새로운 값
                    if (previousValue !== null) {
                        currentRank += sameValueCount + 1;
                    }
                    sameValueCount = 0;
                    rankMap[region.region] = currentRank;
                    previousValue = region.value;
                }
            });

            // 0값 지역들을 마지막 순위부터 역순 배치
            const zeroValueRegions = sortedRegions.filter(r => r.value === 0);
            if (zeroValueRegions.length > 0) {
                const totalRegions = sortedRegions.length;
                zeroValueRegions.forEach((region, index) => {
                    rankMap[region.region] = totalRegions - index;
                });
            }

            const regionalData = sortedRegions;

            // 강원도 데이터 찾기
            const gangwonData = crop.regions.find(r => r.region === '강원');
            const gangwonValue = gangwonData ? gangwonData.value : 0;
            let gangwonHTML = '';

            // 강원도 순위 가져오기
            const gangwonRank = rankMap['강원'] || sortedRegions.length;

            console.log(`${crop.cropName} - 강원도 순위: ${gangwonRank}, 전체 지역 수: ${regionalData.length}`);

            // 강원도 데이터가 있으면 항상 표시 (값이 0이어도 실제 순위 표시)
            if (gangwonData) {
                const value = gangwonData.value || 0;
                const percentage = gangwonData.percentage || 0;

                const safeValue = (typeof value === 'number' && !isNaN(value)) ? value : 0;
                const safePercentage = (typeof percentage === 'number' && !isNaN(percentage)) ? percentage : 0;

                gangwonHTML = `
                    <span class="gangwon-rank">${gangwonRank}위</span>
                    <span class="gangwon-details">(${Math.round(safeValue).toLocaleString()}${unit}, ${safePercentage.toFixed(1)}%)</span>
                `;
            } else {
                gangwonHTML = '<span class="gangwon-no-data">-위 (0${unit}, 0.0%)</span>';
            }

            let rowHTML = `
                <tr>
                    <td class="crop-group">${crop.cropGroup}</td>
                    <td class="crop-name">${crop.cropName}</td>
                    <td class="total-value">${Math.round(crop.nationalTotal || 0).toLocaleString()}${unit}</td>
                    <td class="gangwon-data">${gangwonHTML}</td>
            `;

            // 1-5위 열에는 순수하게 상위 5개 지역만 표시
            const displayRegions = regionalData.slice(0, topCount);

            // 순위별 지역 데이터 추가 (순수하게 1-5위만 표시)
            for (let rank = 1; rank <= topCount; rank++) {
                const regionData = displayRegions[rank - 1];
                if (regionData) {
                    const isGangwon = regionData.region === '강원';

                    const safeRegionValue = (typeof regionData.value === 'number' && !isNaN(regionData.value)) ? regionData.value : 0;
                    const safeRegionPercentage = (typeof regionData.percentage === 'number' && !isNaN(regionData.percentage)) ? regionData.percentage : 0;

                    rowHTML += `
                        <td class="rank-data rank-${rank} ${isGangwon ? 'gangwon-highlight' : ''}">
                            <span class="rank-region">${regionData.region}</span>
                            <span class="rank-details">(${Math.round(safeRegionValue).toLocaleString()}${unit}, ${safeRegionPercentage.toFixed(1)}%)</span>
                        </td>
                    `;
                } else {
                    rowHTML += `<td class="rank-data rank-${rank}">-</td>`;
                }
            }

            rowHTML += '</tr>';
            return rowHTML;
        }).join('');

        // 테이블 정보 업데이트
        const tableInfo = document.getElementById('ranking-table-info');
        if (tableInfo) {
            const allCrops = Object.values(cropGroups).filter(crop => crop.nationalTotal >= 0);
            const totalCrops = allCrops.length;
            const displayedCrops = topCrops.length;
            const groupText = selectedGroup ? ` (${selectedGroup})` : '';
            const searchText = quickSearch ? ` "${quickSearch}" 검색결과` : '';

            tableInfo.innerHTML = `
                <div class="table-info-content">
                    <span>전체 ${totalCrops}개 작목${groupText}${searchText} 중 ${displayedCrops}개 표시</span>
                </div>
            `;
        }
    }



    // 초기화
    async initialize() {
        try {
            // SVG 지도 미리 로드
            await this.loadSVGMap();

            // 연도 옵션 설정
            await this.setupYearOptions();

            // 작목군 필터 설정
            this.setupCropGroupFilter();

            // 초기 분석 실행
            await this.updateAnalysis();

            // 초기 표 표시
            this.updateYearlyTrendTable();


        } catch (error) {
        }
    }

    // 연도 옵션 설정
    async setupYearOptions() {
        const yearSelect = document.getElementById('crop-ranking-year');
        if (!yearSelect || appState.data.raw.length === 0) return;

        // DB에서 실제 연도 데이터 추출
        const years = [...new Set(appState.data.raw.map(item => item.연도))].sort().reverse();

        if (years.length === 0) return;

        // 최신 연도가 기본값이 되도록 설정
        const latestYear = years[0];

        // 연도 옵션 생성 (최신 연도가 선택된 상태)
        yearSelect.innerHTML = years.map(year =>
            `<option value="${year}" ${year === latestYear ? 'selected' : ''}>${year}년</option>`
        ).join('');

        // 현재 필터를 최신 연도로 설정
        this.currentFilters.year = latestYear;
    }

    // 작목군 필터 설정
    setupCropGroupFilter() {
        const cropGroupFilter = document.getElementById('ranking-crop-group-filter');
        if (!cropGroupFilter || appState.data.raw.length === 0) return;

        // 현재 선택된 연도에 해당하는 데이터에서 작목군 목록 추출
        const filteredData = this.getFilteredData();
        const cropGroups = [...new Set(filteredData.map(item => item.작목군))].sort();

        // 옵션 생성
        const optionsHTML = '<option value="">전체 작목군</option>' +
            cropGroups.map(group => `<option value="${group}">${group}</option>`).join('');

        cropGroupFilter.innerHTML = optionsHTML;

        // multiple 속성 제거 (단일 선택 모드로 설정)
        cropGroupFilter.removeAttribute('multiple');

        // 이벤트 리스너 추가 (이미 추가된 경우 중복 방지)
        if (!cropGroupFilter.dataset.listenerAdded) {
            cropGroupFilter.addEventListener('change', (e) => {
                console.log('작목군 필터 변경:', e.target.value);
                this.updateRegionalRankingTable();
            });
            cropGroupFilter.dataset.listenerAdded = 'true';
        }
    }

    // SVG 지도 로드 및 업데이트
    async loadAndUpdateSVGMap(regionalData, selectedCrop, metric) {
        console.log('loadAndUpdateSVGMap 호출됨:', selectedCrop, regionalData?.length);
        const mapContainer = document.getElementById('korea-svg-map');
        if (!mapContainer) {
            console.error('korea-svg-map 컨테이너를 찾을 수 없음');
            return;
        }

        // SVG가 아직 로드되지 않았으면 로드
        if (!mapContainer.querySelector('svg')) {
            console.log('SVG 없음, 로드 중...');
            await this.loadSVGMap();
        } else {
            console.log('SVG 이미 존재함');
        }

        // 데이터 적용
        console.log('applySVGRegionData 호출 예정');
        this.applySVGRegionData(regionalData, selectedCrop, metric);
    }

    // SVG 지도 로드
    async loadSVGMap() {
        const mapContainer = document.getElementById('korea-svg-map');
        if (!mapContainer) return;

        try {
            console.log('SVG 지도 로드 시작...');
            const response = await fetch('https://raw.githubusercontent.com/soonpark2/project2/main/전국_시도_경계.svg');

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const svgText = await response.text();

            if (!svgText || svgText.trim() === '') {
                throw new Error('SVG 파일이 비어있습니다');
            }

            mapContainer.innerHTML = svgText;
            console.log('SVG 지도 로드 완료');

            // SVG가 제대로 로드되었는지 확인
            const svg = mapContainer.querySelector('svg');
            if (!svg) {
                throw new Error('SVG 요소를 찾을 수 없습니다');
            }

        } catch (error) {
            console.error('SVG 지도 로드 실패:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack
            });

            // 간단한 한국 지도 fallback
            mapContainer.innerHTML = `
                <div class="map-fallback">
                    <svg viewBox="0 0 400 300" style="width: 100%; height: 300px;">
                        <rect width="100%" height="100%" fill="#f8fafc" stroke="#e2e8f0"/>
                        <text x="200" y="150" text-anchor="middle" fill="#6b7280" font-size="16">
                            지도를 불러올 수 없습니다
                        </text>
                        <text x="200" y="170" text-anchor="middle" fill="#9ca3af" font-size="12">
                            네트워크 연결을 확인해주세요
                        </text>
                    </svg>
                </div>
            `;
        }
    }

    // SVG 지역 데이터 적용
    applySVGRegionData(regionalData, selectedCrop, metric) {
        const mapContainer = document.getElementById('korea-svg-map');
        const svg = mapContainer?.querySelector('svg');
        if (!svg || !regionalData) return;

        console.log('SVG 데이터 적용 시작:', regionalData);

        // 작목명 설정 (빈 문자열이면 기본 메시지)
        const cropName = selectedCrop || '선택된 작물';

        // 지역명 매핑 (실제 SVG의 id 기준)
        const regionMapping = {
            '강원': ['강원도', '강원특별자치도', '강원'],
            '경기': ['경기도', '경기'],
            '경북': ['경상북도', '경북'],
            '경남': ['경상남도', '경남'],
            '전북': ['전라북도', '전북'],
            '전남': ['전라남도', '전남'],
            '충북': ['충청북도', '충북'],
            '충남': ['충청남도', '충남'],
            '제주': ['제주특별자치도', '제주도', '제주'],
            '서울': ['서울특별시', '서울'],
            '부산': ['부산광역시', '부산'],
            '대구': ['대구광역시', '대구'],
            '인천': ['인천광역시', '인천'],
            '광주': ['광주광역시', '광주'],
            '대전': ['대전광역시', '대전'],
            '울산': ['울산광역시', '울산'],
            '세종': ['세종특별자치시', '세종']
        };

        // 최대값 계산 (색상 정규화용)
        const maxValue = Math.max(...regionalData.map(item => item.value));

        // 순위별 정렬
        const sortedData = [...regionalData].sort((a, b) => b.value - a.value);

        // 모든 지역 path 요소 초기화
        const allPaths = svg.querySelectorAll('path');
        console.log('SVG에서 찾은 모든 path 요소들:', allPaths.length);
        console.log('Path ID들:', Array.from(allPaths).map(p => p.id));

        allPaths.forEach(path => {
            path.style.fill = '#f0f0f0';
            path.style.stroke = '#999';
            path.style.strokeWidth = '1';

            // 기존 라벨 제거 (이벤트 리스너도 함께 정리)
            const existingLabels = svg.querySelectorAll(`g[data-region]`);
            existingLabels.forEach(label => {
                // 이벤트 리스너 제거
                if (label._mouseenterHandler) {
                    label.removeEventListener('mouseenter', label._mouseenterHandler);
                }
                if (label._mouseleaveHandler) {
                    label.removeEventListener('mouseleave', label._mouseleaveHandler);
                }
                label.remove();
            });
        });

        // 지역별 데이터 적용
        regionalData.forEach((regionData, index) => {
            const { region, value } = regionData;
            // 값이 0보다 큰 경우만 순위에 포함, 0인 경우는 순위 없음으로 처리
            const rank = value > 0 ? (sortedData.findIndex(item => item.region === region) + 1) : null;

            // 해당 지역의 SVG path 찾기
            let targetPath = null;
            const possibleNames = regionMapping[region] || [region];

            // 다양한 방법으로 path 찾기
            for (const name of possibleNames) {
                // 정확한 id 매치
                targetPath = svg.querySelector(`path[id="${name}"]`);
                if (targetPath) {
                    console.log(`정확한 ID로 찾음: ${region} -> ${name}`);
                    break;
                }

                // 부분 id 매치
                targetPath = svg.querySelector(`path[id*="${name}"]`);
                if (targetPath) {
                    console.log(`부분 ID로 찾음: ${region} -> ${name} (실제 ID: ${targetPath.id})`);
                    break;
                }

                // title 속성 매치
                targetPath = svg.querySelector(`path[title*="${name}"]`);
                if (targetPath) {
                    console.log(`Title로 찾음: ${region} -> ${name}`);
                    break;
                }
            }

            if (!targetPath) {
                console.warn(`SVG path not found for region: ${region}, 시도한 이름들:`, possibleNames);
                return;
            }

            console.log(`지역 매핑 성공: ${region} -> ${targetPath.id}`);


            // 색상 적용 (1-3위는 특별 색상)
            let fillColor = '#f0f0f0';
            if (rank === 1) {
                fillColor = '#2563eb'; // 1위 - 진한 파랑
            } else if (rank === 2) {
                fillColor = '#3b82f6'; // 2위 - 파랑
            } else if (rank === 3) {
                fillColor = '#60a5fa'; // 3위 - 연한 파랑
            } else if (value > 0) {
                // 나머지는 값에 비례한 연한 색상
                const intensity = value / maxValue;
                const opacity = Math.max(0.1, intensity * 0.6);
                fillColor = `rgba(59, 130, 246, ${opacity})`;
            }

            console.log(`색상 적용: ${region} (${rank}위) -> ${fillColor}, 값: ${value}`);

            targetPath.style.fill = fillColor;
            targetPath.style.stroke = '#666';
            targetPath.style.strokeWidth = '1.5';

            // 호버 효과 추가
            const unit = metric === 'area' ? 'ha' : 't';
            targetPath.style.cursor = 'pointer';

            // 기존 이벤트 리스너 제거
            targetPath.removeEventListener('mouseenter', targetPath._mouseenterHandler);
            targetPath.removeEventListener('mouseleave', targetPath._mouseleaveHandler);

            // 새로운 이벤트 리스너 추가
            targetPath._mouseenterHandler = (e) => {
                // 호버 시 더 진한 테두리
                targetPath.style.stroke = '#333';
                targetPath.style.strokeWidth = '2';

                // 툴팁 생성 (현재 데이터를 실시간으로 조회)
                const currentSelectedCrop = document.getElementById('simple-map-crop-filter')?.value || '';
                const currentMetric = this.currentFilters.metric || 'area';
                const currentUnit = currentMetric === 'area' ? 'ha' : 't';

                // 현재 선택된 작목과 지역에 해당하는 실시간 데이터 조회
                const filteredData = this.getFilteredData();
                const regionData = filteredData.find(item =>
                    item.지역 === region && item.작목명 === currentSelectedCrop
                );

                const currentValue = regionData ?
                    (currentMetric === 'area' ? parseFloat(regionData['면적(ha)']) || 0 : parseFloat(regionData['생산량(톤)']) || 0) : 0;

                // 순위 재계산 (테이블과 동일한 방식)
                const regionalValues = [];
                filteredData.forEach(item => {
                    if (item.작목명 === currentSelectedCrop && item.지역 !== '전국') {
                        const val = currentMetric === 'area' ? parseFloat(item['면적(ha)']) || 0 : parseFloat(item['생산량(톤)']) || 0;
                        regionalValues.push({
                            region: item.지역,
                            value: val
                        });
                    }
                });

                // 값 기준으로 정렬하고 개별 순위 부여 (테이블과 동일한 로직)
                const sortedRegions = [...regionalValues].sort((a, b) => {
                    if (b.value !== a.value) {
                        return b.value - a.value;
                    }
                    return a.region.localeCompare(b.region);
                });

                const rankMap = {};
                let rankPosition = 1;
                let previousValue = null;
                let sameValueCount = 0;

                sortedRegions.forEach((regionData, index) => {
                    if (previousValue !== null && regionData.value === previousValue) {
                        sameValueCount++;
                        rankMap[regionData.region] = rankPosition + sameValueCount;
                    } else {
                        if (previousValue !== null) {
                            rankPosition += sameValueCount + 1;
                        }
                        sameValueCount = 0;
                        rankMap[regionData.region] = rankPosition;
                        previousValue = regionData.value;
                    }
                });

                // 0값 지역들을 마지막 순위부터 역순 배치
                const zeroValueRegions = sortedRegions.filter(r => r.value === 0);
                if (zeroValueRegions.length > 0) {
                    const totalRegions = sortedRegions.length;
                    zeroValueRegions.forEach((regionData, index) => {
                        rankMap[regionData.region] = totalRegions - index;
                    });
                }

                const currentRank = rankMap[region] || null;

                this.showTooltip(e, region, currentRank, currentValue, currentUnit, currentSelectedCrop);
            };

            targetPath._mouseleaveHandler = (e) => {
                // 원래 테두리로 복원
                targetPath.style.stroke = '#666';
                targetPath.style.strokeWidth = '1.5';

                // 툴팁 제거
                this.hideTooltip();
            };

            targetPath.addEventListener('mouseenter', targetPath._mouseenterHandler);
            targetPath.addEventListener('mouseleave', targetPath._mouseleaveHandler);

            // 라벨 표시 조건: 1-3위 또는 강원도
            const shouldShowLabel = rank <= 3 || region === '강원';

            if (shouldShowLabel && (value > 0 || region === '강원')) {
                // path의 중심점 계산
                const bbox = targetPath.getBBox();
                const centerX = bbox.x + bbox.width / 2;
                const centerY = bbox.y + bbox.height / 2;

                // 라벨 텍스트 생성
                const unit = metric === 'area' ? 'ha' : 't';
                const labelText = `${rank}위\n${Math.round(value).toLocaleString()}${unit}`;

                // 라벨 요소 생성
                const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                labelGroup.setAttribute('data-region', region);

                // 배경 원
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', centerX);
                circle.setAttribute('cy', centerY);
                circle.setAttribute('r', '35');
                circle.setAttribute('fill', 'rgba(255, 255, 255, 0.85)');
                circle.setAttribute('stroke', '#333');
                circle.setAttribute('stroke-width', '1.5');

                // 순위 텍스트
                const rankText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                rankText.setAttribute('x', centerX);
                rankText.setAttribute('y', centerY - 8);
                rankText.setAttribute('text-anchor', 'middle');
                rankText.setAttribute('font-size', '18');
                rankText.setAttribute('font-weight', 'bold');
                rankText.setAttribute('fill', '#333');
                rankText.textContent = `${rank}위`;

                // 값 텍스트
                const valueText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                valueText.setAttribute('x', centerX);
                valueText.setAttribute('y', centerY + 12);
                valueText.setAttribute('text-anchor', 'middle');
                valueText.setAttribute('font-size', '14');
                valueText.setAttribute('fill', '#666');
                valueText.textContent = `${Math.round(value).toLocaleString()}${unit}`;

                // 라벨 그룹에도 호버 이벤트 추가
                labelGroup.style.cursor = 'pointer';

                // 라벨 호버 이벤트
                labelGroup._mouseenterHandler = (e) => {
                    // 해당 지역의 path도 함께 하이라이트
                    targetPath.style.stroke = '#333';
                    targetPath.style.strokeWidth = '2';

                    // 라벨 배경을 더 불투명하게
                    circle.setAttribute('fill', 'rgba(255, 255, 255, 0.98)');
                    circle.setAttribute('stroke-width', '2');

                    // 라벨을 맨 앞으로 가져오기
                    svg.appendChild(labelGroup);

                    // 툴팁 표시 (현재 데이터를 실시간으로 조회)
                    const currentSelectedCrop = document.getElementById('simple-map-crop-filter')?.value || '';
                    const currentMetric = this.currentFilters.metric || 'area';
                    const currentUnit = currentMetric === 'area' ? 'ha' : 't';

                    // 현재 선택된 작목과 지역에 해당하는 실시간 데이터 조회
                    const filteredData = this.getFilteredData();
                    const regionData = filteredData.find(item =>
                        item.지역 === region && item.작목명 === currentSelectedCrop
                    );

                    const currentValue = regionData ?
                        (currentMetric === 'area' ? parseFloat(regionData['면적(ha)']) || 0 : parseFloat(regionData['생산량(톤)']) || 0) : 0;

                    // 순위 재계산 (테이블과 동일한 방식)
                    const regionalValues = [];
                    filteredData.forEach(item => {
                        if (item.작목명 === currentSelectedCrop && item.지역 !== '전국') {
                            const val = currentMetric === 'area' ? parseFloat(item['면적(ha)']) || 0 : parseFloat(item['생산량(톤)']) || 0;
                            regionalValues.push({
                                region: item.지역,
                                value: val
                            });
                        }
                    });

                    // 값 기준으로 정렬하고 개별 순위 부여 (테이블과 동일한 로직)
                    const sortedRegions = [...regionalValues].sort((a, b) => {
                        if (b.value !== a.value) {
                            return b.value - a.value;
                        }
                        return a.region.localeCompare(b.region);
                    });

                    const rankMap = {};
                    let rankPosition = 1;
                    let previousValue = null;
                    let sameValueCount = 0;

                    sortedRegions.forEach((regionData, index) => {
                        if (previousValue !== null && regionData.value === previousValue) {
                            sameValueCount++;
                            rankMap[regionData.region] = rankPosition + sameValueCount;
                        } else {
                            if (previousValue !== null) {
                                rankPosition += sameValueCount + 1;
                            }
                            sameValueCount = 0;
                            rankMap[regionData.region] = rankPosition;
                            previousValue = regionData.value;
                        }
                    });

                    // 0값 지역들을 마지막 순위부터 역순 배치
                    const zeroValueRegions = sortedRegions.filter(r => r.value === 0);
                    if (zeroValueRegions.length > 0) {
                        const totalRegions = sortedRegions.length;
                        zeroValueRegions.forEach((regionData, index) => {
                            rankMap[regionData.region] = totalRegions - index;
                        });
                    }

                    const currentRank = rankMap[region] || null;

                    this.showTooltip(e, region, currentRank, currentValue, currentUnit, currentSelectedCrop);
                };

                labelGroup._mouseleaveHandler = (e) => {
                    // 원래 스타일로 복원
                    targetPath.style.stroke = '#666';
                    targetPath.style.strokeWidth = '1.5';

                    // 라벨 배경도 원래대로
                    circle.setAttribute('fill', 'rgba(255, 255, 255, 0.85)');
                    circle.setAttribute('stroke-width', '1.5');

                    // 툴팁 숨기기
                    this.hideTooltip();
                };

                labelGroup.addEventListener('mouseenter', labelGroup._mouseenterHandler);
                labelGroup.addEventListener('mouseleave', labelGroup._mouseleaveHandler);

                labelGroup.appendChild(circle);
                labelGroup.appendChild(rankText);
                labelGroup.appendChild(valueText);
                svg.appendChild(labelGroup);

                console.log(`라벨 표시: ${region} - ${rank}위, ${value}${unit}`);
            }
        });

        console.log('SVG 데이터 적용 완료');
    }

    // 툴팁 표시
    showTooltip(event, region, rank, value, unit, cropName) {
        // 기존 툴팁 제거
        this.hideTooltip();

        const tooltip = document.createElement('div');
        tooltip.id = 'map-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 10000;
            pointer-events: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            white-space: nowrap;
        `;

        const metric = this.currentFilters.metric === 'area' ? '재배면적' : '생산량';
        const rankText = rank ? `${rank}위` : '순위 없음';
        tooltip.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px;">${region}</div>
            <div>${cropName} ${metric}: ${Math.round(value).toLocaleString()}${unit}</div>
            <div>순위: ${rankText}</div>
        `;

        document.body.appendChild(tooltip);

        // 마우스 위치에 툴팁 배치
        const updatePosition = (e) => {
            tooltip.style.left = (e.clientX + 10) + 'px';
            tooltip.style.top = (e.clientY - 10) + 'px';
        };

        updatePosition(event);

        // 마우스 움직임에 따라 툴팁 위치 업데이트
        this._tooltipMouseMoveHandler = updatePosition;
        document.addEventListener('mousemove', this._tooltipMouseMoveHandler);
    }

    // 툴팁 숨기기
    hideTooltip() {
        const tooltip = document.getElementById('map-tooltip');
        if (tooltip) {
            tooltip.remove();
        }

        // 마우스 움직임 이벤트 리스너 제거
        if (this._tooltipMouseMoveHandler) {
            document.removeEventListener('mousemove', this._tooltipMouseMoveHandler);
            this._tooltipMouseMoveHandler = null;
        }
    }
}

// 작목별 순위분석 인스턴스 생성
let cropRankingAnalysis = null;


// 기존 네비게이션 함수에 이벤트 리스너 추가 방식으로 변경
document.addEventListener('DOMContentLoaded', function() {

    // 네비게이션 링크에 이벤트 리스너 추가
    const cropRankingLink = document.querySelector('a[data-section="crop-ranking"]');
    if (cropRankingLink) {
        cropRankingLink.addEventListener('click', function() {
            // 작목별 순위분석 섹션 진입 시 초기화
            setTimeout(() => {
                if (!cropRankingAnalysis) {
                    cropRankingAnalysis = new CropRankingAnalysis();
                }
                // 데이터가 로드된 후 초기화
                if (appState.data.raw.length > 0) {
                    cropRankingAnalysis.initialize();
                }
            }, 100); // 섹션 전환 후 초기화
        });
    }
});