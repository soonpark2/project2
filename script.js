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

        console.log('데이터 처리 완료:', this.data.processed);
        
        // 디버깅: 인삼, 담배 등 특정 작물의 데이터 구조 확인
        const sampleCrops = data.filter(row => 
            row.cropName?.includes('인삼') || row.cropName?.includes('담배')
        ).slice(0, 5);
        
        if (sampleCrops.length > 0) {
            console.log('🔍 특정 작물 샘플 데이터:', sampleCrops.map(row => ({
                cropName: row.cropName,
                year: row.year,
                region: row.region,
                area: row.area,
                production: row.production,
                originalKeys: Object.keys(row)
            })));
        }
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
                        console.log('🚀 재배동향 섹션 초기 데이터 업데이트 시작');
                        handleCultivationChange();
                    } else {
                        console.log('⚠️ 데이터가 아직 로드되지 않음, 1초 후 재시도');
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
                    console.log('🏆 순위분석 섹션 초기 데이터 업데이트 시작');
                    updateRankingTables();
                } else {
                    console.log('⚠️ 데이터가 아직 로드되지 않음, 1초 후 재시도');
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
                    console.log('⭐ 특화계수 섹션 초기 데이터 업데이트 시작');
                    updateSpecializationAnalysis();
                } else {
                    console.log('⚠️ 데이터가 아직 로드되지 않음, 1초 후 재시도');
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
        ranking: '순위분석',
        specialization: '특화계수',
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
    let targetData = appState.data.raw.filter(row => row.region === '강원');
    if (targetData.length === 0) {
        console.log('강원 데이터가 없어서 전체 데이터를 사용합니다.');
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
    console.log('Analytics 섹션 렌더링');
}

async function renderComparison() {
    console.log('Comparison 섹션 렌더링');
}

async function renderTrends() {
    console.log('Trends 섹션 렌더링');
}

async function renderDataTable() {
    console.log('DataTable 섹션 렌더링 시작');
    
    try {
        // 데이터가 로드되지 않았으면 지연 처리
        if (!appState.data.raw || appState.data.raw.length === 0) {
            console.log('데이터가 아직 로드되지 않음, 1초 후 재시도');
            setTimeout(async () => {
                if (appState.data.raw && appState.data.raw.length > 0) {
                    console.log('데이터 로드 완료, 데이터 테이블 재렌더링');
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
        
        console.log('✅ DataTable 섹션 렌더링 완료');
    } catch (error) {
        console.error('❌ DataTable 렌더링 실패:', error);
    }
}

async function renderHome() {
    console.log('Home 섹션 렌더링 시작');
    
    try {
        // 홈 섹션 통계 업데이트
        updateHomeStatistics();
        
        // 빠른 탐색 이벤트 리스너 설정
        setupQuickNavigation();
        
        // 최종 업데이트 날짜 설정
        updateLastUpdateDate();
        
        console.log('✅ Home 섹션 렌더링 완료');
    } catch (error) {
        console.error('❌ Home 렌더링 실패:', error);
    }
}

// 홈 섹션 통계 업데이트
function updateHomeStatistics() {
    if (!appState.data.raw || appState.data.raw.length === 0) {
        console.log('데이터가 없어서 홈 통계를 업데이트할 수 없습니다.');
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
        
        console.log('홈 통계 업데이트 완료');
    } catch (error) {
        console.error('홈 통계 업데이트 실패:', error);
    }
}

// 빠른 탐색 이벤트 리스너 설정
function setupQuickNavigation() {
    const navCards = document.querySelectorAll('.quick-nav-card');
    console.log('발견된 quick-nav-card 개수:', navCards.length);
    
    navCards.forEach((card, index) => {
        const targetSection = card.dataset.section;
        console.log(`Card ${index}: data-section = ${targetSection}`);
        
        card.addEventListener('click', () => {
            console.log(`카드 클릭됨: ${targetSection}`);
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
    
    console.log('빠른 탐색 이벤트 리스너 설정 완료');
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
    
    console.log('최종 업데이트 날짜 설정 완료');
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
        console.log(`🔍 선택자 확인: ${header.selector} -> 요소 발견: ${element ? 'YES' : 'NO'}`);
        if (element) {
            const yearSpan = yearText ? ` <span class="year-comparison">${yearText}</span>` : '';
            element.innerHTML = `${header.text}${yearSpan}`;
            console.log(`✅ 업데이트 완료: ${header.text}${yearText}`);
        } else {
            console.log(`❌ 요소를 찾을 수 없음: ${header.selector}`);
        }
    });
    
    console.log(`📝 카드 헤더가 ${metricText} 동향으로 업데이트됨`);
    
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
            console.log(`✅ 단위 업데이트: ${elementId} -> ${unitText}`);
        } else {
            console.log(`❌ 단위 요소를 찾을 수 없음: ${elementId}`);
        }
    });
    
    console.log(`📏 테이블 단위가 ${unitText}로 업데이트됨`);
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
            console.log(`📊 차트 제목 업데이트: ${titleUpdate.id} -> ${titleUpdate.text}`);
        }
    });
    
    console.log(`📊 모든 차트 제목이 ${metricText}로 업데이트됨`);
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
        console.log('📊 재배동향 탭: 년도 정보가 없어 증감 분석 표를 업데이트할 수 없습니다');
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
    console.log(`📈 재배동향 탭 작목별 ${selectedMetric} 증감 분석 시작: ${yearA}년 vs ${yearB}년`);
    
    const dataA = appState.data.raw.filter(row => row.year === yearA && row.region === '강원');
    const dataB = appState.data.raw.filter(row => row.year === yearB && row.region === '강원');
    
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
    console.log(`📈 작목별 ${selectedMetric} 증감 분석 시작: ${yearA}년 vs ${yearB}년`);
    
    const dataA = appState.data.raw.filter(row => row.year === yearA && row.region === '강원');
    const dataB = appState.data.raw.filter(row => row.year === yearB && row.region === '강원');
    
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
    
    // 각 카드별 면적 필터 슬라이더 설정 (DOM 로드 후 지연 실행)
    setTimeout(() => {
        setupCardAreaFilterSliders();
    }, 100);
    
    // 초기 업데이트는 showSection에서 처리됨
    
    console.log('🌱 재배동향 탭 컨트롤들 설정 완료');
}

// 재배동향 탭 변경 핸들러
function handleCultivationChange() {
    const selectedMetric = document.getElementById('cultivation-trend-metric')?.value || 'area';
    
    console.log('🌱 재배동향 탭 업데이트 시작:', selectedMetric);
    
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
                console.log(`🔄 측정 항목 변경으로 인한 ${config.id} 슬라이더 필터 재적용`);
                // 슬라이더 변경 이벤트를 수동으로 트리거
                slider.dispatchEvent(new Event('input'));
            }
        });
    }, 100);
    
    console.log('🌱 재배동향 탭 업데이트 완료');
}

// 작목군별 TOP5 탭의 증감 분석 표 업데이트 함수
function updateCropChangeAnalysisTable(selectedMetric) {
    console.log('📊 작목군별 TOP5 탭 증감 분석 표 업데이트:', selectedMetric);
    
    // 현재 선택된 연도들 가져오기
    const yearA = parseInt(document.getElementById('year-a')?.value);
    const yearB = parseInt(document.getElementById('year-b')?.value);
    
    if (!yearA || !yearB) {
        console.warn('⚠️ 연도가 선택되지 않았습니다');
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
    
    console.log(`✅ 작목군별 TOP5 탭 증감 분석 표가 ${metricText}로 업데이트됨`);
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
    
    const gangwonDataA = dataA.filter(row => row.region === '강원');
    const gangwonDataB = dataB.filter(row => row.region === '강원');
    
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
    const cropCount = new Set(targetData.map(row => `${row.cropGroup}|${row.cropName}`)).size;
    
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

// 테이블 정렬 상태 관리
let tableSortState = {
    column: null,
    direction: 'asc' // 'asc' 또는 'desc'
};

function handleTableSort(th) {
    const column = th.dataset.sort;
    const isNumeric = th.classList.contains('numeric');
    
    console.log(`테이블 정렬: ${column} (${isNumeric ? '숫자' : '텍스트'})`);
    
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
    
    console.log(`✅ 테이블 정렬 완료: ${column} ${tableSortState.direction}`);
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
    console.log(`🔍 재배동향 분석 시작: ${yearA} vs ${yearB}, 측정지표=${metric === 'area' ? '재배면적' : '생산량'}, ${region}`);
    console.log(`📋 분석 매개변수:`, { yearA, yearB, metric, region });
    
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
            return row.year == yearA && rowRegion === '강원';
        });
        
        dataB = appState.data.raw.filter(row => {
            const rowRegion = row.region;
            return row.year == yearB && rowRegion === '강원';
        });
        
        console.log(`🔍 강원 필터링 체크: yearA=${yearA}, yearB=${yearB}`);
        console.log(`🔍 강원 후보 데이터 A:`, [...new Set(appState.data.raw.filter(row => row.year == yearA).map(r => r.region))]);
        console.log(`🔍 강원 후보 데이터 B:`, [...new Set(appState.data.raw.filter(row => row.year == yearB).map(r => r.region))]);
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
    
    // 데이터 샘플 확인
    if (dataA.length > 0) {
        console.log(`📋 ${region} A년도 샘플:`, {
            cropName: dataA[0].cropName,
            area: dataA[0].area,
            production: dataA[0].production
        });
    }
    
    if (dataB.length > 0) {
        console.log(`📋 ${region} B년도 샘플:`, {
            cropName: dataB[0].cropName, 
            area: dataB[0].area,
            production: dataB[0].production
        });
    }
    
    // 강원 데이터가 0개일 때 상세 디버깅
    if (region === '강원' && (dataA.length === 0 || dataB.length === 0)) {
        console.log('🔍 강원 데이터 디버깅:');
        console.log('📅 전체 연도 목록:', [...new Set(appState.data.raw.map(row => row.year))]);
        console.log('🗺️ 전체 지역 목록:', [...new Set(appState.data.raw.map(row => row.region))]);
        console.log(`📊 ${yearA}년 강원 데이터:`, appState.data.raw.filter(row => row.year == yearA && row.region === '강원').length);
        console.log(`📊 ${yearB}년 강원 데이터:`, appState.data.raw.filter(row => row.year == yearB && row.region === '강원').length);
        
        if (appState.data.raw.filter(row => row.year == yearA && row.region === '강원').length > 0) {
            console.log(`📋 ${yearA}년 강원 샘플:`, appState.data.raw.filter(row => row.year == yearA && row.region === '강원')[0]);
        }
        if (appState.data.raw.filter(row => row.year == yearB && row.region === '강원').length > 0) {
            console.log(`📋 ${yearB}년 강원 샘플:`, appState.data.raw.filter(row => row.year == yearB && row.region === '강원')[0]);
        }
    }
    
    // 필터된 데이터 샘플 확인
    if (dataA.length > 0) {
        console.log(`📊 ${region} ${yearA}년 샘플:`, dataA[0]);
        const uniqueCropsA = [...new Set(dataA.map(row => `${row.cropGroup}|${row.cropName}`))].filter(crop => crop && !crop.includes('undefined'));
        console.log(`🌾 ${region} ${yearA}년 작목 개수: ${uniqueCropsA.length}개`);
    }
    if (dataB.length > 0) {
        console.log(`📊 ${region} ${yearB}년 샘플:`, dataB[0]);
        const uniqueCropsB = [...new Set(dataB.map(row => `${row.cropGroup}|${row.cropName}`))].filter(crop => crop && !crop.includes('undefined'));
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

    // 공통 작목만 추출 (두 연도 모두에 존재하는 작목 - 작목군+작목명 조합으로)
    const cropsA = [...new Set(dataA.map(row => `${row.cropGroup}|${row.cropName}`))].filter(crop => crop && !crop.includes('undefined'));
    const cropsB = [...new Set(dataB.map(row => `${row.cropGroup}|${row.cropName}`))].filter(crop => crop && !crop.includes('undefined'));
    const commonCrops = cropsA.filter(crop => cropsB.includes(crop));
    
    console.log(`🌾 ${region} A년도 작목: ${cropsA.length}개`, cropsA);
    console.log(`🌾 ${region} B년도 작목: ${cropsB.length}개`, cropsB);
    console.log(`🌾 ${region} 공통 작목: ${commonCrops.length}개`, commonCrops);

    if (commonCrops.length === 0) {
        console.warn(`⚠️ ${region} 지역에 공통 작목이 없습니다`);
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

    console.log(`📊 ${region} 공통 작목 총합계 (${metric === 'area' ? '재배면적' : '생산량'}): A=${totalValueA}, B=${totalValueB}`);

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
            console.log(`⚠️ [${metric}] ${cropName}: 생산량 데이터가 모두 0이므로 분석에서 제외`);
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
    console.log(`📊 ${region} ${metric === 'area' ? '재배면적' : '생산량'} 분석 처리 통계:`);
    console.log(`  전체 공통작물: ${commonCrops.length}개`);
    console.log(`  처리된 작물: ${processedCount}개`);
    console.log(`  제외된 작물: ${excludedCount}개 (${excludedCrops.slice(0,3).join(', ')}${excludedCrops.length > 3 ? ' 등' : ''})`);
    
    // 분석 결과 요약 로그
    console.log(`📊 ${region} ${metric === 'area' ? '재배면적' : '생산량'} 분석 결과:`);
    console.log(`  증가: ${analysis.area.increase.length}개 (${analysis.area.increase.slice(0,3).map(c => c.name).join(', ')}${analysis.area.increase.length > 3 ? ' 등' : ''})`);
    console.log(`  유지: ${analysis.area.maintain.length}개`);
    console.log(`  감소: ${analysis.area.decrease.length}개 (${analysis.area.decrease.slice(0,3).map(c => c.name).join(', ')}${analysis.area.decrease.length > 3 ? ' 등' : ''})`);

    return analysis;
}

// 작목군별 작목 분류 함수
function groupCropsByCategory(crops) {
    if (!crops || !Array.isArray(crops)) {
        console.warn('⚠️ groupCropsByCategory에 잘못된 데이터 전달:', crops);
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
    console.log(`🔄 테이블 업데이트 시작: ${tableId}, type: ${type}`);
    console.log(`📊 분석 데이터 미리보기:`, analysis?.area?.increase?.slice(0,3)?.map(crop => crop?.name || '알수없음'));
    
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
    
    if (!data) {
        console.error(`❌ analysis[${type}] 데이터가 없습니다. analysis 구조:`, analysis);
        return;
    }

    const categories = ['increase', 'maintain', 'decrease'];
    const labels = type === 'area' ? 
        { increase: '면적증가', maintain: '면적유지', decrease: '면적감소' } :
        { increase: '구성비증가', maintain: '구성비유지', decrease: '구성비감소' };

    categories.forEach(category => {
        const crops = data[category] || [];
        console.log(`📊 ${category} 카테고리 데이터:`, crops);
        console.log(`📊 ${category} 데이터 타입:`, typeof crops, Array.isArray(crops));
        
        // crops가 배열이 아닌 경우 처리
        let cropArray = [];
        if (Array.isArray(crops)) {
            cropArray = crops;
        } else if (crops && typeof crops === 'object') {
            // crops가 객체인 경우 (예: { grain: [], vegetable: [], ... })
            cropArray = Object.values(crops).flat();
        }
        
        console.log(`📊 ${category} 처리된 배열:`, cropArray);
        
        const groups = groupCropsByCategory(cropArray);
        console.log(`📊 ${category} 작목군별 분류:`, groups);
        
        // 총 작목 수 (헤더 합계용)
        const totalCount = cropArray.length;
        const totalSelector = `.${classPrefix}total-${category}`;
        const totalCell = table.querySelector(totalSelector);
        console.log(`🔍 총계 셀 찾기: ${totalSelector}`, totalCell ? '찾음' : '없음');
        if (totalCell) {
            const oldTotal = totalCell.textContent;
            totalCell.textContent = totalCount;
            console.log(`🔄 [${tableId}] 총계 ${category} 업데이트:`);
            console.log(`  변경전: "${oldTotal}"`);
            console.log(`  변경후: "${totalCount}"`);
        } else {
            console.error(`❌ [${tableId}] 총계 ${category} 셀을 찾을 수 없음: ${totalSelector}`);
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
                const oldContent = cell.textContent; // 변경 전 내용 저장
                
                if (count > 0) {
                    // 모든 작목명을 표시 (개수와 "외" 제거)
                    const cropNames = groupCrops.map(crop => crop.name);
                    const displayText = cropNames.join(', ');
                    cell.textContent = displayText;
                    console.log(`🔄 [${tableId}] ${groupName} ${category} 셀 업데이트:`);
                    console.log(`  변경전: "${oldContent}"`);
                    console.log(`  변경후: "${displayText}"`);
                    console.log(`  작물수: ${count}개`);
                } else {
                    cell.textContent = '-';
                    console.log(`🔄 [${tableId}] ${groupName} ${category} 셀 업데이트:`);
                    console.log(`  변경전: "${oldContent}"`);
                    console.log(`  변경후: "-"`);
                }
            } else {
                console.error(`❌ [${tableId}] ${groupName} ${category} 셀을 찾을 수 없음: ${cellSelector}`);
            }
        });
    });

    // 헤더에 작목군별 총 개수 업데이트
    updateTableHeaders(table, analysis, classPrefix);
    
    console.log(`✅ [${tableId}] 테이블 업데이트 완료 요약:`);
    console.log(`  증가: ${analysis.area.increase.length}개 작물`);
    console.log(`  유지: ${analysis.area.maintain.length}개 작물`);
    console.log(`  감소: ${analysis.area.decrease.length}개 작물`);
}

// 테이블 헤더에 작목군별 총 개수 업데이트 함수
function updateTableHeaders(table, analysis, classPrefix) {
    console.log(`🔄 헤더 업데이트 시작`);
    console.log(`📊 analysis 구조:`, analysis);
    
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
    
    console.log(`📊 추출된 공통 작목:`, commonCrops);
    
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
    const selectedMetric = document.getElementById('cultivation-trend-metric')?.value || 'area';
    
    if (!yearA || !yearB) {
        console.warn('⚠️ 연도가 선택되지 않았습니다');
        return;
    }

    console.log(`🔄 재배동향 섹션 업데이트: ${yearA} vs ${yearB}, 표시 지표: ${selectedMetric}`);
    console.log(`📊 측정항목 변경 감지: ${selectedMetric === 'area' ? '재배면적' : '생산량'} 기준으로 모든 카드 업데이트 시작`);

    // 전국 데이터 분석 (선택된 측정 항목으로 분석)
    console.log(`🔍 [카드1,2] 전국 데이터 ${selectedMetric} 분석 시작`);
    const nationalAnalysis = analyzeCultivationTrends(yearA, yearB, selectedMetric, '전국');
    if (nationalAnalysis) {
        console.log(`✅ [카드1,2] 전국 ${selectedMetric} 분석 완료, 카드 업데이트 시작`);
        
        // 카드1: 전국 농산물 재배면적/생산량 동향 테이블 업데이트 (선택된 측정항목으로 분석)
        console.log(`🔄 [카드1] cultivation-crop-change-analysis-table 업데이트 중 (${selectedMetric})`);
        updateCultivationTrendTable('cultivation-crop-change-analysis-table', nationalAnalysis, 'area');
        
        // 카드2: 전국 농산물 재배면적/생산량 구성비 동향 테이블 업데이트 (선택된 측정항목으로 분석)
        console.log(`🔄 [카드2] cultivation-crop-composition-analysis-table 업데이트 중 (${selectedMetric})`);
        updateCultivationTrendTable('cultivation-crop-composition-analysis-table', nationalAnalysis, 'area');
        
        console.log(`✅ [카드1,2] 테이블 업데이트 완료`);
    } else {
        console.error(`❌ [카드1,2] 전국 ${selectedMetric} 분석 실패`);
    }

    // 강원도 데이터 분석 (선택된 측정 항목으로 분석)
    console.log(`🔍 [카드3,4] 강원도 데이터 ${selectedMetric} 분석 시작`);
    const gangwonAnalysis = analyzeCultivationTrends(yearA, yearB, selectedMetric, '강원');
    if (gangwonAnalysis) {
        console.log(`✅ [카드3,4] 강원도 ${selectedMetric} 분석 완료, 카드 업데이트 시작`);
        
        // 카드3: 강원 농산물 재배면적/생산량 동향 테이블 업데이트 (선택된 측정항목으로 분석)
        console.log(`🔄 [카드3] cultivation-gangwon-crop-change-analysis-table 업데이트 중 (${selectedMetric})`);
        updateCultivationTrendTable('cultivation-gangwon-crop-change-analysis-table', gangwonAnalysis, 'area');
        
        // 카드4: 강원 농산물 재배면적/생산량 구성비 동향 테이블 업데이트 (선택된 측정항목으로 분석)
        console.log(`🔄 [카드4] cultivation-gangwon-crop-composition-analysis-table 업데이트 중 (${selectedMetric})`);
        updateCultivationTrendTable('cultivation-gangwon-crop-composition-analysis-table', gangwonAnalysis, 'area');
        
        console.log(`✅ [카드3,4] 테이블 업데이트 완료`);
    } else {
        console.error(`❌ [카드3,4] 강원도 ${selectedMetric} 분석 실패`);
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
    
    console.log(`🏷️ 헤더 업데이트 시작: ${metricText} 기준으로 모든 카드 제목 변경`);
    
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
            console.log(`🎯 측정항목 변경 감지: ${newMetric === 'area' ? '재배면적' : '생산량'}으로 변경됨`);
            console.log(`🔄 updateCultivationSection 함수 호출 시작`);
            updateCultivationSection();
            console.log(`✅ updateCultivationSection 함수 호출 완료`);
        });
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
    
    // 이미 설정되었는지 확인
    if (window.cardSlidersSetup) {
        console.log('✅ 카드 슬라이더가 이미 설정됨. 건너뛰기');
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
    
    console.log('✅ 모든 카드별 면적 필터 슬라이더 설정 완료');
}

// 개별 카드 필터 설정
function setupSingleCardFilter(config) {
    const slider = document.getElementById(config.sliderId);
    const valueElement = document.getElementById(config.valueId);
    const countElement = config.countId ? document.getElementById(config.countId) : null;
    const presetBtns = document.querySelectorAll(`[data-card="${config.id}"]`);
    
    if (!slider || !valueElement) {
        console.warn(`⚠️ ${config.id} 슬라이더 요소를 찾을 수 없습니다. 재시도 중...`);
        
        // 500ms 후 재시도
        setTimeout(() => {
            setupSingleCardFilter(config);
        }, 500);
        return;
    }
    
    // countId가 null이면 카운트 요소가 의도적으로 없는 것으로 처리
    if (config.countId && !countElement) {
        console.warn(`⚠️ ${config.id} 카운트 요소를 찾을 수 없습니다. 카운트 표시 없이 진행합니다.`);
    }
    
    // 슬라이더 변경 이벤트
    slider.addEventListener('input', function(e) {
        const value = parseInt(e.target.value);
        console.log(`🎚️ ${config.id} 슬라이더 값 변경: ${value}`);
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
            
            console.log(`🔘 ${config.id} 프리셋 버튼 클릭: ${btnValue}, 현재값: ${currentValue}`);
            
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
            
            console.log(`➡️ ${config.id} 새로운 값: ${newValue}`);
            
            slider.value = newValue;
            updateCardFilterDisplay(config, newValue);
            applyCardAreaFilter(config, newValue);
            updateCardPresetButtons(config.id, newValue);
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
    console.log(`🔍 ${config.id} 필터 적용: ${value}${config.unit} 이상`);
    
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
    
    console.log(`📊 ${config.tableId}: ${visibleCount}개 행 표시중`);
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
    console.log(`🔄 ${config.id} 테이블 필터링 업데이트: ${filterValue}${config.unit} 이상`);
    
    // 현재 선택된 연도와 측정 항목 가져오기
    const yearA = parseInt(document.getElementById('cultivation-year-a')?.value);
    const yearB = parseInt(document.getElementById('cultivation-year-b')?.value);
    const metric = document.getElementById('cultivation-trend-metric')?.value || 'area';
    
    console.log(`📅 선택된 연도: A=${yearA}, B=${yearB}, 측정항목=${metric}`);
    
    if (!yearA || !yearB) {
        console.warn('⚠️ 연도가 선택되지 않았습니다');
        return;
    }
    
    // 지역 결정 (card3, card4는 강원도)
    const region = (config.id === 'card3' || config.id === 'card4') ? '강원' : '전국';
    console.log(`🗺️ 카드ID: ${config.id}, 결정된 지역: ${region}, 테이블ID: ${config.tableId}`);
    console.log(`🗺️ 카드ID 체크: card3인가? ${config.id === 'card3'}, card4인가? ${config.id === 'card4'}`);
    
    // 필터값이 0이면 원본 함수 사용, 0보다 크면 필터링 함수 사용
    let analysis;
    if (filterValue === 0) {
        console.log('🔄 필터값이 0이므로 원본 analyzeCultivationTrends 사용');
        analysis = analyzeCultivationTrends(yearA, yearB, metric, region);
    } else {
        console.log('🔄 필터값이 있으므로 analyzeCultivationTrendsWithFilter 사용');
        
        // 디버깅을 위해 원본 결과와 비교
        console.log(`🔍 비교 분석 시작 - 입력값: yearA=${yearA}, yearB=${yearB}, metric=${metric}, region=${region}, filter=${filterValue}`);
        
        const originalAnalysis = analyzeCultivationTrends(yearA, yearB, metric, region);
        const noFilterAnalysis = analyzeCultivationTrendsWithFilter(yearA, yearB, metric, region, 0, config.unit);
        analysis = analyzeCultivationTrendsWithFilter(yearA, yearB, metric, region, filterValue, config.unit);
        
        console.log('🔍 원본 분석 결과 (analyzeCultivationTrends):', originalAnalysis);
        console.log('🔍 필터0 분석 결과 (analyzeCultivationTrendsWithFilter filter=0):', noFilterAnalysis);
        console.log('🔍 필터링 분석 결과 (analyzeCultivationTrendsWithFilter filter>0):', analysis);
        
        // 증가 카테고리 비교
        if (originalAnalysis && originalAnalysis.area && analysis && analysis.area) {
            const originalIncrease = extractCropsFromCategory(originalAnalysis.area.increase);
            const filteredIncrease = extractCropsFromCategory(analysis.area.increase);
            
            console.log('📈 원본 증가 작목:', originalIncrease.map(c => c.name));
            console.log('📈 필터링 후 증가 작목:', filteredIncrease.map(c => c.name));
            
            // 차이점 찾기
            const lost = originalIncrease.filter(orig => !filteredIncrease.find(filt => filt.name === orig.name));
            const moved = lost.length > 0 ? '이동됨' : '변화없음';
            console.log('⚠️ 증가에서 사라진 작목:', lost.map(c => c.name), moved);
        }
    }
    
    if (analysis) {
        console.log(`✅ 분석 완료:`, analysis);
        // 테이블 타입 결정 (card2, card4는 구성비 테이블)
        const tableType = (config.id === 'card2' || config.id === 'card4') ? 'composition' : 'area';
        console.log(`📋 테이블 타입: ${tableType}`);
        updateCultivationTrendTable(config.tableId, analysis, tableType);
    } else {
        console.error('❌ 분석 결과가 없습니다');
    }
}

// 필터링 기능이 추가된 재배동향 분석 함수
function analyzeCultivationTrendsWithFilter(yearA, yearB, metric = 'area', region = '전국', filterValue = 0, filterUnit = 'ha') {
    console.log(`🔍 필터링된 재배동향 분석: ${yearA} vs ${yearB}, ${metric}, ${region}, ${filterValue}${filterUnit} 이상`);
    
    if (!appState.data.raw || appState.data.raw.length === 0) {
        console.error('❌ 데이터가 없습니다');
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
    
    console.log(`🗺️ 지역 필터링 결과: ${region} - A년도 ${dataA.length}개, B년도 ${dataB.length}개`);
    
    // 디버깅: 강원도 데이터가 없을 때 모든 지역명 확인
    if (region === '강원' && (dataA.length === 0 || dataB.length === 0)) {
        console.log('🔍 강원도 데이터 디버깅 - 모든 지역명 확인:');
        const allRegions = [...new Set(appState.data.raw.map(row => row.region))];
        console.log('📋 DB에 있는 모든 지역명:', allRegions);
        
        const yearAData = appState.data.raw.filter(row => row.year == yearA);
        const yearBData = appState.data.raw.filter(row => row.year == yearB);
        console.log(`📅 ${yearA}년 지역별 데이터:`, [...new Set(yearAData.map(row => row.region))]);
        console.log(`📅 ${yearB}년 지역별 데이터:`, [...new Set(yearBData.map(row => row.region))]);
    }
    
    if (dataA.length > 0) {
        console.log(`🗺️ ${region} A년도 샘플:`, dataA[0]);
    }
    if (dataB.length > 0) {
        console.log(`🗺️ ${region} B년도 샘플:`, dataB[0]);
    }
    
    // 공통 작목들 찾기 (필터 적용 전) - 작목군+작목명 조합으로
    const cropsA = new Set(dataA.map(row => `${row.cropGroup}|${row.cropName}`));
    const cropsB = new Set(dataB.map(row => `${row.cropGroup}|${row.cropName}`));
    const commonCrops = [...cropsA].filter(crop => cropsB.has(crop) && crop && !crop.includes('undefined'));
    
    console.log(`📊 공통 작목: ${commonCrops.length}개`);
    
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
            console.log(`⚠️ [${metric}] ${cropName}: 생산량 데이터가 모두 0이므로 분석에서 제외`);
            return;
        }
        
        processedCount++;
        
        // 디버깅: 측정항목별 값 비교 로그 (모든 작물의 첫 5개는 항상 로그 출력)
        const shouldLog = Math.random() < 0.2 || cropName?.includes('인삼') || cropName?.includes('담배') || commonCrops.indexOf(`${cropGroup}|${cropName}`) < 5;
        if (shouldLog) {
            console.log(`📊 [${metric}] ${cropName}:`);
            console.log(`  A년도: ${metric}=${valueA} (area=${cropA.area}, production=${cropA.production})`);
            console.log(`  B년도: ${metric}=${valueB} (area=${cropB.area}, production=${cropB.production})`);
            console.log(`  변화율: ${valueA === 0 ? '계산불가' : ((valueB - valueA) / valueA * 100).toFixed(1)}%`);
            console.log(`  선택된 값: ${metric === 'area' ? 'area 필드 사용' : 'production 필드 사용'}`);
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
                console.log(`🚫 재배면적 필터링으로 제외: ${cropName} (B년도 재배면적: ${areaB}ha < 필터: ${filterValue}ha)`);
                return; // 필터 조건을 만족하지 않으면 제외
            }
        }
        
        // 데이터 유효성 검증
        if (!cropName || cropName === undefined || cropName === null) {
            console.error('❌ 잘못된 작목명:', cropName, 'cropA:', cropA, 'cropB:', cropB);
            return;
        }
        
        console.log(`📈 ${cropName}: ${valueA} → ${valueB} (${changeRate.toFixed(1)}%) → ${category} [필터 통과]`);
        
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
    
    console.log('🔍 analyzeCultivationTrendsWithFilter 결과:', results);
    
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
    
    console.log('🔍 변환된 결과 (배열 형식):', formattedResults);
    
    // updateCultivationTrendTable이 기대하는 구조로 변환
    return {
        area: formattedResults,
        composition: formattedResults
    };
}

// ========== 순위분석 기능 ==========

// 순위분석 초기화
function initRankingSection() {
    console.log('🏆 순위분석 섹션 초기화 시작');
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
        
        console.log('📅 순위분석 연도 선택기 초기화 완료');
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
    
    console.log('🏆 순위분석 이벤트 리스너 초기화 완료');
}

// 순위분석 테이블 업데이트
function updateRankingTables() {
    const year1 = parseInt(document.getElementById('ranking-year-1')?.value);
    const year2 = parseInt(document.getElementById('ranking-year-2')?.value);
    const metric = document.getElementById('ranking-metric')?.value || 'area';
    
    if (!year1 || !year2) {
        console.warn('⚠️ 연도가 선택되지 않았습니다');
        return;
    }
    
    console.log(`🏆 순위분석 업데이트: ${year1}년 vs ${year2}년, ${metric}`);
    
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
    document.getElementById('national-ranking-title').textContent = `전국 ${metricText}`;
    document.getElementById('gangwon-ranking-title').textContent = `강원 ${metricText}`;
    document.getElementById('share-ranking-title').textContent = '전국대비 점유율';
    
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
    const data = appState.data.raw.filter(row => 
        row.year == year && row.region === region
    );
    
    console.log(`🔍 getRankedData: ${year}년, ${region}, ${metric} - 원본 데이터: ${data.length}개`);
    
    // 전국 기준 재배면적 100ha 이상 필터링을 위해 전국 데이터도 가져오기
    const year2 = parseInt(document.getElementById('ranking-year-2')?.value);
    const nationalDataForFilter = appState.data.raw.filter(row => 
        row.year == year2 && row.region === '전국'
    );
    
    const result = data
        .map(row => ({
            cropName: row.cropName,
            cropGroup: row.cropGroup,
            value: metric === 'area' ? (row.area || 0) : (row.production || 0)
        }))
        .filter(item => {
            // 값이 0보다 큰지 확인
            if (item.value <= 0) return false;
            
            // 해당 작목이 선택연도 2의 전국 기준으로 재배면적 100ha 이상인지 확인
            const nationalCrop = nationalDataForFilter.find(row => 
                row.cropName === item.cropName && row.cropGroup === item.cropGroup
            );
            const nationalArea = nationalCrop ? (nationalCrop.area || 0) : 0;
            
            return nationalArea >= 100;
        })
        .sort((a, b) => b.value - a.value)
        .map((item, index) => ({
            ...item,
            rank: index + 1
        }));
    
    console.log(`📊 getRankedData 결과: ${result.length}개 - 상위 5개:`, result.slice(0, 5));
    return result;
}

// 점유율 순위 데이터 생성
function getShareRankedData(year, metric) {
    const nationalData = appState.data.raw.filter(row => 
        row.year == year && row.region === '전국'
    );
    const gangwonData = appState.data.raw.filter(row => 
        row.year == year && row.region === '강원'
    );
    
    // 전국 기준 재배면적 100ha 이상 필터링을 위해 선택연도 2의 전국 데이터도 가져오기
    const year2 = parseInt(document.getElementById('ranking-year-2')?.value);
    const nationalDataForFilter = appState.data.raw.filter(row => 
        row.year == year2 && row.region === '전국'
    );
    
    const shareData = [];
    
    gangwonData.forEach(gangwonRow => {
        const nationalRow = nationalData.find(row => 
            row.cropName === gangwonRow.cropName && row.cropGroup === gangwonRow.cropGroup
        );
        if (nationalRow) {
            const gangwonValue = metric === 'area' ? (gangwonRow.area || 0) : (gangwonRow.production || 0);
            const nationalValue = metric === 'area' ? (nationalRow.area || 0) : (nationalRow.production || 0);
            
            if (nationalValue > 0 && gangwonValue > 0) {
                // 해당 작목이 선택연도 2의 전국 기준으로 재배면적 100ha 이상인지 확인
                const nationalCropForFilter = nationalDataForFilter.find(row => 
                    row.cropName === gangwonRow.cropName && row.cropGroup === gangwonRow.cropGroup
                );
                const nationalAreaForFilter = nationalCropForFilter ? (nationalCropForFilter.area || 0) : 0;
                
                if (nationalAreaForFilter >= 100) {
                    const shareRate = (gangwonValue / nationalValue) * 100;
                    shareData.push({
                        cropName: gangwonRow.cropName,
                        cropGroup: gangwonRow.cropGroup,
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
        const value1 = typeof item1.value === 'number' ? item1.value.toLocaleString() : '0';
        const value2 = typeof item2.value === 'number' ? item2.value.toLocaleString() : '0';
        
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
        
        const share1 = typeof item1.shareRate === 'number' ? item1.shareRate.toFixed(2) : '0.00';
        const share2 = typeof item2.shareRate === 'number' ? item2.shareRate.toFixed(2) : '0.00';
        
        row.innerHTML = `
            <td title="${cropName}">${cropName}</td>
            <td class="value-cell">${share1}%</td>
            <td class="rank-cell ${getRankClass(item1.rank)}">${item1.rank}</td>
            <td class="value-cell">${share2}%</td>
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
    console.log('⭐ 특화계수 섹션 초기화 시작');
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
        
        console.log('📅 특화계수 연도 선택기 초기화 완료');
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
    
    console.log('⭐ 특화계수 이벤트 리스너 초기화 완료');
}

// 특화계수 분석 업데이트
function updateSpecializationAnalysis() {
    const year = parseInt(document.getElementById('specialization-year')?.value);
    const metric = document.getElementById('specialization-metric')?.value || 'area';
    const threshold = parseFloat(document.getElementById('coefficient-threshold')?.value || '1');
    
    if (!year) {
        console.warn('⚠️ 연도가 선택되지 않았습니다');
        return;
    }
    
    console.log(`⭐ 특화계수 분석 업데이트: ${year}년, ${metric}, 임계값: ${threshold}`);
    
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
        
        console.log('✅ 특화계수 분석 업데이트 완료');
        console.log(`📊 전체 작목: ${specializationData.length}개 → 필터링 후: ${filteredData.length}개`);
    } else {
        console.error('❌ 특화계수 데이터 계산 실패');
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
    
    console.log(`✅ 특화계수 헤더가 ${metricText} 기준으로 업데이트됨`);
}

// 특화계수 분류 기준별 현황 업데이트
function updateSpecializationGradeStatus(specializationData) {
    if (!specializationData || specializationData.length === 0) {
        console.warn('⚠️ 특화계수 분류 기준별 현황 업데이트: 데이터 없음');
        return;
    }
    
    // 100ha 이상 작목만 필터링 (전국 기준 재배면적)
    const filteredData = specializationData.filter(item => {
        // nationalValue가 ha 단위로 저장되어 있다고 가정
        return item.nationalValue >= 100;
    });
    
    console.log(`📊 100ha 이상 필터링: ${specializationData.length}개 → ${filteredData.length}개`);
    
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
    
    console.log('✅ 특화계수 분류 기준별 현황 업데이트 완료');
    console.log(`고도특화: ${highGradeCrops.length}개, 고특화: ${mediumGradeCrops.length}개, 특화: ${basicGradeCrops.length}개, 일반: ${normalGradeCrops.length}개`);
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
    console.log(`🧮 특화계수 계산 시작: ${year}년, ${metric}`);
    
    // 전국 데이터와 강원 데이터 가져오기
    const nationalData = appState.data.raw.filter(row => 
        row.year == year && row.region === '전국'
    );
    const gangwonData = appState.data.raw.filter(row => 
        row.year == year && row.region === '강원'
    );
    
    console.log(`📊 데이터 확인: 전국 ${nationalData.length}개, 강원 ${gangwonData.length}개`);
    
    if (nationalData.length === 0 || gangwonData.length === 0) {
        console.error('❌ 필요한 데이터가 부족합니다');
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
    
    console.log(`📊 총합: 전국 ${nationalTotal.toLocaleString()}, 강원 ${gangwonTotal.toLocaleString()}`);
    
    const specializationData = [];
    
    // 강원 데이터를 기준으로 특화계수 계산
    gangwonData.forEach(gangwonRow => {
        const nationalRow = nationalData.find(row => 
            row.cropName === gangwonRow.cropName && row.cropGroup === gangwonRow.cropGroup
        );
        
        if (nationalRow) {
            const gangwonValue = metric === 'area' ? (gangwonRow.area || 0) : (gangwonRow.production || 0);
            const nationalValue = metric === 'area' ? (nationalRow.area || 0) : (nationalRow.production || 0);
            
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
    
    console.log(`✅ 특화계수 계산 완료: ${specializationData.length}개 작목`);
    console.log(`🔝 TOP 5:`, specializationData.slice(0, 5).map(item => 
        `${item.cropName}(${item.coefficient.toFixed(1)})`
    ));
    
    return specializationData;
}

// 전국 기준 재배면적 100ha 이상 필터링
function filterSpecializationByNationalArea(specializationData, year) {
    console.log('🔍 전국 기준 재배면적 100ha 이상 필터링 시작');
    
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
            console.log(`🚫 필터링 제외: ${item.cropName} (전국 재배면적: ${nationalArea}ha)`);
        }
        
        return isFiltered;
    });
    
    console.log(`✅ 필터링 완료: ${specializationData.length}개 → ${filteredData.length}개 작목`);
    
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
    
    console.log(`📋 테이블 업데이트 완료: ${filteredData.length}개 작목 표시`);
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
    console.log('데이터 테이블 필터 초기화');
    
    // 데이터가 로드되지 않았으면 초기화하지 않음
    if (!appState.data.raw || appState.data.raw.length === 0) {
        console.log('데이터가 아직 로드되지 않음, 필터 초기화를 건너뜀');
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
    console.log('데이터 테이블 데이터 로드 시작');
    
    try {
        // 데이터가 로드되지 않았으면 로딩하지 않음
        if (!appState.data.raw || appState.data.raw.length === 0) {
            console.log('데이터가 아직 로드되지 않음, 테이블 로딩을 건너뜀');
            return;
        }
        
        // appState.data.raw를 테이블 형태로 직접 사용
        const flatData = appState.data.raw.map(row => ({
            year: row.year,
            cropGroup: row.cropGroup || row['작목군'] || row.crop_group || '',
            cropName: row.cropName || row['작목명'] || row.crop_name || '',
            region: row.region || row['지역'] || '',
            area: parseFloat(row.area || row['재배면적'] || 0),
            production: parseFloat(row.production || row['생산량'] || 0)
        }));
        
        // 전역 변수로 저장
        window.tableData = flatData;
        
        // 통계 업데이트
        updateDataTableStats(flatData.length, flatData.length);
        
        // 테이블 렌더링
        renderDataTableRows(flatData);
        
        console.log(`✅ 데이터 테이블 데이터 로드 완료: ${flatData.length}개 레코드`);
        
    } catch (error) {
        console.error('❌ 데이터 테이블 데이터 로드 실패:', error);
    }
}

// 데이터 테이블 행 렌더링
function renderDataTableRows(data, page = 1) {
    const tbody = document.getElementById('table-body');
    const pageSize = parseInt(document.getElementById('page-size')?.value || '25');
    
    if (!tbody) {
        console.error('테이블 본문 요소를 찾을 수 없음');
        return;
    }
    
    // 페이지네이션 계산
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageData = data.slice(startIndex, endIndex);
    
    // 테이블 행 생성
    tbody.innerHTML = '';
    
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
    
    // 페이지네이션 업데이트
    updateDataTablePagination(data.length, page, pageSize);
    
    console.log(`테이블 렌더링 완료: ${pageData.length}개 행 표시`);
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
    console.log('데이터 테이블 이벤트 리스너 설정');
    
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
    
    console.log('데이터 테이블 필터 적용');
    
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
    
    console.log(`필터 적용 결과: ${window.tableData.length} → ${filteredData.length}개`);
    
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
    console.log('데이터 테이블 필터 초기화');
    
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
    
    console.log('✅ 모든 필터가 초기화되었습니다');
}

// 엑셀 내보내기 함수
function exportToExcel() {
    console.log('엑셀 내보내기 시작');
    
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
        
        console.log(`✅ 엑셀 내보내기 완료: ${filename}, ${filteredData.length}개 레코드`);
        
        // // 사용자에게 알림
        // alert(`엑셀 파일이 성공적으로 다운로드되었습니다.\n파일명: ${filename}\n레코드 수: ${filteredData.length.toLocaleString()}개`);
        
    } catch (error) {
        console.error('❌ 엑셀 내보내기 실패:', error);
        alert('엑셀 파일 내보내기 중 오류가 발생했습니다.');
    }
}

// 순위분석 엑셀 내보내기
function exportRankingToExcel() {
    console.log('순위분석 엑셀 내보내기 시작');
    
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
        
        console.log(`순위분석 엑셀 파일 저장 완료: ${filename}`);
        // alert('순위분석 데이터가 Excel 파일로 저장되었습니다.');
        
    } catch (error) {
        console.error('순위분석 엑셀 내보내기 중 오류:', error);
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
        
        console.log('순위분석 데이터 수집 완료:', data.length, '건');
        return data;
        
    } catch (error) {
        console.error('순위분석 데이터 수집 중 오류:', error);
        return [];
    }
}

// 특화계수 엑셀 내보내기
function exportSpecializationToExcel() {
    console.log('특화계수 엑셀 내보내기 시작');
    
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
        
        console.log(`특화계수 엑셀 파일 저장 완료: ${filename}`);
        // alert('특화계수 데이터가 Excel 파일로 저장되었습니다.');
        
    } catch (error) {
        console.error('특화계수 엑셀 내보내기 중 오류:', error);
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
            console.error('특화계수 테이블을 찾을 수 없습니다.');
            return [];
        }
        
        const tbody = table.querySelector('tbody');
        if (!tbody) {
            console.error('특화계수 테이블 body를 찾을 수 없습니다.');
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
        
        console.log('특화계수 테이블 데이터 수집 완료:', data.length, '건');
        return data;
        
    } catch (error) {
        console.error('특화계수 데이터 수집 중 오류:', error);
        return [];
    }
}